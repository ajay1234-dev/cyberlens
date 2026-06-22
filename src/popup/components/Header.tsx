import React, { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { useRiskStore } from '../../store/risk-store';

const Header: React.FC = () => {
  const { riskReport } = useRiskStore();
  const [hostname, setHostname] = useState<string>('Analyzing...');

  useEffect(() => {
    if (riskReport?.hostname) {
      setHostname(riskReport.hostname);
    } else {
      // Fallback if not yet reported
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const url = tabs[0]?.url;
        if (url && url.startsWith('http')) {
          try {
            setHostname(new URL(url).hostname);
          } catch {
            setHostname('Unknown site');
          }
        } else {
          setHostname('System page');
        }
      });
    }
  }, [riskReport?.hostname]);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-cyber-bg">
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-accent" />
        <span className="font-semibold text-sm tracking-tight text-white">GuardianEye</span>
      </div>
      <div className="text-xs font-mono text-accent truncate max-w-[160px]" title={hostname}>
        {hostname}
      </div>
    </div>
  );
};

export default Header;
