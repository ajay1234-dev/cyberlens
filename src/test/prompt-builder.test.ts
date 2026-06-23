/**
 * Unit Tests — Prompt Builder
 */

import { describe, it, expect } from 'vitest';
import { buildMentorPrompt, buildAttackerPrompt } from '@/ai/prompt-builder';
import type { RiskReport } from '@/types/risk.types';
import { ThreatLevel, TacticType } from '@/types/risk.types';

// ─── Factory ──────────────────────────────────────────────────────────────────

function makeReport(overrides: Partial<RiskReport> = {}): RiskReport {
  return {
    url:         'https://example-shop.com/checkout',
    hostname:    'example-shop.com',
    analyzedAt:  Date.now(),
    threatLevel: ThreatLevel.WARNING,
    trustScore:  52,
    scoreBreakdown: { base: 65, psychDeduction: 18, fieldDeduction: 20, permissionDeduction: 0, downloadDeduction: 0, urlDeduction: 0, aiDeduction: 0, httpsBonus: 5, final: 32 },
    psychDetection: {
      tactics: [TacticType.URGENCY, TacticType.SCARCITY],
      instances: [
        { tactic: TacticType.URGENCY,  text: 'act now',       element: 'span' },
        { tactic: TacticType.SCARCITY, text: 'only 2 left',   element: 'p' },
      ],
    },
    fieldScan: {
      fields: [
        { kind: 'credit_card', tag: 'input', type: 'text', name: 'card_number', id: 'card', placeholder: '', formAction: 'https://example-shop.com/pay', formActionIsHttps: true, isThirdPartyAction: false },
        { kind: 'cvv', tag: 'input', type: 'text', name: 'cvv', id: 'cvv', placeholder: 'CVV', formAction: 'https://example-shop.com/pay', formActionIsHttps: true, isThirdPartyAction: false },
      ],
      highRisk: true,
      formCount: 1,
    },
    permissionScan: { requests: [], hasHighRiskPermissions: false },
    downloadScan:   { downloads: [], hasRiskyDownload: false },
    isHttps:        true,
    metaSignals:    { hasPrivacyPolicy: true, hasContactInfo: false, hasSecureForms: true, domainAge: 'unknown' },
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
    ...overrides,
  };
}

describe('prompt-builder', () => {

  describe('buildMentorPrompt', () => {
    it('includes the site hostname', () => {
      const prompt = buildMentorPrompt(makeReport());
      expect(prompt).toContain('example-shop.com');
    });

    it('includes the trust score', () => {
      const prompt = buildMentorPrompt(makeReport());
      expect(prompt).toContain('52/100');
    });

    it('includes HTTPS status when true', () => {
      const prompt = buildMentorPrompt(makeReport({ isHttps: true }));
      expect(prompt).toContain('HTTPS: yes');
    });

    it('includes HTTP warning when false', () => {
      const prompt = buildMentorPrompt(makeReport({ isHttps: false }));
      expect(prompt).toContain('HTTPS: no');
    });

    it('includes detected tactics', () => {
      const prompt = buildMentorPrompt(makeReport());
      expect(prompt).toContain('URGENCY');
      expect(prompt).toContain('SCARCITY');
    });

    it('shows "none" when no tactics', () => {
      const prompt = buildMentorPrompt(makeReport({ psychDetection: { tactics: [], instances: [] } }));
      expect(prompt).toContain('Manipulation tactics: none');
    });

    it('includes sensitive field types', () => {
      const prompt = buildMentorPrompt(makeReport());
      expect(prompt).toContain('credit_card');
      expect(prompt).toContain('cvv');
    });

    it('includes instruction to write 3 short paragraphs', () => {
      const prompt = buildMentorPrompt(makeReport());
      expect(prompt).toContain('3 short paragraphs');
    });

    it('includes score breakdown', () => {
      const prompt = buildMentorPrompt(makeReport());
      expect(prompt).toContain('Score: 52/100');
    });
  });

  describe('buildAttackerPrompt', () => {
    it('includes the site hostname', () => {
      const prompt = buildAttackerPrompt(makeReport());
      expect(prompt).toContain('example-shop.com');
    });

    it('includes the trust score', () => {
      const prompt = buildAttackerPrompt(makeReport());
      expect(prompt).toContain('52/100');
    });

    it('includes detected sensitive field types', () => {
      const prompt = buildAttackerPrompt(makeReport());
      expect(prompt).toContain('credit card');
      expect(prompt).toContain('cvv');
    });

    it('includes manipulation tactics', () => {
      const prompt = buildAttackerPrompt(makeReport());
      expect(prompt).toContain('urgency');
      expect(prompt).toContain('scarcity');
    });

    it('specifies JSON-only response requirement', () => {
      const prompt = buildAttackerPrompt(makeReport());
      expect(prompt).toContain('ONLY with this JSON');
      expect(prompt).toContain('no extra text');
    });

    it('includes required JSON field names in output format', () => {
      const prompt = buildAttackerPrompt(makeReport());
      expect(prompt).toContain('"dataAtRisk"');
      expect(prompt).toContain('"attackerGoal"');
      expect(prompt).toContain('"exploitVector"');
      expect(prompt).toContain('"recommendation"');
    });

    it('shows red team analyst persona', () => {
      const prompt = buildAttackerPrompt(makeReport());
      expect(prompt).toContain('red team');
    });

    it('shows "none" when no tactics detected', () => {
      const prompt = buildAttackerPrompt(makeReport({ psychDetection: { tactics: [], instances: [] } }));
      expect(prompt).toContain('Tactics: none');
    });

    it('shows "none" when no permissions requested', () => {
      const prompt = buildAttackerPrompt(makeReport());
      expect(prompt).toContain('Permissions: none');
    });

  });
});
