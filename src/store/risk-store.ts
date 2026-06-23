/**
 * GuardianEye — Risk Store (Zustand)
 * Manages the current page's risk report and AI analysis state.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { RiskReport, AttackerViewReport, ThreatLevel, TacticType, FieldScan, PermissionRequest } from '@/types/risk.types';

// ─── State Shape ──────────────────────────────────────────────────────────────

interface RiskState {
  // Current site metadata
  currentSite: string | null;
  trustScore: number;
  threatLevel: ThreatLevel | null;

  // Engine outputs
  threats: string[];
  tactics: TacticType[];
  fields: FieldScan[];
  permissions: PermissionRequest[];

  // Full report
  riskReport: RiskReport | null;

  // AI analysis
  mentorText: string;
  isMentorStreaming: boolean;
  mentorError: string | null;

  attackerReport: AttackerViewReport | null;
  isAttackerLoading: boolean;
  attackerError: string | null;

  // Loading state
  isAnalyzing: boolean;
  lastAnalyzedAt: number | null;
  analysisError: string | null;

  // Track the active tab ID for background requests
  activeTabId: number | null;
}

// ─── Actions Shape ────────────────────────────────────────────────────────────

interface RiskActions {
  /** Set the active tab ID */
  setActiveTabId: (id: number) => void;

  /** Set an error message if page analysis completely fails or content script is missing */
  setAnalysisError: (error: string) => void;

  /** Called when a full RiskReport is received from the content script */
  setRiskReport: (report: RiskReport) => void;

  /** Append a streaming mentor token to mentorText */
  appendMentorToken: (token: string) => void;

  /** Mark mentor streaming as started */
  startMentorStream: () => void;

  /** Mark mentor streaming as complete */
  finishMentorStream: () => void;

  /** Set a mentor error (e.g., Ollama offline) */
  setMentorError: (error: string) => void;

  /** Set the complete attacker view report */
  setAttackerReport: (report: AttackerViewReport) => void;

  /** Mark attacker view as loading */
  startAttackerLoad: () => void;

  /** Set an attacker view error */
  setAttackerError: (error: string) => void;

  /** Reset all state for a new page navigation */
  resetForNewPage: () => void;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: RiskState = {
  currentSite:       null,
  trustScore:        100,
  threatLevel:       null,
  threats:           [],
  tactics:           [],
  fields:            [],
  permissions:       [],
  riskReport:        null,
  mentorText:        '',
  isMentorStreaming:  false,
  mentorError:       null,
  attackerReport:    null,
  isAttackerLoading: false,
  attackerError:     null,
  isAnalyzing:       false,
  lastAnalyzedAt:    null,
  analysisError:     null,
  activeTabId:       null,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useRiskStore = create<RiskState & RiskActions>()(
  devtools(
    (set) => ({
      ...initialState,

      setActiveTabId: (id) => {
        set({ activeTabId: id }, false, 'setActiveTabId');
      },

      setAnalysisError: (error) => {
        set({ analysisError: error }, false, 'setAnalysisError');
      },

      setRiskReport: (report) => {
        set(
          {
            riskReport:     report,
            currentSite:    report.url,
            trustScore:     report.trustScore,
            threatLevel:    report.threatLevel,
            tactics:        report.psychDetection.tactics,
            fields:         report.fieldScan.fields,
            permissions:    report.permissionScan.requests,
            threats:        buildThreats(report),
            isAnalyzing:    false,
            lastAnalyzedAt: report.analyzedAt,
            analysisError:  null,
            // Reset AI state for the new report
            mentorText:        '',
            isMentorStreaming:  false,
            mentorError:       null,
            attackerReport:    null,
            isAttackerLoading: false,
            attackerError:     null,
          },
          false,
          'setRiskReport'
        );
      },

      appendMentorToken: (token) => {
        set(
          (state) => ({ mentorText: state.mentorText + token }),
          false,
          'appendMentorToken'
        );
      },

      startMentorStream: () => {
        set(
          { isMentorStreaming: true, mentorText: '', mentorError: null },
          false,
          'startMentorStream'
        );
      },

      finishMentorStream: () => {
        set({ isMentorStreaming: false }, false, 'finishMentorStream');
      },

      setMentorError: (error) => {
        set(
          { mentorError: error, isMentorStreaming: false },
          false,
          'setMentorError'
        );
      },

      setAttackerReport: (report) => {
        set(
          { attackerReport: report, isAttackerLoading: false, attackerError: null },
          false,
          'setAttackerReport'
        );
      },

      startAttackerLoad: () => {
        set(
          { isAttackerLoading: true, attackerReport: null, attackerError: null },
          false,
          'startAttackerLoad'
        );
      },

      setAttackerError: (error) => {
        set(
          { attackerError: error, isAttackerLoading: false },
          false,
          'setAttackerError'
        );
      },

      resetForNewPage: () => {
        set({ ...initialState, isAnalyzing: true }, false, 'resetForNewPage');
      },
    }),
    { name: 'GuardianEye:RiskStore' }
  )
);

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Convert a RiskReport into a flat list of human-readable threat strings.
 */
function buildThreats(report: RiskReport): string[] {
  const threats: string[] = [];

  if (!report.isHttps) {
    threats.push('Unencrypted connection (HTTP)');
  }

  if (report.psychDetection.tactics.length > 0) {
    threats.push(`Psychological manipulation detected (${report.psychDetection.tactics.join(', ')})`);
  }

  if (report.fieldScan.highRisk) {
    threats.push('High-risk sensitive data fields present');
  }

  if (report.fieldScan.fields.some(f => f.isThirdPartyAction)) {
    threats.push('Form submits data to a third-party domain');
  }

  if (report.fieldScan.fields.some(f => !f.formActionIsHttps)) {
    threats.push('Form action uses insecure HTTP');
  }

  if (report.permissionScan.hasHighRiskPermissions) {
    threats.push('High-risk browser permissions requested');
  }

  if (report.downloadScan.hasRiskyDownload) {
    threats.push('Suspicious download(s) detected');
  }

  return threats;
}

// ─── Selectors ────────────────────────────────────────────────────────────────

/** Convenience selector: is there an active risk report? */
export const selectHasReport = (state: RiskState): boolean => state.riskReport !== null;

/** Convenience selector: is the page dangerous? */
export const selectIsDangerous = (state: RiskState): boolean => state.trustScore < 40;
