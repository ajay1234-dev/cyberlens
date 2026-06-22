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
  const badgeText =
    report.trustScore >= 80 ? '✓' :
    report.trustScore >= 60 ? '!' :
    report.trustScore >= 40 ? '!!' :
    '✕';

  const badgeColor =
    report.trustScore >= 80 ? '#22c55e' :   // green
    report.trustScore >= 60 ? '#f59e0b' :   // amber
    report.trustScore >= 40 ? '#f97316' :   // orange
    '#ef4444';                               // red

  chrome.action.setBadgeText({ text: badgeText, tabId: senderTabId });
  chrome.action.setBadgeBackgroundColor({ color: badgeColor, tabId: senderTabId });
}

// ─── Handler: REQUEST_MENTOR ──────────────────────────────────────────────────

async function handleRequestMentor(
  senderTabId: number,
  sendResponse: (response: ExtensionMessage) => void
): Promise<void> {
  const report = tabManager.getReport(senderTabId);
  if (!report) {
    log.warn(`REQUEST_MENTOR: no report found for tab ${senderTabId}`);
    sendResponse({ type: 'ERROR', error: 'No risk report available for this tab.' });
    return;
  }

  log.info(`Streaming mentor analysis for tab ${senderTabId}`);

  await streamMentorAnalysis(report, {
    onToken: (token) => {
      chrome.tabs.sendMessage(senderTabId, {
        type: 'MENTOR_TOKEN',
        token,
      } satisfies ExtensionMessage).catch(() => {
        // Tab may have navigated
      });
      // Also try to send to any open popup
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
  senderTabId: number,
  sendResponse: (response: ExtensionMessage) => void
): Promise<void> {
  const report = tabManager.getReport(senderTabId);
  if (!report) {
    log.warn(`REQUEST_ATTACKER_VIEW: no report for tab ${senderTabId}`);
    sendResponse({ type: 'ERROR', error: 'No risk report available for this tab.' });
    return;
  }

  log.info(`Fetching attacker view for tab ${senderTabId}`);

  try {
    const attackerReport = await getAttackerView(report);
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
      sendResponse: (response: ExtensionMessage) => void
    ): boolean => {
      if (!isExtensionMessage(rawMessage)) {
        log.warn('Received unknown message format', rawMessage);
        return false;
      }

      const senderTabId = sender.tab?.id;

      switch (rawMessage.type) {
        case 'RISK_REPORT': {
          if (senderTabId === undefined) {
            log.warn('RISK_REPORT received without sender tab ID');
            return false;
          }
          handleRiskReport(rawMessage, senderTabId);
          return false; // synchronous — no async response
        }

        case 'REQUEST_MENTOR': {
          const payloadTabId = (rawMessage as any).payload?.tabId;
          const tabId = senderTabId ?? (rawMessage as any).tabId ?? payloadTabId;
          if (tabId === undefined) {
            sendResponse({ type: 'ERROR', error: 'No tab ID provided.' });
            return false;
          }
          // Return true to keep channel open during async streaming
          void handleRequestMentor(tabId, sendResponse);
          return true;
        }

        case 'REQUEST_ATTACKER_VIEW': {
          const payloadTabId = (rawMessage as any).payload?.tabId;
          const tabId = senderTabId ?? (rawMessage as any).tabId ?? payloadTabId;
          if (tabId === undefined) {
            sendResponse({ type: 'ERROR', error: 'No tab ID provided.' });
            return false;
          }
          void handleRequestAttackerView(tabId, sendResponse);
          return true; // async
        }

        case 'PERMISSION_INTERCEPTED': {
          log.info('Permission intercepted', rawMessage.payload);
          // Could be stored per-tab for additional reporting
          return false;
        }

        default: {
          log.debug('Unhandled message type', rawMessage);
          return false;
        }
      }
    }
  );

  log.info('Message router installed');
}
