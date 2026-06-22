import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Mic, MapPin, Bell } from 'lucide-react';

export type PermissionKind = 'camera' | 'microphone' | 'geolocation' | 'notifications';

interface PermissionAlertProps {
  kind: PermissionKind;
  onAllow: () => void;
  onDeny: () => void;
  isVisible: boolean;
}

const PermissionAlert: React.FC<PermissionAlertProps> = ({ kind, onAllow, onDeny, isVisible }) => {
  const getIcon = () => {
    switch (kind) {
      case 'camera': return <Camera className="w-5 h-5 text-caution" />;
      case 'microphone': return <Mic className="w-5 h-5 text-caution" />;
      case 'geolocation': return <MapPin className="w-5 h-5 text-caution" />;
      case 'notifications': return <Bell className="w-5 h-5 text-caution" />;
      default: return null;
    }
  };

  const getExplanation = () => {
    switch (kind) {
      case 'camera': return 'Access to your camera could expose your physical surroundings or face without warning.';
      case 'microphone': return 'Microphone access could allow the site to listen to your environment.';
      case 'geolocation': return 'Location access reveals your precise physical whereabouts.';
      case 'notifications': return 'Notifications can be used to send persistent phishing alerts or spam.';
      default: return 'Access to this feature may pose a privacy risk.';
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="absolute top-0 left-0 right-0 z-50 p-4"
        >
          <div className="bg-[#111118] border border-caution/30 shadow-lg shadow-caution/10 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-caution/10 rounded-full">
                {getIcon()}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  This site is requesting {kind}
                </h3>
              </div>
            </div>
            
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              {getExplanation()}
            </p>
            
            <div className="flex gap-2">
              <button
                onClick={onDeny}
                className="flex-1 px-3 py-2 bg-danger/20 hover:bg-danger/30 text-danger border border-danger/50 rounded text-xs font-semibold transition-colors"
              >
                Deny
              </button>
              <button
                onClick={onAllow}
                className="flex-1 px-3 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded text-xs font-semibold transition-colors"
              >
                Allow
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PermissionAlert;
