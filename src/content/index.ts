/**
 * GuardianEye — Content Script Entry Point
 * Runs on every page. Installs interceptors, runs analysis, sends report to background.
 */

import { installPermissionInterceptors, resetPermissionState } from '@/engines/permission-engine';
import { aggregateRisks } from '@/engines/risk-aggregator';
import { installObserver, uninstallObserver } from './observer';
import { injectOverlay, removeOverlay } from './overlay-injector';
import type { RiskReportMessage } from '@/types/detection.types';
import { createLogger } from '@/utils/logger';

const log = createLogger('content');

// ─── State ────────────────────────────────────────────────────────────────────

let isAnalyzing = false;

// ─── Core Analysis ────────────────────────────────────────────────────────────

async function runAnalysis(): Promise<void> {
  if (isAnalyzing) {
    log.debug('Analysis already in progress — skipping');
    return;
  }

  isAnalyzing = true;

  try {
    const url = window.location.href;
    log.info('Running full page analysis for', url);

    const report = await aggregateRisks(url);

    // Send report to background service worker
    const message: RiskReportMessage = {
      type: 'RISK_REPORT',
      payload: report,
    };

    try {
      chrome.runtime.sendMessage(message);
    } catch (err) {
      log.warn('Failed to send RISK_REPORT to background', err);
    }

    // Inject overlay for dangerous pages
    if (report.trustScore < 40) {
      injectOverlay(report.trustScore, report.hostname);
    } else {
      // Remove stale overlay if page improved (e.g., after login, DOM change)
      removeOverlay();
    }

    log.info(`Analysis complete — score=${report.trustScore}, level=${report.threatLevel}`);
  } catch (err) {
    log.error('Page analysis failed', err);
  } finally {
    isAnalyzing = false;
  }
}

// ─── Initialization ────────────────────────────────────────────────────────────

function initialize(): void {
  log.info('GuardianEye content script initializing');

  // 1. Install permission interceptors first (before any page scripts call them)
  installPermissionInterceptors();

  // 2. Run the initial analysis once the DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      void runAnalysis();
    }, { once: true });
  } else {
    // DOM already ready (document_idle)
    void runAnalysis();
  }

  // 3. Watch for SPA navigation and dynamic DOM changes
  installObserver(() => {
    log.debug('Observer triggered rescan');
    void runAnalysis();
  });

  // 4. Cleanup on unload
  window.addEventListener('beforeunload', () => {
    uninstallObserver();
    removeOverlay();
    resetPermissionState();
    log.info('Content script cleaned up on unload');
  }, { once: true });

  // 5. Listen for messages from background (e.g., MENTOR_TOKEN forwarded to popup)
  chrome.runtime.onMessage.addListener((rawMessage: unknown) => {
    // Content script doesn't need to handle messages in the current architecture
    // This listener intentionally left as a hook for future expansion
    void rawMessage;
    return false;
  });

  log.info('GuardianEye content script initialized');
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

initialize();
