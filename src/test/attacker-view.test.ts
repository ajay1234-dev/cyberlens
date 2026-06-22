/**
 * Unit Tests — Attacker View (JSON parsing and validation)
 */

import { describe, it, expect } from 'vitest';
import type { AttackerViewReport, RiskReport } from '@/types/risk.types';
import { ThreatLevel, TacticType } from '@/types/risk.types';


// ─── Minimal RiskReport Factory ───────────────────────────────────────────────

function makeReport(overrides: Partial<RiskReport> = {}): RiskReport {
  return {
    url:          'https://example.com',
    hostname:     'example.com',
    analyzedAt:   Date.now(),
    threatLevel:  ThreatLevel.CAUTION,
    trustScore:   65,
    scoreBreakdown: { base: 100, psychDeduction: 10, fieldDeduction: 10, permissionDeduction: 5, downloadDeduction: 0, httpsBonus: 5, final: 65 },
    psychDetection: { tactics: [TacticType.URGENCY], instances: [] },
    fieldScan:    { fields: [{ kind: 'email', tag: 'input', type: 'email', name: 'email', id: 'email', placeholder: 'Email', formAction: 'https://example.com/submit', formActionIsHttps: true, isThirdPartyAction: false }], highRisk: false, formCount: 1 },
    permissionScan: { requests: [], hasHighRiskPermissions: false },
    downloadScan:   { downloads: [], hasRiskyDownload: false },
    isHttps:      true,
    metaSignals:  { hasPrivacyPolicy: true, hasContactInfo: false, hasSecureForms: true, domainAge: 'unknown' },
    ...overrides,
  };
}

// ─── JSON Parse Helpers (extracted from attacker-view logic) ──────────────────

function extractJson(raw: string): string {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  const start = cleaned.indexOf('{');
  const end   = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) throw new Error('No JSON found');
  return cleaned.slice(start, end + 1);
}

function validateReport(obj: unknown): AttackerViewReport {
  if (typeof obj !== 'object' || obj === null) throw new Error('Not an object');
  const r = obj as Record<string, unknown>;
  if (!Array.isArray(r['dataAtRisk']))             throw new Error('Missing dataAtRisk');
  if (typeof r['attackerGoal'] !== 'string')       throw new Error('Missing attackerGoal');
  if (typeof r['exploitVector'] !== 'string')      throw new Error('Missing exploitVector');
  if (typeof r['recommendation'] !== 'string')     throw new Error('Missing recommendation');
  return {
    dataAtRisk:    (r['dataAtRisk'] as unknown[]).map(String),
    attackerGoal:   r['attackerGoal'],
    exploitVector:  r['exploitVector'],
    recommendation: r['recommendation'],
  };
}

