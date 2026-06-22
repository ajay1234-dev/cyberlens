import React, { useEffect, useRef } from 'react';
import { Target, AlertCircle, Skull, Zap, ShieldAlert, Loader2 } from 'lucide-react';
import { useRiskStore } from '../../store/risk-store';

const AttackerPanel: React.FC = () => {
  const { riskReport, attackerReport, attackerError, startAttackerLoad, activeTabId } = useRiskStore();
  const hasRequested = useRef(false);

  useEffect(() => {
    if (riskReport && !attackerReport && !attackerError && !hasRequested.current) {
      hasRequested.current = true;
      chrome.runtime.sendMessage({ type: 'REQUEST_ATTACKER_VIEW', payload: riskReport, tabId: activeTabId });
    }
  }, [riskReport, attackerReport, attackerError, activeTabId]);

  const handleRetry = () => {
    if (riskReport) {
      hasRequested.current = true;
      startAttackerLoad();
      chrome.runtime.sendMessage({ type: 'REQUEST_ATTACKER_VIEW', payload: riskReport, tabId: activeTabId });
    }
  };

  return (
    <div className="flex flex-col h-full pb-4">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-5 h-5 text-danger" />
        <h2 className="text-sm font-semibold text-white tracking-tight">Attacker's View</h2>
      </div>

      {!attackerReport && !attackerError ? (
        <div className="flex flex-col gap-3">
          {/* Skeletons */}
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-cyber-card border border-white/5 rounded-lg p-3 animate-pulse">
              <div className="h-4 bg-white/10 rounded w-1/3 mb-2"></div>
              <div className="h-3 bg-white/5 rounded w-full mb-1"></div>
              <div className="h-3 bg-white/5 rounded w-4/5"></div>
            </div>
          ))}
          <div className="flex items-center justify-center text-danger mt-4">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            <span className="text-xs">Generating threat intelligence...</span>
          </div>
        </div>
      ) : attackerReport ? (
        <div className="flex flex-col gap-3">
          {/* Data at Risk */}
          <div className="bg-cyber-card rounded-lg p-3 border-l-2 border-l-danger relative overflow-hidden">
            <div className="flex items-center gap-2 mb-2">
              <Skull className="w-4 h-4 text-danger" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Data at Risk</h3>
            </div>
            <ul className="flex flex-wrap gap-2 mt-1">
              {attackerReport.dataAtRisk.map((item, idx) => (
                <li key={idx} className="flex items-center text-xs text-danger bg-danger/10 px-2 py-1 rounded">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Attacker's Goal */}
          <div className="bg-cyber-card rounded-lg p-3 border-l-2 border-l-warning relative overflow-hidden">
            <div className="flex items-center gap-2 mb-1.5">
              <Target className="w-4 h-4 text-warning" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Attacker's Goal</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {attackerReport.attackerGoal}
            </p>
          </div>

          {/* Exploit Vector */}
          <div className="bg-cyber-card rounded-lg p-3 border-l-2 border-l-caution relative overflow-hidden">
            <div className="flex items-center gap-2 mb-1.5">
              <Zap className="w-4 h-4 text-caution" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Exploit Vector</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-mono bg-black/20 p-1.5 rounded">
              {attackerReport.exploitVector}
            </p>
          </div>

          {/* Your Defense */}
          <div className="bg-cyber-card rounded-lg p-3 border-l-2 border-l-safe relative overflow-hidden">
            <div className="flex items-center gap-2 mb-1.5">
              <ShieldAlert className="w-4 h-4 text-safe" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Your Defense</h3>
            </div>
            <p className="text-[13px] font-medium text-safe leading-relaxed">
              {attackerReport.recommendation}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 mt-2">
          <div className="flex items-center gap-2 text-warning mb-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-semibold">Analysis Failed</span>
          </div>
          <p className="text-xs text-warning/80 mb-4 leading-relaxed">
            {attackerError || 'Could not generate attacker view.'}
          </p>
          <button
            onClick={handleRetry}
            className="px-3 py-1.5 bg-warning/20 hover:bg-warning/30 text-warning text-xs font-medium rounded transition-colors"
          >
            Retry Analysis
          </button>
        </div>
      )}
    </div>
  );
};

export default AttackerPanel;
