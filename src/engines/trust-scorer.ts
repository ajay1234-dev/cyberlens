/**
 * GuardianEye — Trust Scorer
 * Aggregates engine outputs into a 0-100 trust score with deduction breakdown.
 */

import { ThreatLevel, TacticType } from '@/types/risk.types';
import type {
  PsychDetectionResult,
  FieldScanResult,
  PermissionScanResult,
  DownloadScanResult,
  TrustScoreBreakdown,
  MetaSignals,
} from '@/types/risk.types';
import { DownloadRiskLevel } from '@/types/risk.types';
import { createLogger } from '@/utils/logger';

const log = createLogger('trust-scorer');

// ─── Thresholds ───────────────────────────────────────────────────────────────

const THRESHOLDS = {
  SAFE:    80,  // 80-100 → SAFE
  CAUTION: 60,  // 60-79  → CAUTION
  WARNING: 40,  // 40-59  → WARNING
              //  0-39   → DANGER
} as const;

// ─── Scoring Weights ──────────────────────────────────────────────────────────

/** Max deduction for psychological manipulation (up to 30) */
const MAX_PSYCH_DEDUCTION = 30;
/** Max deduction for sensitive fields (up to 25) */
const MAX_FIELD_DEDUCTION = 25;
/** Max deduction for risky permissions (up to 20) */
const MAX_PERM_DEDUCTION = 20;
/** Max deduction for suspicious downloads (up to 15) */
const MAX_DOWNLOAD_DEDUCTION = 15;
/** Max bonus for HTTPS + clean meta signals (up to 10) */
const MAX_HTTPS_BONUS = 10;

// High-impact tactics that warrant larger deductions
const HIGH_IMPACT_TACTICS = new Set([TacticType.FEAR, TacticType.PRESSURE]);

// ─── Individual Scorers ───────────────────────────────────────────────────────

function scorePsych(result: PsychDetectionResult): number {
  if (result.tactics.length === 0) return 0;

  const tacticCount = result.tactics.length;
  const instanceCount = result.instances.length;
  const hasHighImpact = result.tactics.some(t => HIGH_IMPACT_TACTICS.has(t));

  // Base: 6 points per tactic type, capped at MAX_PSYCH_DEDUCTION
  let deduction = Math.min(tacticCount * 6, MAX_PSYCH_DEDUCTION);

  // Extra: density of instances
  if (instanceCount > 5) deduction = Math.min(deduction + 4, MAX_PSYCH_DEDUCTION);
  if (instanceCount > 10) deduction = Math.min(deduction + 4, MAX_PSYCH_DEDUCTION);

  // Extra: high-impact tactics
  if (hasHighImpact) deduction = Math.min(deduction + 5, MAX_PSYCH_DEDUCTION);

  return deduction;
}

function scoreFields(result: FieldScanResult): number {
  if (result.fields.length === 0) return 0;

  const highRiskKinds = ['password', 'credit_card', 'cvv', 'ssn'] as const;
  const highRiskCount = result.fields.filter(f =>
    (highRiskKinds as readonly string[]).includes(f.kind)
  ).length;

  const hasInsecureForm = result.fields.some(f => !f.formActionIsHttps);
  const hasThirdParty = result.fields.some(f => f.isThirdPartyAction);

  let deduction = 0;

  // Per high-risk field
  deduction += Math.min(highRiskCount * 5, 15);

  // Insecure form action
  if (hasInsecureForm) deduction += 6;

  // Third-party data collection
  if (hasThirdParty) deduction += 4;

  return Math.min(deduction, MAX_FIELD_DEDUCTION);
}

function scorePermissions(result: PermissionScanResult): number {
  if (result.requests.length === 0) return 0;

  const weights: Record<string, number> = {
    camera:        10,
    microphone:     8,
    geolocation:    7,
    notifications:  3,
  };

  let deduction = 0;
  const seenKinds = new Set<string>();

  for (const req of result.requests) {
    if (!seenKinds.has(req.kind)) {
      seenKinds.add(req.kind);
      deduction += weights[req.kind] ?? 3;
    }
  }

  return Math.min(deduction, MAX_PERM_DEDUCTION);
}

