import React, { useEffect, useRef } from 'react';
import { Bot, Loader2, AlertCircle } from 'lucide-react';
import { useRiskStore } from '../../store/risk-store';

const MentorPanel: React.FC = () => {
  const { riskReport, mentorText, isMentorStreaming, mentorError, startMentorStream, activeTabId } = useRiskStore();
  const hasRequested = useRef(false);

  useEffect(() => {
    // Only request once per session if we have a report and haven't started yet
    if (riskReport && !mentorText && !isMentorStreaming && !mentorError && !hasRequested.current) {
      hasRequested.current = true;
      startMentorStream();
      chrome.runtime.sendMessage({ type: 'REQUEST_MENTOR', payload: riskReport, tabId: activeTabId });
    }
  }, [riskReport, mentorText, isMentorStreaming, mentorError, startMentorStream, activeTabId]);

  const handleRetry = () => {
    if (riskReport) {
      hasRequested.current = true;
      startMentorStream();
      chrome.runtime.sendMessage({ type: 'REQUEST_MENTOR', payload: riskReport, tabId: activeTabId });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <Bot className="w-5 h-5 text-accent" />
        <h2 className="text-sm font-semibold text-white tracking-tight">AI Security Mentor</h2>
      </div>

      {mentorError ? (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 mt-2">
          <div className="flex items-center gap-2 text-warning mb-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-semibold">AI Features Unavailable</span>
          </div>
          <p className="text-xs text-warning/80 mb-4 leading-relaxed">
            {mentorError || 'Unable to connect to Ollama. Please ensure it is running locally on port 11434.'}
          </p>
          <button
            onClick={handleRetry}
            className="px-3 py-1.5 bg-warning/20 hover:bg-warning/30 text-warning text-xs font-medium rounded transition-colors"
          >
            Retry Connection
          </button>
        </div>
      ) : (
        <div className="flex-1 bg-cyber-card border border-accent/20 rounded-lg p-4 relative flex flex-col">
          {!mentorText && isMentorStreaming ? (
            <div className="flex flex-col items-center justify-center flex-1 text-accent">
              <Loader2 className="w-6 h-6 animate-spin mb-2" />
              <span className="text-xs font-medium">Analyzing...</span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <p className="text-[13px] text-slate-200 leading-[1.7] font-mono whitespace-pre-wrap">
                {mentorText}
                {isMentorStreaming && <span className="inline-block w-1.5 h-3.5 ml-1 bg-accent animate-pulse" />}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 text-center">
        <p className="text-[10px] text-slate-500">
          Powered by Ollama · 100% local · No data leaves your device
        </p>
      </div>
    </div>
  );
};

export default MentorPanel;
