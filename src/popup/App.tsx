import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRiskStore } from '../store/risk-store';
import type { ExtensionMessage } from '../types/detection.types';
import { createLogger } from '../utils/logger';

import Header from './components/Header';
import TabBar from './components/TabBar';
import OverviewPanel from './components/OverviewPanel';
import MentorPanel from './components/MentorPanel';
import AttackerPanel from './components/AttackerPanel';

const log = createLogger('PopupApp');

export type TabState = 'overview' | 'mentor' | 'attacker';

// URLs where content scripts cannot be injected
const RESTRICTED_PROTOCOLS = ['chrome:', 'chrome-extension:', 'about:', 'edge:', 'brave:', 'data:', 'file:'];

function isRestrictedUrl(url?: string): boolean {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return RESTRICTED_PROTOCOLS.includes(parsed.protocol);
  } catch {
    return true;
  }
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabState>('overview');
  const [isRestrictedPage, setIsRestrictedPage] = useState(false);

  const {
    setRiskReport,
    appendMentorToken,
    finishMentorStream,
    setMentorError,
    setAttackerReport,
    setAttackerError,
  } = useRiskStore();

  // Wire up background message listener for AI streaming tokens
  useEffect(() => {
    function onMessage(rawMessage: unknown): void {
      if (
        typeof rawMessage !== 'object' ||
        rawMessage === null ||
        !('type' in rawMessage)
      ) {
        return;
      }

      const message = rawMessage as ExtensionMessage;
      log.debug('Popup received message:', message.type);

      switch (message.type) {
        case 'RISK_REPORT':
          setRiskReport(message.payload);
          break;
        case 'MENTOR_TOKEN':
          appendMentorToken(message.token);
          break;
        case 'MENTOR_DONE':
          finishMentorStream();
          break;
        case 'ATTACKER_VIEW_RESULT':
          setAttackerReport(message.payload);
          break;
        case 'ERROR':
          log.error('Background error message', message.error);
          setMentorError(message.error);
          setAttackerError(message.error);
          break;
        default:
          break;
      }
    }

    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, [
    setRiskReport,
    appendMentorToken,
    finishMentorStream,
    setMentorError,
    setAttackerReport,
    setAttackerError,
  ]);

  // On popup open: get the active tab, save its ID, and ask the background
  // for the cached report. Background responds synchronously via sendResponse.
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) return;

      // Guard: do not try to inject into restricted pages
      if (isRestrictedUrl(tab.url)) {
        log.info('Active tab is a restricted page, skipping analysis:', tab.url);
        setIsRestrictedPage(true);
        return;
      }

      const tabId = tab.id;
      useRiskStore.getState().setActiveTabId(tabId);

      // Ask the background service worker for the cached report
      chrome.runtime.sendMessage(
        { type: 'GET_REPORT', tabId },
        (response: unknown) => {
          if (chrome.runtime.lastError || !response) {
            log.debug('Background unavailable, trying to inject content script directly');
            injectContentScriptAndScan(tabId, tab.url ?? '');
            return;
          }
          if (
            typeof response === 'object' &&
            'type' in response
          ) {
            if ((response as ExtensionMessage).type === 'RISK_REPORT') {
              const msg = response as ExtensionMessage & { type: 'RISK_REPORT' };
              setRiskReport(msg.payload);
            } else if ((response as { type: string }).type === 'NO_REPORT') {
              log.debug('Background cache empty, asking content script to scan');
              chrome.tabs.sendMessage(tabId, { type: 'FORCE_SCAN' }).catch(() => {
                injectContentScriptAndScan(tabId, tab.url ?? '');
              });
            }
          }
        }
      );
    });
  }, [setRiskReport]);

  function injectContentScriptAndScan(tabId: number, url: string) {
    // Double-check before injecting
    if (isRestrictedUrl(url)) {
      setIsRestrictedPage(true);
      return;
    }

    const manifest = chrome.runtime.getManifest();
    const contentScriptFile = manifest.content_scripts?.[0]?.js?.[0];
    
    if (!contentScriptFile) {
      useRiskStore.getState().setAnalysisError('Could not locate content script in manifest.');
      return;
    }

    log.info('Injecting orphaned content script dynamically', contentScriptFile);
    
    chrome.scripting.executeScript({
      target: { tabId },
      files: [contentScriptFile],
    }).then(() => {
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, { type: 'FORCE_SCAN' }).catch(() => {
           useRiskStore.getState().setAnalysisError('Content script injected but did not respond. Please refresh the page.');
        });
      }, 500);
    }).catch((err: Error) => {
      log.error('Failed to inject content script', err);
      // Check if it is a restricted URL error
      if (err.message?.includes('Cannot access') || err.message?.includes('chrome://')) {
        setIsRestrictedPage(true);
      } else {
        useRiskStore.getState().setAnalysisError(`Cannot analyze this page: ${err.message || 'It may be restricted.'}`);
      }
    });
  }

  if (isRestrictedPage) {
    return (
      <div className="flex flex-col w-[380px] max-h-[580px] h-[580px] overflow-hidden bg-cyber-bg text-slate-200">
        <Header />
        <div className="flex flex-col items-center justify-center flex-1 gap-4 px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center">
            <span className="text-3xl">🛡️</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-200 mb-2">GuardianEye Ready</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              This is a browser system page. Navigate to any <strong className="text-accent">https://</strong> website and click the extension to see the security analysis.
            </p>
          </div>
          <div className="text-xs text-slate-600 mt-2">Try: amazon.com · github.com · flipkart.com</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-[380px] max-h-[580px] h-[580px] overflow-hidden bg-cyber-bg text-slate-200">
      <Header />
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 p-4"
            >
              <OverviewPanel onTabChange={setActiveTab} />
            </motion.div>
          )}
          {activeTab === 'mentor' && (
            <motion.div
              key="mentor"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 p-4"
            >
              <MentorPanel />
            </motion.div>
          )}
          {activeTab === 'attacker' && (
            <motion.div
              key="attacker"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 p-4"
            >
              <AttackerPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default App;
