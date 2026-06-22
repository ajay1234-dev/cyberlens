/**
 * GuardianEye — Background Service Worker
 * Entry point for the Manifest V3 service worker.
 * Wires up all background subsystems.
 */

import { installMessageRouter } from './message-router';
import { installTabListeners } from './tab-manager';
import { installDownloadHook } from '@/engines/download-analyzer';
import { createLogger } from '@/utils/logger';

const log = createLogger('service-worker');

// ─── Initialization ───────────────────────────────────────────────────────────

function initialize(): void {
  log.info('GuardianEye service worker initializing...');

  try {
    installMessageRouter();
    log.info('Message router ready');
  } catch (err) {
    log.error('Failed to install message router', err);
  }

  try {
    installTabListeners();
    log.info('Tab listeners ready');
  } catch (err) {
    log.error('Failed to install tab listeners', err);
  }

  try {
    installDownloadHook();
    log.info('Download hook ready');
  } catch (err) {
    log.error('Failed to install download hook', err);
  }

  log.info('GuardianEye service worker initialized');
}

// ─── Service Worker Lifecycle ─────────────────────────────────────────────────

// onInstalled fires on first install and extension updates
chrome.runtime.onInstalled.addListener((details) => {
  log.info(`Extension ${details.reason}`, { version: details.previousVersion });

  if (details.reason === 'install') {
    // Open onboarding page on first install
    chrome.tabs.create({
      url: chrome.runtime.getURL('index.html#/onboarding'),
    }).catch((err) => {
      log.warn('Could not open onboarding tab', err);
    });
  }
});

// onStartup fires when the browser profile starts
chrome.runtime.onStartup.addListener(() => {
  log.info('Browser startup — GuardianEye service worker starting');
  initialize();
});

// Initialize immediately (service worker re-activation)
initialize();
