/**
 * Unit Tests — Trust Scorer
 */

import { describe, it, expect } from 'vitest';
import { computeTrustScore, scoreToThreatLevel, detectMetaSignals } from '@/engines/trust-scorer';
import { ThreatLevel, TacticType } from '@/types/risk.types';
import { DownloadRiskLevel } from '@/types/risk.types';
import type { ScorerInput } from '@/engines/trust-scorer';

// ─── Factories ────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<ScorerInput> = {}): ScorerInput {
  return {
    psychDetection: { tactics: [], instances: [] },
    fieldScan:      { fields: [], highRisk: false, formCount: 0 },
    permissionScan: { requests: [], hasHighRiskPermissions: false },
    downloadScan:   { downloads: [], hasRiskyDownload: false },
    isHttps:        true,
    metaSignals: {
      hasPrivacyPolicy: false,
      hasContactInfo:   false,
      hasSecureForms:   false,
      domainAge:        'unknown',
    },
    urlThreats: {
      signals: [],
      totalDeduction: 0,
      isDefinitelyMalicious: false,
      summary: 'No URL threats',
    },
    aiThreats: {
      score: 0,
      reason: 'Safe',
      isMalicious: false,
    },
    isTrustedDomain: false,
    ...overrides,
  };
}

describe('trust-scorer', () => {

  // ─── Baseline ──────────────────────────────────────────────────────────────

  describe('computeTrustScore', () => {
    it('uses base 65 for unknown HTTP domains', () => {
      const result = computeTrustScore(makeInput({ isHttps: false, isTrustedDomain: false }));
      // Unknown domain, HTTP: base=65 minus HTTP deduction, no other deductions
      expect(result.base).toBe(65);
      expect(result.final).toBeLessThanOrEqual(75);
    });

    it('uses base 85 for trusted domains', () => {
      const result = computeTrustScore(makeInput({ isHttps: true, isTrustedDomain: true }));
      expect(result.base).toBe(85);
      expect(result.final).toBeGreaterThan(80);
    });

    it('adds HTTPS bonus for a clean HTTPS page', () => {
      const result = computeTrustScore(makeInput({ isHttps: true }));
      expect(result.httpsBonus).toBeGreaterThan(0);
    });

    it('clamps final score to 100 maximum', () => {
      const result = computeTrustScore(makeInput({ isHttps: true, isTrustedDomain: true }));
      expect(result.final).toBeLessThanOrEqual(100);
    });

    // ─── Psychological Deductions ────────────────────────────────────────────

    it('deducts for psychological manipulation tactics', () => {
      const result = computeTrustScore(makeInput({
        isHttps: false,
        psychDetection: {
          tactics: [TacticType.FEAR, TacticType.URGENCY],
          instances: [
            { tactic: TacticType.FEAR,    text: 'account suspended', element: 'p' },
            { tactic: TacticType.URGENCY, text: 'act now',           element: 'span' },
          ],
        },
      }));
      expect(result.psychDeduction).toBeGreaterThan(0);
      expect(result.final).toBeLessThan(100);
    });

    it('caps psych deduction at 30', () => {
      const result = computeTrustScore(makeInput({
        isHttps: false,
        psychDetection: {
          tactics: [TacticType.FEAR, TacticType.URGENCY, TacticType.SCARCITY, TacticType.REWARD, TacticType.PRESSURE],
          instances: Array.from({ length: 20 }, (_, i) => ({
            tactic: TacticType.FEAR, text: `threat ${i}`, element: 'p',
          })),
        },
      }));
      expect(result.psychDeduction).toBeLessThanOrEqual(30);
    });

    // ─── Field Deductions ────────────────────────────────────────────────────

    it('deducts for high-risk sensitive fields', () => {
      const result = computeTrustScore(makeInput({
        isHttps: false,
        fieldScan: {
          highRisk: true,
          formCount: 1,
          fields: [
            { kind: 'password',    tag: 'input', type: 'password', name: 'pass', id: '', placeholder: '', formAction: '', formActionIsHttps: true,  isThirdPartyAction: false },
            { kind: 'credit_card', tag: 'input', type: 'text',     name: 'cc',   id: '', placeholder: '', formAction: '', formActionIsHttps: true,  isThirdPartyAction: false },
          ],
        },
      }));
      expect(result.fieldDeduction).toBeGreaterThan(0);
    });

    it('adds extra deduction for insecure form action', () => {
      const baseResult = computeTrustScore(makeInput({
        isHttps: false,
        fieldScan: {
          highRisk: true, formCount: 1,
          fields: [{ kind: 'email', tag: 'input', type: 'email', name: 'email', id: '', placeholder: '', formAction: 'https://safe.com', formActionIsHttps: true, isThirdPartyAction: false }],
        },
      }));

      const insecureResult = computeTrustScore(makeInput({
        isHttps: false,
        fieldScan: {
          highRisk: false, formCount: 1,
          fields: [{ kind: 'email', tag: 'input', type: 'email', name: 'email', id: '', placeholder: '', formAction: 'http://unsafe.com', formActionIsHttps: false, isThirdPartyAction: false }],
        },
      }));

      expect(insecureResult.fieldDeduction).toBeGreaterThan(baseResult.fieldDeduction);
    });

    it('caps field deduction at 25', () => {
      const manyFields = Array.from({ length: 10 }, () => ({
        kind: 'credit_card' as const, tag: 'input', type: 'text', name: 'cc', id: '', placeholder: '',
        formAction: 'http://unsafe.com', formActionIsHttps: false, isThirdPartyAction: true,
      }));
      const result = computeTrustScore(makeInput({ isHttps: false, fieldScan: { fields: manyFields, highRisk: true, formCount: 1 } }));
      expect(result.fieldDeduction).toBeLessThanOrEqual(25);
    });

    // ─── Permission Deductions ────────────────────────────────────────────────

    it('deducts for camera permission', () => {
      const result = computeTrustScore(makeInput({
        isHttps: false,
        permissionScan: {
          hasHighRiskPermissions: true,
          requests: [{ kind: 'camera', requestedAt: Date.now(), allowed: true }],
        },
      }));
      expect(result.permissionDeduction).toBeGreaterThanOrEqual(10);
    });

    it('deducts for geolocation permission', () => {
      const result = computeTrustScore(makeInput({
        isHttps: false,
        permissionScan: {
          hasHighRiskPermissions: true,
          requests: [{ kind: 'geolocation', requestedAt: Date.now(), allowed: true }],
        },
      }));
      expect(result.permissionDeduction).toBeGreaterThan(0);
    });

    it('caps permission deduction at 20', () => {
      const result = computeTrustScore(makeInput({
        isHttps: false,
        permissionScan: {
          hasHighRiskPermissions: true,
          requests: [
            { kind: 'camera',        requestedAt: Date.now(), allowed: true },
            { kind: 'microphone',    requestedAt: Date.now(), allowed: true },
            { kind: 'geolocation',   requestedAt: Date.now(), allowed: true },
            { kind: 'notifications', requestedAt: Date.now(), allowed: true },
          ],
        },
      }));
      expect(result.permissionDeduction).toBeLessThanOrEqual(20);
    });

    // ─── Download Deductions ──────────────────────────────────────────────────

    it('deducts for dangerous downloads', () => {
      const result = computeTrustScore(makeInput({
        isHttps: false,
        downloadScan: {
          hasRiskyDownload: true,
          downloads: [{
            filename: 'invoice.pdf.exe', url: 'http://bad.com/file', mimeType: 'application/octet-stream',
            riskLevel: DownloadRiskLevel.DANGEROUS, explanation: 'Double extension', detectedAt: Date.now(),
          }],
        },
      }));
      expect(result.downloadDeduction).toBeGreaterThanOrEqual(10);
    });

    it('caps download deduction at 15', () => {
      const result = computeTrustScore(makeInput({
        isHttps: false,
        downloadScan: {
          hasRiskyDownload: true,
          downloads: Array.from({ length: 5 }, () => ({
            filename: 'malware.exe', url: 'http://bad.com', mimeType: 'application/octet-stream',
            riskLevel: DownloadRiskLevel.DANGEROUS, explanation: 'Executable', detectedAt: Date.now(),
          })),
        },
      }));
      expect(result.downloadDeduction).toBeLessThanOrEqual(15);
    });

    // ─── Final Score Clamping ────────────────────────────────────────────────

    it('never returns a score below 0', () => {
      const result = computeTrustScore(makeInput({
        isHttps: false,
        psychDetection: {
          tactics: [TacticType.FEAR, TacticType.URGENCY, TacticType.SCARCITY, TacticType.REWARD, TacticType.PRESSURE],
          instances: Array.from({ length: 15 }, (_, i) => ({ tactic: TacticType.FEAR, text: `t${i}`, element: 'p' })),
        },
        fieldScan: {
          highRisk: true, formCount: 1,
          fields: Array.from({ length: 5 }, () => ({ kind: 'credit_card' as const, tag: 'input', type: 'text', name: 'cc', id: '', placeholder: '', formAction: 'http://bad.com', formActionIsHttps: false, isThirdPartyAction: true })),
        },
        permissionScan: {
          hasHighRiskPermissions: true,
          requests: [
            { kind: 'camera', requestedAt: Date.now(), allowed: true },
            { kind: 'microphone', requestedAt: Date.now(), allowed: true },
          ],
        },
        downloadScan: {
          hasRiskyDownload: true,
          downloads: [{ filename: 'bad.exe', url: 'http://x.com', mimeType: 'application/octet-stream', riskLevel: DownloadRiskLevel.DANGEROUS, explanation: 'Exe', detectedAt: Date.now() }],
        },
      }));
      expect(result.final).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── scoreToThreatLevel ───────────────────────────────────────────────────────

  describe('scoreToThreatLevel', () => {
    it('returns SAFE for score >= 80', () => {
      expect(scoreToThreatLevel(100)).toBe(ThreatLevel.SAFE);
      expect(scoreToThreatLevel(80)).toBe(ThreatLevel.SAFE);
    });

    it('returns CAUTION for score 60-79', () => {
      expect(scoreToThreatLevel(79)).toBe(ThreatLevel.CAUTION);
      expect(scoreToThreatLevel(60)).toBe(ThreatLevel.CAUTION);
    });

    it('returns WARNING for score 40-59', () => {
      expect(scoreToThreatLevel(59)).toBe(ThreatLevel.WARNING);
      expect(scoreToThreatLevel(40)).toBe(ThreatLevel.WARNING);
    });

    it('returns DANGER for score < 40', () => {
      expect(scoreToThreatLevel(39)).toBe(ThreatLevel.DANGER);
      expect(scoreToThreatLevel(0)).toBe(ThreatLevel.DANGER);
    });
  });

  // ─── detectMetaSignals ────────────────────────────────────────────────────────

  describe('detectMetaSignals', () => {
    it('detects privacy policy link', () => {
      document.body.innerHTML = '<a href="/privacy">Privacy Policy</a>';
      const result = detectMetaSignals(document, true);
      expect(result.hasPrivacyPolicy).toBe(true);
    });

    it('detects contact us link', () => {
      document.body.innerHTML = '<a href="/contact">Contact Us</a>';
      const result = detectMetaSignals(document, true);
      expect(result.hasContactInfo).toBe(true);
    });

    it('returns false when no privacy policy link present', () => {
      document.body.innerHTML = '<p>Welcome to our store</p>';
      const result = detectMetaSignals(document, true);
      expect(result.hasPrivacyPolicy).toBe(false);
    });

    it('always has domainAge as unknown (no DNS lookup)', () => {
      document.body.innerHTML = '';
      const result = detectMetaSignals(document, true);
      expect(result.domainAge).toBe('unknown');
    });
  });
});
