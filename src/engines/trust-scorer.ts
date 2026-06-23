/**
 * GuardianEye — Trust Scorer (v2 — Reputation-Based Model)
 *
 * SCORING MODEL:
 * - Base score: 65 (neutral/unknown site — not trusted, not dangerous)
 * - Known trusted domains: +20 boost → starts at ~85 (SAFE)
 * - Deductions applied for actual threats found
 * - If URL or AI flags site as definitively malicious → clamp to 0-5
 *
 * This prevents the bug where every clean HTTPS site scored 100.
 */

import { ThreatLevel, TacticType } from '@/types/risk.types';
import type {
  PsychDetectionResult,
  FieldScanResult,
  PermissionScanResult,
  DownloadScanResult,
  TrustScoreBreakdown,
  MetaSignals,
  UrlThreatResult,
} from '@/types/risk.types';
import { DownloadRiskLevel } from '@/types/risk.types';
import type { AiThreatResult } from './ai-threat-analyzer';
import { createLogger } from '@/utils/logger';

const log = createLogger('trust-scorer');

// ─── Thresholds ───────────────────────────────────────────────────────────────

const THRESHOLDS = {
  SAFE:    80,
  CAUTION: 60,
  WARNING: 40,
} as const;

// ─── Weights ──────────────────────────────────────────────────────────────────

const MAX_PSYCH_DEDUCTION     = 30;
const MAX_FIELD_DEDUCTION     = 25;
const MAX_PERM_DEDUCTION      = 20;
const MAX_DOWNLOAD_DEDUCTION  = 15;

const HIGH_IMPACT_TACTICS = new Set([TacticType.FEAR, TacticType.PRESSURE]);

// ─── Individual Scorers ───────────────────────────────────────────────────────

function scorePsych(result: PsychDetectionResult): number {
  if (result.tactics.length === 0) return 0;
  const tacticCount    = result.tactics.length;
  const instanceCount  = result.instances.length;
  const hasHighImpact  = result.tactics.some(t => HIGH_IMPACT_TACTICS.has(t));

  let deduction = Math.min(tacticCount * 6, MAX_PSYCH_DEDUCTION);
  if (instanceCount > 5)  deduction = Math.min(deduction + 4, MAX_PSYCH_DEDUCTION);
  if (instanceCount > 10) deduction = Math.min(deduction + 4, MAX_PSYCH_DEDUCTION);
  if (hasHighImpact)      deduction = Math.min(deduction + 5, MAX_PSYCH_DEDUCTION);
  return deduction;
}

function scoreFields(result: FieldScanResult): number {
  if (result.fields.length === 0) return 0;
  const highRiskKinds = ['password', 'credit_card', 'cvv', 'ssn'] as const;
  const highRiskCount = result.fields.filter(f => (highRiskKinds as readonly string[]).includes(f.kind)).length;
  const hasInsecureForm = result.fields.some(f => !f.formActionIsHttps);
  const hasThirdParty   = result.fields.some(f => f.isThirdPartyAction);

  let deduction = Math.min(highRiskCount * 5, 15);
  if (hasInsecureForm) deduction += 6;
  if (hasThirdParty)   deduction += 4;
  return Math.min(deduction, MAX_FIELD_DEDUCTION);
}

function scorePermissions(result: PermissionScanResult): number {
  if (result.requests.length === 0) return 0;
  const weights: Record<string, number> = { camera: 10, microphone: 8, geolocation: 7, notifications: 3 };
  let deduction = 0;
  const seen = new Set<string>();
  for (const req of result.requests) {
    if (!seen.has(req.kind)) { seen.add(req.kind); deduction += weights[req.kind] ?? 3; }
  }
  return Math.min(deduction, MAX_PERM_DEDUCTION);
}

function scoreDownloads(result: DownloadScanResult): number {
  if (result.downloads.length === 0) return 0;
  const dangerCount    = result.downloads.filter(d => d.riskLevel === DownloadRiskLevel.DANGEROUS).length;
  const suspiciousCount = result.downloads.filter(d => d.riskLevel === DownloadRiskLevel.SUSPICIOUS).length;
  return Math.min(dangerCount * 10 + suspiciousCount * 4, MAX_DOWNLOAD_DEDUCTION);
}

// ─── Meta Signal Detector ─────────────────────────────────────────────────────

