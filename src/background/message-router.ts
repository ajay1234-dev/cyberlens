/**
 * GuardianEye — Message Router
 * Typed chrome.runtime.onMessage dispatcher for the background service worker.
 */

import type { ExtensionMessage, RiskReportMessage } from '@/types/detection.types';
import { tabManager } from './tab-manager';
import { streamMentorAnalysis } from '@/ai/mentor-engine';
import { getAttackerView } from '@/ai/attacker-view';
import { createLogger } from '@/utils/logger';

const log = createLogger('message-router');

// ─── Type Guard ───────────────────────────────────────────────────────────────

function isExtensionMessage(msg: unknown): msg is ExtensionMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    typeof (msg as Record<string, unknown>)['type'] === 'string'
  );
}

// ─── Handler: RISK_REPORT ─────────────────────────────────────────────────────

function handleRiskReport(
  message: RiskReportMessage,
  senderTabId: number
): void {
  const { payload: report } = message;
  tabManager.setReport(senderTabId, report);

  log.info(`RISK_REPORT stored for tab ${senderTabId} — score=${report.trustScore}`);

  // Show a badge on the extension icon
  const score = report.trustScore;
  const badgeText =
    score >= 80 ? '✓' :
    score >= 60 ? '!' :
    score >= 40 ? '!!' :
    '✕';

  const badgeColor =
    score >= 80 ? '#10b981' :   // green
    score >= 60 ? '#f59e0b' :   // amber
    score >= 40 ? '#f97316' :   // orange
    '#ef4444';                   // red

  chrome.action.setBadgeText({ text: badgeText, tabId: senderTabId });
  chrome.action.setBadgeBackgroundColor({ color: badgeColor, tabId: senderTabId });

  // Forward the report to the popup (if open) so it updates immediately
  chrome.runtime.sendMessage({
    type: 'RISK_REPORT',
    payload: report,
  }).catch(() => {
    // Popup not open — fine
  });
}

// ─── Handler: GET_REPORT (popup asks background for cached report) ─────────────

function handleGetReport(
  tabId: number,
  sendResponse: (response: ExtensionMessage | { type: 'NO_REPORT' }) => void
): void {
  const report = tabManager.getReport(tabId);
  if (report) {
    log.info(`GET_REPORT: serving cached report for tab ${tabId}`);
    sendResponse({ type: 'RISK_REPORT', payload: report });
  } else {
    log.debug(`GET_REPORT: no report cached for tab ${tabId}`);
    sendResponse({ type: 'NO_REPORT' });
  }
}

// ─── Handler: REQUEST_MENTOR ──────────────────────────────────────────────────

async function handleRequestMentor(
  tabId: number,
  sendResponse: (response: ExtensionMessage) => void
): Promise<void> {
  const report = tabManager.getReport(tabId);
  if (!report) {
    log.warn(`REQUEST_MENTOR: no report found for tab ${tabId}`);
    sendResponse({ type: 'ERROR', error: 'No risk report available for this tab.' });
    return;
  }

  log.info(`Streaming mentor analysis for tab ${tabId}`);

  await streamMentorAnalysis(report, {
    onToken: (token) => {
      // Forward tokens to popup
      chrome.runtime.sendMessage({
        type: 'MENTOR_TOKEN',
        token,
      } satisfies ExtensionMessage).catch(() => {
        // Popup may be closed — that's fine
      });
    },
    onDone: (_fullText) => {
      chrome.runtime.sendMessage({ type: 'MENTOR_DONE' } satisfies ExtensionMessage).catch(() => {});
    },
    onError: (err) => {
      chrome.runtime.sendMessage({
        type: 'ERROR',
        error: err.message,
      } satisfies ExtensionMessage).catch(() => {});
    },
  });
}

// ─── Handler: REQUEST_ATTACKER_VIEW ──────────────────────────────────────────

async function handleRequestAttackerView(
  tabId: number,
  sendResponse: (response: ExtensionMessage) => void
): Promise<void> {
  const report = tabManager.getReport(tabId);
  if (!report) {
    log.warn(`REQUEST_ATTACKER_VIEW: no report for tab ${tabId}`);
    sendResponse({ type: 'ERROR', error: 'No risk report available for this tab.' });
    return;
  }

  log.info(`Fetching attacker view for tab ${tabId}`);

  try {
    const attackerReport = await getAttackerView(report);
    // Send directly to popup
    chrome.runtime.sendMessage({
      type: 'ATTACKER_VIEW_RESULT',
      payload: attackerReport,
    } satisfies ExtensionMessage).catch(() => {});
    sendResponse({ type: 'ATTACKER_VIEW_RESULT', payload: attackerReport });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log.error('Attacker view request failed', err);
    sendResponse({ type: 'ERROR', error: message });
  }
}

// ─── Main Router ──────────────────────────────────────────────────────────────

/**
 * Install the chrome.runtime.onMessage handler.
 * Returns true from the handler to keep the message channel open for async responses.
 */
export function installMessageRouter(): void {
  chrome.runtime.onMessage.addListener(
    (
      rawMessage: unknown,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: unknown) => void
    ): boolean => {
      if (!isExtensionMessage(rawMessage) && !(typeof rawMessage === 'object' && rawMessage !== null && 'type' in rawMessage)) {
        log.warn('Received unknown message format', rawMessage);
        return false;
      }

      const msg = rawMessage as Record<string, unknown>;
      const msgType = msg['type'] as string;
      const senderTabId = sender.tab?.id;

      log.debug(`Message received: ${msgType}, senderTabId=${senderTabId}`);

      switch (msgType) {
        case 'RISK_REPORT': {
          if (senderTabId === undefined) {
            log.warn('RISK_REPORT received without sender tab ID');
            return false;
          }
          handleRiskReport(rawMessage as RiskReportMessage, senderTabId);
          return false; // synchronous — no async response
        }

        case 'GET_REPORT': {
          // Popup requesting the cached report for a specific tab
          const tabId = (msg['tabId'] as number | undefined) ?? senderTabId;
          if (tabId === undefined) {
            sendResponse({ type: 'NO_REPORT' });
            return false;
          }
          handleGetReport(tabId, sendResponse as (r: ExtensionMessage | { type: 'NO_REPORT' }) => void);
          return false; // synchronous
        }

        case 'REQUEST_MENTOR': {
          // tabId comes from the message payload (popup sends it)
          const tabId = (msg['tabId'] as number | undefined) ?? senderTabId;
          if (tabId === undefined) {
            sendResponse({ type: 'ERROR', error: 'No tab ID provided.' });
            return false;
          }
          // Return true to keep channel open during async streaming
          void handleRequestMentor(tabId, sendResponse as (r: ExtensionMessage) => void);
          return true;
        }

        case 'REQUEST_ATTACKER_VIEW': {
          const tabId = (msg['tabId'] as number | undefined) ?? senderTabId;
          if (tabId === undefined) {
            sendResponse({ type: 'ERROR', error: 'No tab ID provided.' });
            return false;
          }
          void handleRequestAttackerView(tabId, sendResponse as (r: ExtensionMessage) => void);
          return true; // async
        }

        case 'PERMISSION_INTERCEPTED': {
          log.info('Permission intercepted', msg['payload']);
          return false;
        }

        default: {
          log.debug('Unhandled message type', msgType);
          return false;
        }
      }
    }
  );

  log.info('Message router installed');
}
