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

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabState>('overview');

  const {
    setRiskReport,
    appendMentorToken,
    finishMentorStream,
    setMentorError,
    setAttackerReport,
    setAttackerError,
  } = useRiskStore();

  // Wire up background message listener
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

  // Request risk report for the active tab on popup open
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) return;

      useRiskStore.getState().setActiveTabId(tab.id);

      // Ask background for whatever it has cached for the active tab
      chrome.tabs.sendMessage(tab.id, { type: 'RISK_REPORT' }).catch(() => {
        log.debug('No content script response on popup open — tab may be loading');
      });
    });
  }, []);

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