export function detectMetaSignals(doc: Document, isHttps: boolean): MetaSignals {
  const bodyText  = doc.body?.innerText?.toLowerCase() ?? '';
  const links     = Array.from(doc.querySelectorAll('a[href]'));
  const linkTexts = links.map(a => a.textContent?.toLowerCase() ?? '');

  const hasPrivacyPolicy = linkTexts.some(t => /privacy\s*policy|privacy\s*notice/.test(t)) ||
                           /privacy\s*policy|privacy\s*notice/.test(bodyText);

  const hasContactInfo   = linkTexts.some(t => /contact\s*us|support/.test(t)) ||
                           /contact\s*us|support/.test(bodyText);

  const forms            = doc.querySelectorAll('form');
  const hasSecureForms   = isHttps && forms.length > 0 &&
    Array.from(forms).every(f => {
      const action = f.action;
      if (!action || action === window.location.href) return true;
      try { return new URL(action).protocol === 'https:'; } catch { return true; }
    });

  return { hasPrivacyPolicy, hasContactInfo, hasSecureForms, domainAge: 'unknown' };
}

// ─── Threat Level ─────────────────────────────────────────────────────────────

export function scoreToThreatLevel(score: number): ThreatLevel {
  if (score >= THRESHOLDS.SAFE)    return ThreatLevel.SAFE;
  if (score >= THRESHOLDS.CAUTION) return ThreatLevel.CAUTION;
  if (score >= THRESHOLDS.WARNING) return ThreatLevel.WARNING;
  return ThreatLevel.DANGER;
}

// ─── Main Scorer ──────────────────────────────────────────────────────────────

export interface ScorerInput {
  psychDetection: PsychDetectionResult;
  fieldScan:      FieldScanResult;
  permissionScan: PermissionScanResult;
  downloadScan:   DownloadScanResult;
  isHttps:        boolean;
  metaSignals:    MetaSignals;
  urlThreats:     UrlThreatResult;
  aiThreats:      AiThreatResult;
  /** Whether the domain is a known-trusted site (from url-threat-analyzer) */
  isTrustedDomain: boolean;
}

export function computeTrustScore(input: ScorerInput): TrustScoreBreakdown {
  // ── Hard override: definitively malicious ───────────────────────────────────
  if (input.urlThreats.isDefinitelyMalicious || input.aiThreats.isMalicious) {
    log.warn('Hard malicious override triggered');
    const breakdown: TrustScoreBreakdown = {
      base: 0, psychDeduction: 0, fieldDeduction: 0,
      permissionDeduction: 0, downloadDeduction: 0,
      urlDeduction: 100, aiDeduction: input.aiThreats.score,
      httpsBonus: 0, final: 0,
    };
    log.info('Trust score (malicious override)', breakdown);
    return breakdown;
  }

  // ── Compute individual deductions ───────────────────────────────────────────
  const psychDeduction      = scorePsych(input.psychDetection);
  const fieldDeduction      = scoreFields(input.fieldScan);
  const permissionDeduction = scorePermissions(input.permissionScan);
  const downloadDeduction   = scoreDownloads(input.downloadScan);
  const urlDeduction        = Math.min(input.urlThreats.totalDeduction, 100);
  const aiDeduction         = Math.min(input.aiThreats.score, 100);

  // ── Base score depends on domain reputation ─────────────────────────────────
  // Known trusted domain: start at 85 (SAFE territory)
  // Unknown domain:       start at 65 (CAUTION territory — must earn trust)
  // HTTP site:            subtract extra 10
  const base = input.isTrustedDomain ? 85 : 65;

  // ── HTTPS bonus for legitimacy signals ──────────────────────────────────────
  let httpsBonus = 0;
  if (input.isHttps) {
    httpsBonus += 3;
    if (input.metaSignals.hasPrivacyPolicy) httpsBonus += 2;
    if (input.metaSignals.hasContactInfo)   httpsBonus += 1;
    if (input.metaSignals.hasSecureForms)   httpsBonus += 2;
  }

  const raw   = base + httpsBonus - psychDeduction - fieldDeduction - permissionDeduction - downloadDeduction - urlDeduction - aiDeduction;
  const final = Math.max(0, Math.min(100, raw));

  const breakdown: TrustScoreBreakdown = {
    base,
    psychDeduction,
    fieldDeduction,
    permissionDeduction,
    downloadDeduction,
    urlDeduction,
    aiDeduction,
    httpsBonus,
    final,
  };

  log.info('Trust score computed', breakdown);
  return breakdown;
}
