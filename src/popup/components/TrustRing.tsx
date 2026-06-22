import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface TrustRingProps {
  score: number;
}

const getScoreColor = (score: number): string => {
  if (score >= 70) return '#00d4ff'; // accent / safe cyan
  if (score >= 40) return '#f59e0b'; // warning amber
  return '#ef4444'; // danger red
};

const getLevelLabel = (score: number): string => {
  if (score >= 80) return 'SAFE';
  if (score >= 60) return 'CAUTION';
  if (score >= 40) return 'WARNING';
  return 'DANGER';
};

const TrustRing: React.FC<TrustRingProps> = ({ score }) => {
  const [animatedScore, setAnimatedScore] = useState(0);
  const color = getScoreColor(score);
  const label = getLevelLabel(score);
  const isDanger = score < 40;

  // Animate the number counting up
  useEffect(() => {
    let startTime: number;
    const duration = 1000;
    
    const animate = (time: number) => {
      if (!startTime) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      // easeOutCubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(easeProgress * score));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [score]);

  const size = 120;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center py-6">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Background Ring */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Animated Fill Ring */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: 'easeOut' }}
            fill="none"
            strokeLinecap="round"
          />
        </svg>
        
        {/* Score Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span 
            className="text-3xl font-semibold text-white tracking-tight leading-none"
            animate={isDanger ? { scale: [1, 1.05, 1] } : {}}
            transition={isDanger ? { repeat: Infinity, duration: 2, ease: "easeInOut" } : {}}
          >
            {animatedScore}
          </motion.span>
          <span 
            className="text-[10px] font-bold tracking-[0.1em] mt-1"
            style={{ color }}
          >
            {label}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TrustRing;
