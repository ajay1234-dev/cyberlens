import React, { ReactNode } from 'react';
import { Bot, Target, Fingerprint, Camera, Mic, MapPin, Bell } from 'lucide-react';
import { useRiskStore } from '../../store/risk-store';
import TrustRing from './TrustRing';
import RiskList from './RiskList';
import TacticBadge from './TacticBadge';
import type { TabState } from '../App';
import type { FieldScan, PermissionRequest, TacticType } from '../../types/risk.types';

interface OverviewPanelProps {
  onTabChange: (tab: TabState) => void;
}

const OverviewPanel: React.FC<OverviewPanelProps> = ({ onTabChange }) => {
  const { riskReport } = useRiskStore();

  if (!riskReport) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mb-4"></div>
        <p>Analyzing page...</p>
      </div>
    );
  }

  // Count field types
  const fieldCounts = riskReport.fieldScan.fields.reduce((acc: Record<string, number>, field: FieldScan) => {
    if (field.kind === 'unknown') return acc;
    acc[field.kind] = (acc[field.kind] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const hasFields = Object.keys(fieldCounts).length > 0;
  
  // Format permission icons mapping
  const getPermIcon = (kind: string): ReactNode => {
    switch (kind) {
      case 'camera': return <Camera className="w-4 h-4 text-warning" />;
      case 'microphone': return <Mic className="w-4 h-4 text-warning" />;
      case 'geolocation': return <MapPin className="w-4 h-4 text-warning" />;
      case 'notifications': return <Bell className="w-4 h-4 text-warning" />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col pb-6">
      <TrustRing score={riskReport.trustScore} />

      {/* Tactic Badges */}
      {riskReport.psychDetection.tactics.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5 mt-2 mb-4">
          {riskReport.psychDetection.tactics.map((tactic: TacticType) => (
            <TacticBadge key={tactic} tactic={tactic} />
          ))}
        </div>
      )}

      {/* Active Threats */}
      <div className="mt-4">
        <h3 className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-2">
          Active Threats
        </h3>
        <RiskList />
      </div>

      {/* Sensitive Fields */}
      {hasFields && (
        <div className="mt-6">
          <h3 className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-2">
            Sensitive Fields Detected
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(fieldCounts).map(([kind, count]) => (
              <div key={kind} className="flex items-center gap-1.5 bg-cyber-input px-2.5 py-1.5 rounded text-xs text-slate-300 border border-white/5">
                <Fingerprint className="w-3.5 h-3.5 text-accent" />
                <span className="capitalize">{kind.replace('_', ' ')}</span>
                <span className="text-slate-500 ml-1">x{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Permissions Requested */}
      {riskReport.permissionScan.requests.length > 0 && (
        <div className="mt-6">
          <h3 className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-2">
            Permissions Requested
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {riskReport.permissionScan.requests.map((req: PermissionRequest, i: number) => (
              <div key={i} className="flex items-center gap-2 bg-cyber-input px-3 py-2 rounded border border-white/5 text-sm text-slate-200">
                {getPermIcon(req.kind)}
                <span className="capitalize">{req.kind}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3 mt-8">
        <button
          onClick={() => onTabChange('mentor')}
          className="flex flex-col items-center justify-center p-3 rounded-lg bg-cyber-card border border-white/5 hover:border-accent/50 hover:bg-white/5 transition-colors group"
        >
          <Bot className="w-5 h-5 text-accent mb-1 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-medium text-white">AI Mentor</span>
        </button>
        <button
          onClick={() => onTabChange('attacker')}
          className="flex flex-col items-center justify-center p-3 rounded-lg bg-cyber-card border border-white/5 hover:border-danger/50 hover:bg-white/5 transition-colors group"
        >
          <Target className="w-5 h-5 text-danger mb-1 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-medium text-white">Attacker View</span>
        </button>
      </div>
    </div>
  );
};

export default OverviewPanel;
