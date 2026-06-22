import React from 'react';
import { motion } from 'framer-motion';
import { TacticType } from '../../types/risk.types';

interface TacticBadgeProps {
  tactic: TacticType;
}

const getBadgeConfig = (tactic: TacticType) => {
  switch (tactic) {
    case TacticType.URGENCY:
      return { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: '#ef4444' };
    case TacticType.FEAR:
      return { bg: 'rgba(249, 115, 22, 0.15)', text: '#f97316', border: '#f97316' };
    case TacticType.SCARCITY:
      return { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: '#f59e0b' };
    case TacticType.REWARD:
      return { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: '#10b981' };
    case TacticType.PRESSURE:
      return { bg: 'rgba(139, 92, 246, 0.15)', text: '#8b5cf6', border: '#8b5cf6' };
    default:
      return { bg: 'rgba(255, 255, 255, 0.1)', text: '#e2e8f0', border: '#e2e8f0' };
  }
};

const TacticBadge: React.FC<TacticBadgeProps> = ({ tactic }) => {
  const config = getBadgeConfig(tactic);

  return (
    <motion.span
      initial={{ scale: 1 }}
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.08em] border whitespace-nowrap"
      style={{
        backgroundColor: config.bg,
        color: config.text,
        borderColor: `rgba(${config.border}, 0.3)`, // using a slightly lighter border or just inherit
      }}
    >
      {tactic}
    </motion.span>
  );
};

export default TacticBadge;
