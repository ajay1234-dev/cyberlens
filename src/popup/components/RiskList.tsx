import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CreditCard, MapPin, Download, Eye, CheckCircle } from 'lucide-react';
import { useRiskStore } from '../../store/risk-store';

interface ThreatItem {
  id: string;
  type: 'psych' | 'field' | 'permission' | 'download' | 'meta';
  title: string;
  explanation: string;
  color: string;
  icon: React.ElementType;
}

const RiskList: React.FC = () => {
  const { riskReport } = useRiskStore();

  const threats: ThreatItem[] = [];

  if (riskReport) {
    if (riskReport.psychDetection.tactics.length > 0) {
      threats.push({
        id: 'psych',
        type: 'psych',
        title: 'Manipulation Tactics Detected',
        explanation: `${riskReport.psychDetection.tactics.length} psychological tactics found.`,
        color: '#f97316', // Warning orange
        icon: Eye,
      });
    }

    if (riskReport.fieldScan.highRisk) {
      threats.push({
        id: 'fields',
        type: 'field',
        title: 'Sensitive Data Collection',
        explanation: 'This site is asking for high-risk sensitive information.',
        color: '#ef4444', // Danger red
        icon: CreditCard,
      });
    }

    if (riskReport.permissionScan.hasHighRiskPermissions) {
      threats.push({
        id: 'perms',
        type: 'permission',
        title: 'Risky Permissions Requested',
        explanation: 'Site requested access to sensitive device features.',
        color: '#f59e0b', // Caution amber
        icon: MapPin,
      });
    }

    if (riskReport.downloadScan.hasRiskyDownload) {
      threats.push({
        id: 'downloads',
        type: 'download',
        title: 'Suspicious Download Blocked',
        explanation: 'A potentially dangerous file download was detected.',
        color: '#ef4444', // Danger red
        icon: Download,
      });
    }

    if (!riskReport.isHttps) {
      threats.push({
        id: 'http',
        type: 'meta',
        title: 'Insecure Connection',
        explanation: 'Data sent to this site is not encrypted.',
        color: '#ef4444', // Danger red
        icon: AlertTriangle,
      });
    }
  }

  if (threats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-cyber-card rounded-lg border border-white/5 mt-4">
        <CheckCircle className="w-8 h-8 text-safe mb-2" />
        <p className="text-sm text-slate-400">No active threats detected</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 mt-4">
      {threats.map((threat, index) => {
        const Icon = threat.icon;
        return (
          <motion.div
            key={threat.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08, duration: 0.3 }}
            className="flex items-start p-3 bg-cyber-card rounded-lg border-y border-r border-white/5 relative overflow-hidden"
          >
            {/* Left border accent */}
            <div 
              className="absolute left-0 top-0 bottom-0 w-[3px]" 
              style={{ backgroundColor: threat.color }} 
            />
            
            <div className="ml-2 flex-shrink-0 mt-0.5">
              <Icon className="w-4 h-4" style={{ color: threat.color }} />
            </div>
            
            <div className="ml-3">
              <h4 className="text-[13px] font-medium text-white leading-tight">
                {threat.title}
              </h4>
              <p className="text-xs text-slate-400 mt-1 leading-snug">
                {threat.explanation}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default RiskList;