describe('attacker-view JSON parsing', () => {

  describe('extractJson', () => {
    it('extracts JSON from clean response', () => {
      const raw = '{"dataAtRisk":["email"],"attackerGoal":"harvest","exploitVector":"form","recommendation":"leave"}';
      const extracted = extractJson(raw);
      expect(() => JSON.parse(extracted)).not.toThrow();
    });

    it('strips markdown code fences', () => {
      const raw = '```json\n{"dataAtRisk":[],"attackerGoal":"a","exploitVector":"b","recommendation":"c"}\n```';
      const extracted = extractJson(raw);
      const parsed = JSON.parse(extracted);
      expect(parsed).toHaveProperty('dataAtRisk');
    });

    it('handles leading/trailing whitespace', () => {
      const raw = '   \n  {"dataAtRisk":[],"attackerGoal":"a","exploitVector":"b","recommendation":"c"}   ';
      const extracted = extractJson(raw);
      expect(() => JSON.parse(extracted)).not.toThrow();
    });

    it('extracts JSON when surrounded by prose', () => {
      const raw = 'Sure, here is my analysis:\n{"dataAtRisk":["password"],"attackerGoal":"steal creds","exploitVector":"phishing form","recommendation":"leave now"}\nHope that helps!';
      const extracted = extractJson(raw);
      const parsed = JSON.parse(extracted) as Record<string, unknown>;
      expect(parsed['attackerGoal']).toBe('steal creds');
    });

    it('throws when no JSON object is present', () => {
      expect(() => extractJson('No JSON here at all')).toThrow();
    });
  });

  describe('validateReport', () => {
    it('validates a well-formed object', () => {
      const obj = {
        dataAtRisk:    ['email', 'password'],
        attackerGoal:   'harvest credentials',
        exploitVector:  'phishing form submission',
        recommendation: 'Do not enter credentials',
      };
      const report = validateReport(obj);
      expect(report.dataAtRisk).toEqual(['email', 'password']);
      expect(report.attackerGoal).toBe('harvest credentials');
    });

    it('throws on missing dataAtRisk', () => {
      const obj = { attackerGoal: 'a', exploitVector: 'b', recommendation: 'c' };
      expect(() => validateReport(obj)).toThrow('Missing dataAtRisk');
    });

    it('throws on missing attackerGoal', () => {
      const obj = { dataAtRisk: [], exploitVector: 'b', recommendation: 'c' };
      expect(() => validateReport(obj)).toThrow('Missing attackerGoal');
    });

    it('throws on missing exploitVector', () => {
      const obj = { dataAtRisk: [], attackerGoal: 'a', recommendation: 'c' };
      expect(() => validateReport(obj)).toThrow('Missing exploitVector');
    });

    it('throws on missing recommendation', () => {
      const obj = { dataAtRisk: [], attackerGoal: 'a', exploitVector: 'b' };
      expect(() => validateReport(obj)).toThrow('Missing recommendation');
    });

    it('throws when null is passed', () => {
      expect(() => validateReport(null)).toThrow('Not an object');
    });

    it('throws when a string is passed', () => {
      expect(() => validateReport('{"x":1}')).toThrow('Not an object');
    });

    it('coerces dataAtRisk elements to strings', () => {
      const obj = { dataAtRisk: [1, true, 'text'], attackerGoal: 'a', exploitVector: 'b', recommendation: 'c' };
      const report = validateReport(obj);
      expect(report.dataAtRisk).toEqual(['1', 'true', 'text']);
    });
  });
});

// ─── Offline Fallback Logic ───────────────────────────────────────────────────

describe('attacker-view offline fallback', () => {
  it('produces a valid AttackerViewReport for a high-risk report', () => {
    const report = makeReport({
      trustScore: 20,
      threatLevel: ThreatLevel.DANGER,
      fieldScan: {
        fields: [
          { kind: 'password', tag: 'input', type: 'password', name: 'pass', id: '', placeholder: '', formAction: '', formActionIsHttps: true, isThirdPartyAction: false },
          { kind: 'credit_card', tag: 'input', type: 'text', name: 'cc', id: '', placeholder: '', formAction: '', formActionIsHttps: true, isThirdPartyAction: false },
        ],
        highRisk: true,
        formCount: 1,
      },
    });

    // Simulate offline fallback logic
    const fields = [...new Set(report.fieldScan.fields.filter(f => f.kind !== 'unknown').map(f => f.kind.replace(/_/g, ' ')))];
    const fallback: AttackerViewReport = {
      dataAtRisk: fields.length > 0 ? fields : ['browsing behavior'],
      attackerGoal: report.trustScore < 40
        ? 'Harvest credentials or financial data through phishing or deceptive collection forms.'
        : 'Collect user behavioral and profile data for advertising or resale.',
      exploitVector: 'Data collection via form fields.',
      recommendation: 'Do not enter any personal information.',
    };

    expect(fallback.dataAtRisk).toContain('password');
    expect(fallback.dataAtRisk).toContain('credit card');
    expect(fallback.attackerGoal).toContain('credentials');
    expect(typeof fallback.exploitVector).toBe('string');
    expect(typeof fallback.recommendation).toBe('string');
  });

  it('falls back to generic data types when no sensitive fields present', () => {
    const report = makeReport({ fieldScan: { fields: [], highRisk: false, formCount: 0 } });
    const fields = [...new Set(report.fieldScan.fields.filter(f => f.kind !== 'unknown').map(f => f.kind.replace(/_/g, ' ')))];
    const dataAtRisk = fields.length > 0 ? fields : ['browsing behavior', 'IP address', 'device fingerprint'];
    expect(dataAtRisk).toContain('browsing behavior');
  });
});
