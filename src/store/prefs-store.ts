/**
 * GuardianEye — Preferences Store (Zustand)
 * User settings persisted to chrome.storage.sync.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { ThreatLevel } from '@/types/risk.types';
import { createLogger } from '@/utils/logger';

const log = createLogger('prefs-store');

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlertLevel = ThreatLevel.CAUTION | ThreatLevel.WARNING | ThreatLevel.DANGER;

interface PrefsState {
  /** Minimum threat level that triggers an alert overlay */
  alertLevel: AlertLevel;
  /** Whether AI analysis is enabled */
  aiEnabled: boolean;
  /** Whether the overlay warning banner is enabled */
  overlayEnabled: boolean;
  /** Whether preferences have been loaded from chrome.storage */
  hydrated: boolean;
}

interface PrefsActions {
  setAlertLevel:    (level: AlertLevel) => void;
  setAiEnabled:     (enabled: boolean) => void;
  setOverlayEnabled:(enabled: boolean) => void;
  /** Load preferences from chrome.storage.sync */
  hydrate:          () => Promise<void>;
}

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  alertLevel:      'pref_alertLevel',
  aiEnabled:       'pref_aiEnabled',
  overlayEnabled:  'pref_overlayEnabled',
} as const;

type StorageData = {
  pref_alertLevel?:     AlertLevel;
  pref_aiEnabled?:      boolean;
  pref_overlayEnabled?: boolean;
};

// ─── chrome.storage Helpers ───────────────────────────────────────────────────

async function readStorage(): Promise<StorageData> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      [STORAGE_KEYS.alertLevel, STORAGE_KEYS.aiEnabled, STORAGE_KEYS.overlayEnabled],
      (items) => {
        if (chrome.runtime.lastError) {
          log.warn('Failed to read from chrome.storage.sync', chrome.runtime.lastError);
          resolve({});
        } else {
          resolve(items as StorageData);
        }
      }
    );
  });
}

async function writeStorage(partial: Partial<StorageData>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(partial, () => {
      if (chrome.runtime.lastError) {
        log.error('Failed to write to chrome.storage.sync', chrome.runtime.lastError);
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

// ─── Default State ────────────────────────────────────────────────────────────

const defaults: Omit<PrefsState, 'hydrated'> = {
  alertLevel:     ThreatLevel.WARNING,
  aiEnabled:      true,
  overlayEnabled: true,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const usePrefsStore = create<PrefsState & PrefsActions>()(
  devtools(
    (set, get) => ({
      ...defaults,
      hydrated: false,

      setAlertLevel: (level) => {
        set({ alertLevel: level }, false, 'setAlertLevel');
        writeStorage({ [STORAGE_KEYS.alertLevel]: level }).catch((err) => {
          log.error('Failed to persist alertLevel', err);
        });
      },

      setAiEnabled: (enabled) => {
        set({ aiEnabled: enabled }, false, 'setAiEnabled');
        writeStorage({ [STORAGE_KEYS.aiEnabled]: enabled }).catch((err) => {
          log.error('Failed to persist aiEnabled', err);
        });
      },

      setOverlayEnabled: (enabled) => {
        set({ overlayEnabled: enabled }, false, 'setOverlayEnabled');
        writeStorage({ [STORAGE_KEYS.overlayEnabled]: enabled }).catch((err) => {
          log.error('Failed to persist overlayEnabled', err);
        });
      },

      hydrate: async () => {
        if (get().hydrated) return;

        try {
          const stored = await readStorage();

          set(
            {
              alertLevel:     stored.pref_alertLevel     ?? defaults.alertLevel,
              aiEnabled:      stored.pref_aiEnabled      ?? defaults.aiEnabled,
              overlayEnabled: stored.pref_overlayEnabled ?? defaults.overlayEnabled,
              hydrated:       true,
            },
            false,
            'hydrate'
          );

          log.info('Preferences hydrated from chrome.storage.sync');
        } catch (err) {
          log.error('Failed to hydrate preferences', err);
          // Apply defaults even on failure
          set({ ...defaults, hydrated: true }, false, 'hydrate:fallback');
        }
      },
    }),
    { name: 'GuardianEye:PrefsStore' }
  )
);