function scoreDownloads(result: DownloadScanResult): number {
  if (result.downloads.length === 0) return 0;

  const dangerCount = result.downloads.filter(d => d.riskLevel === DownloadRiskLevel.DANGEROUS).length;
  const suspiciousCount = result.downloads.filter(d => d.riskLevel === DownloadRiskLevel.SUSPICIOUS).length;

  const deduction = Math.min(dangerCount * 10 + suspiciousCount * 4, MAX_DOWNLOAD_DEDUCTION);
  return deduction;
}

function scoreHttpsBonus(isHttps: boolean, meta: MetaSignals): number {
  if (!isHttps) return 0;

  let bonus = 5; // Base HTTPS bonus

  if (meta.hasPrivacyPolicy) bonus += 2;
  if (meta.hasContactInfo) bonus += 1;
  if (meta.hasSecureForms) bonus += 2;

  return Math.min(bonus, MAX_HTTPS_BONUS);
}

// ─── Meta Signal Detector ─────────────────────────────────────────────────────

export function detectMetaSignals(doc: Document, isHttps: boolean): MetaSignals {
  const bodyText = doc.body?.innerText?.toLowerCase() ?? '';
  const links = Array.from(doc.querySelectorAll('a[href]'));
  const linkTexts = links.map(a => a.textContent?.toLowerCase() ?? '');

  const hasPrivacyPolicy =
    linkTexts.some(t => /privacy\s*policy|privacy\s*notice/.test(t)) ||
    /privacy\s*policy|privacy\s*notice/.test(bodyText);

  const hasContactInfo =
    linkTexts.some(t => /contact\s*us|support/.test(t)) ||
    /contact\s*us|support/.test(bodyText);

  const forms = doc.querySelectorAll('form');
  const hasSecureForms = isHttps && forms.length > 0 &&
    Array.from(forms).every(f => {
      const action = f.action;
      if (!action || action === window.location.href) return true;
      try {
        return new URL(action).protocol === 'https:';
      } catch {
        return true;
      }
    });

  return {
    hasPrivacyPolicy,
    hasContactInfo,
    hasSecureForms,
    domainAge: 'unknown', // Requires external DNS lookup — not available client-side
  };
}

// ─── Threat Level from Score ──────────────────────────────────────────────────

export function scoreToThreatLevel(score: number): ThreatLevel {
  if (score >= THRESHOLDS.SAFE)    return ThreatLevel.SAFE;
  if (score >= THRESHOLDS.CAUTION) return ThreatLevel.CAUTION;
  if (score >= THRESHOLDS.WARNING) return ThreatLevel.WARNING;
  return ThreatLevel.DANGER;
}

// ─── Main Scorer ──────────────────────────────────────────────────────────────

export interface ScorerInput {
  psychDetection: PsychDetectionResult;
  fieldScan: FieldScanResult;
  permissionScan: PermissionScanResult;
  downloadScan: DownloadScanResult;
  isHttps: boolean;
  metaSignals: MetaSignals;
}

export function computeTrustScore(input: ScorerInput): TrustScoreBreakdown {
  const psychDeduction    = scorePsych(input.psychDetection);
  const fieldDeduction    = scoreFields(input.fieldScan);
  const permissionDeduction = scorePermissions(input.permissionScan);
  const downloadDeduction = scoreDownloads(input.downloadScan);
  const httpsBonus        = scoreHttpsBonus(input.isHttps, input.metaSignals);

  const base = 100;
  const raw = base - psychDeduction - fieldDeduction - permissionDeduction - downloadDeduction + httpsBonus;
  const final = Math.max(0, Math.min(100, raw));

  const breakdown: TrustScoreBreakdown = {
    base,
    psychDeduction,
    fieldDeduction,
    permissionDeduction,
    downloadDeduction,
    httpsBonus,
    final,
  };

  log.info('Trust score computed', breakdown);

  return breakdown;
}
