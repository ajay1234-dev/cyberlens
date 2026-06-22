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
    scoreBreakdown: { base: 100, psychDeduction: 18, fieldDeduction: 20, permissionDeduction: 0, downloadDeduction: 0, httpsBonus: 5, final: 52 },
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
    ...overrides,
  };
}

describe('prompt-builder', () => {

  describe('buildMentorPrompt', () => {
    it('includes the site URL', () => {
      const prompt = buildMentorPrompt(makeReport());
      expect(prompt).toContain('https://example-shop.com/checkout');
    });

    it('includes the trust score', () => {
      const prompt = buildMentorPrompt(makeReport());
      expect(prompt).toContain('52/100');
    });

    it('includes HTTPS status when true', () => {
      const prompt = buildMentorPrompt(makeReport({ isHttps: true }));
      expect(prompt).toContain('encrypted');
    });

    it('includes HTTP warning when false', () => {
      const prompt = buildMentorPrompt(makeReport({ isHttps: false }));
      expect(prompt).toContain('unencrypted');
    });

    it('includes detected tactics', () => {
      const prompt = buildMentorPrompt(makeReport());
      expect(prompt).toContain('Urgency');
      expect(prompt).toContain('Scarcity');
    });

    it('shows "None detected" when no tactics', () => {
      const prompt = buildMentorPrompt(makeReport({ psychDetection: { tactics: [], instances: [] } }));
      expect(prompt).toContain('None detected');
    });

    it('includes sensitive field types', () => {
      const prompt = buildMentorPrompt(makeReport());
      expect(prompt).toContain('credit card');
      expect(prompt).toContain('cvv');
    });

    it('includes the system persona', () => {
      const prompt = buildMentorPrompt(makeReport());
      expect(prompt).toContain('GuardianEye');
      expect(prompt).toContain('cybersecurity mentor');
    });

    it('includes instruction to write 3-4 paragraphs', () => {
      const prompt = buildMentorPrompt(makeReport());
      expect(prompt).toContain('3 to 4 short paragraphs');
    });

    it('includes score breakdown', () => {
      const prompt = buildMentorPrompt(makeReport());
      expect(prompt).toContain('Final trust score');
    });

    it('includes privacy policy signal', () => {
      const prompt = buildMentorPrompt(makeReport());
      expect(prompt).toContain('Privacy Policy');
    });
  });

  describe('buildAttackerPrompt', () => {
    it('includes the site URL', () => {
      const prompt = buildAttackerPrompt(makeReport());
      expect(prompt).toContain('https://example-shop.com/checkout');
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
      expect(prompt).toContain('valid JSON');
      expect(prompt).toContain('no other text');
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
      expect(prompt).toContain('Manipulation Tactics Active: none');
    });

    it('shows "none" when no permissions requested', () => {
      const prompt = buildAttackerPrompt(makeReport());
      expect(prompt).toContain('Permissions Requested: none');
    });

    it('includes third-party form action flag', () => {
      const reportWithThirdParty = makeReport({
        fieldScan: {
          fields: [{ kind: 'email', tag: 'input', type: 'email', name: 'email', id: '', placeholder: '', formAction: 'https://tracker.io/collect', formActionIsHttps: true, isThirdPartyAction: true }],
          highRisk: false, formCount: 1,
        },
      });
      const prompt = buildAttackerPrompt(reportWithThirdParty);
      expect(prompt).toContain('Third-Party Form Actions: yes');
    });
  });
});
