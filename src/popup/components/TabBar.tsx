import React from 'react';
import { motion } from 'framer-motion';
import type { TabState } from '../App';

interface TabBarProps {
  activeTab: TabState;
  onTabChange: (tab: TabState) => void;
}

const tabs: { id: TabState; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'mentor', label: 'AI Mentor' },
  { id: 'attacker', label: 'Attacker View' },
];

const TabBar: React.FC<TabBarProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="flex px-4 border-b border-white/10 bg-cyber-bg">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`relative px-3 py-3 text-sm font-medium transition-colors ${
              isActive ? 'text-white' : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            {tab.label}
            {isActive && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute left-0 right-0 bottom-0 h-0.5 bg-accent"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default TabBar;
