import React, { useEffect, useRef } from 'react';
import { Bot, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useRiskStore } from '../../store/risk-store';

const MentorPanel: React.FC = () => {
  const { riskReport, mentorText, isMentorStreaming, mentorError, startMentorStream, activeTabId } = useRiskStore();
  const hasRequested = useRef(false);

  useEffect(() => {
    // Reset request flag when a new report arrives
    hasRequested.current = false;
  }, [riskReport?.url]);

  useEffect(() => {
    // Only request once per session if we have a report and haven't started yet
    if (riskReport && activeTabId && !mentorText && !isMentorStreaming && !mentorError && !hasRequested.current) {
      hasRequested.current = true;
      startMentorStream();
      chrome.runtime.sendMessage({ type: 'REQUEST_MENTOR', payload: riskReport, tabId: activeTabId }, () => {
        // Response handled via onMessage listener in App.tsx
        if (chrome.runtime.lastError) {
          // Error handled by error case
        }
      });
    }
  }, [riskReport, mentorText, isMentorStreaming, mentorError, startMentorStream, activeTabId]);

  const handleRetry = () => {
    if (riskReport && activeTabId) {
      hasRequested.current = true;
      startMentorStream();
      chrome.runtime.sendMessage({ type: 'REQUEST_MENTOR', payload: riskReport, tabId: activeTabId }, () => {
        if (chrome.runtime.lastError) {
          // handled by App.tsx
        }
      });
    }
  };

  // Loading state: waiting for report to arrive from background
  if (!riskReport) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
        <p className="text-sm">Waiting for page analysis...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <Bot className="w-5 h-5 text-accent" />
        <h2 className="text-sm font-semibold text-white tracking-tight">AI Security Mentor</h2>
      </div>

      {mentorError ? (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 mt-2">
          <div className="flex items-center gap-2 text-danger mb-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-semibold">Analysis Failed</span>
          </div>
          <p className="text-xs text-danger/80 mb-4 leading-relaxed">
            {mentorError}
          </p>
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 px-3 py-1.5 bg-accent/20 hover:bg-accent/30 text-accent text-xs font-medium rounded transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Retry Analysis
          </button>
        </div>
      ) : (
        <div className="flex-1 bg-cyber-card border border-accent/20 rounded-lg p-4 relative flex flex-col">
          {!mentorText && isMentorStreaming ? (
            <div className="flex flex-col items-center justify-center flex-1 text-accent gap-3">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-xs font-medium">Ollama llama3.2:3b is analyzing this page...</span>
            </div>
          ) : !mentorText && !isMentorStreaming ? (
            <div className="flex flex-col items-center justify-center flex-1 text-slate-500 gap-2">
              <Bot className="w-8 h-8 opacity-30" />
              <p className="text-xs text-center">AI mentor will analyze once the page report is ready.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <p className="text-[13px] text-slate-200 leading-[1.7] whitespace-pre-wrap">
                {mentorText}
                {isMentorStreaming && <span className="inline-block w-1.5 h-3.5 ml-1 bg-accent animate-pulse" />}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 text-center">
        <p className="text-[10px] text-slate-500">
          Powered by Ollama llama3.2:3b · 100% local · No data leaves your device
        </p>
      </div>
    </div>
  );
};

export default MentorPanel;
