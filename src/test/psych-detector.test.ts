/**
 * Unit Tests — Psychological Manipulation Detector
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { detectPsychTactics } from '@/engines/psych-detector';
import { TacticType } from '@/types/risk.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeBody(html: string): Element {
  const div = document.createElement('div');
  div.innerHTML = html;
  document.body.appendChild(div);
  return div;
}

describe('psych-detector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  // ─── URGENCY ────────────────────────────────────────────────────────────────

  describe('URGENCY detection', () => {
    it('detects "limited time"', () => {
      makeBody('<p>This is a limited time offer!</p>');
      const result = detectPsychTactics(document.body);
      expect(result.tactics).toContain(TacticType.URGENCY);
    });

    it('detects "expires in"', () => {
      makeBody('<p>Offer expires in 24 hours</p>');
      const result = detectPsychTactics(document.body);
      expect(result.tactics).toContain(TacticType.URGENCY);
    });

    it('detects "act now"', () => {
      makeBody('<span>Act now to claim your discount!</span>');
      const result = detectPsychTactics(document.body);
      expect(result.tactics).toContain(TacticType.URGENCY);
    });

    it('detects "today only"', () => {
      makeBody('<h2>Today only — 70% off!</h2>');
      const result = detectPsychTactics(document.body);
      expect(result.tactics).toContain(TacticType.URGENCY);
    });

    it('detects "X hours left"', () => {
      makeBody('<p>Only 3 hours left to order!</p>');
      const result = detectPsychTactics(document.body);
      expect(result.tactics).toContain(TacticType.URGENCY);
    });
  });

  // ─── FEAR ───────────────────────────────────────────────────────────────────

  describe('FEAR detection', () => {
    it('detects "account suspended"', () => {
      makeBody('<div>Your account suspended — verify now</div>');
      const result = detectPsychTactics(document.body);
      expect(result.tactics).toContain(TacticType.FEAR);
    });

    it('detects "security alert"', () => {
      makeBody('<p>Security alert: unusual sign-in detected</p>');
      const result = detectPsychTactics(document.body);
      expect(result.tactics).toContain(TacticType.FEAR);
    });

    it('detects "action required"', () => {
      makeBody('<strong>Action required: confirm your email</strong>');
      const result = detectPsychTactics(document.body);
      expect(result.tactics).toContain(TacticType.FEAR);
    });

    it('detects "virus detected"', () => {
      makeBody('<div>Virus detected on your system! Click here to fix.</div>');
      const result = detectPsychTactics(document.body);
      expect(result.tactics).toContain(TacticType.FEAR);
    });
  });

  // ─── SCARCITY ────────────────────────────────────────────────────────────────

  describe('SCARCITY detection', () => {
    it('detects "only X left"', () => {
      makeBody('<span>Only 2 left in stock!</span>');
      const result = detectPsychTactics(document.body);
      expect(result.tactics).toContain(TacticType.SCARCITY);
    });

    it('detects "almost gone"', () => {
      makeBody('<p>Almost gone — grab yours now</p>');
      const result = detectPsychTactics(document.body);
      expect(result.tactics).toContain(TacticType.SCARCITY);
    });

    it('detects "last chance"', () => {
      makeBody('<h3>Last chance to buy!</h3>');
      const result = detectPsychTactics(document.body);
      expect(result.tactics).toContain(TacticType.SCARCITY);
    });
  });

  // ─── REWARD ─────────────────────────────────────────────────────────────────

  describe('REWARD detection', () => {
    it("detects \"you've won\"", () => {
      makeBody("<p>Congratulations! You've won a free gift!</p>");
      const result = detectPsychTactics(document.body);
      expect(result.tactics).toContain(TacticType.REWARD);
    });

    it('detects "claim your prize"', () => {
      makeBody('<a href="#">Claim your prize now</a>');
      const result = detectPsychTactics(document.body);
      expect(result.tactics).toContain(TacticType.REWARD);
    });

    it('detects "free gift"', () => {
      makeBody('<div>Get a free gift with every purchase!</div>');
      const result = detectPsychTactics(document.body);
      expect(result.tactics).toContain(TacticType.REWARD);
    });
  });

  // ─── PRESSURE ────────────────────────────────────────────────────────────────

  describe('PRESSURE detection', () => {
    it('detects "N people watching"', () => {
      makeBody('<span>15 people are watching this item</span>');
      const result = detectPsychTactics(document.body);
      expect(result.tactics).toContain(TacticType.PRESSURE);
    });

    it('detects "others are viewing"', () => {
      makeBody('<p>Others are viewing this right now</p>');
      const result = detectPsychTactics(document.body);
      expect(result.tactics).toContain(TacticType.PRESSURE);
    });

    it("detects \"don't miss out\"", () => {
      makeBody("<p>Don't miss out — join thousands of happy customers!</p>");
      const result = detectPsychTactics(document.body);
      expect(result.tactics).toContain(TacticType.PRESSURE);
    });
  });

  // ─── Clean Page ──────────────────────────────────────────────────────────────

  describe('clean page', () => {
    it('returns empty results for a page with no manipulation', () => {
      makeBody('<h1>Welcome to our store</h1><p>Browse our collection.</p>');
      const result = detectPsychTactics(document.body);
      expect(result.tactics).toHaveLength(0);
      expect(result.instances).toHaveLength(0);
    });
  });

  // ─── Multiple Tactics ─────────────────────────────────────────────────────────

  describe('multiple tactics', () => {
    it('detects multiple tactics on same page', () => {
      makeBody(`
        <p>Limited time offer!</p>
        <p>Only 3 left in stock!</p>
        <p>10 people are watching this</p>
      `);
      const result = detectPsychTactics(document.body);
      expect(result.tactics).toContain(TacticType.URGENCY);
      expect(result.tactics).toContain(TacticType.SCARCITY);
      expect(result.tactics).toContain(TacticType.PRESSURE);
      expect(result.tactics.length).toBeGreaterThanOrEqual(3);
    });

    it('deduplicates tactic types even with many instances', () => {
      makeBody(`
        <p>Act now!</p>
        <p>Hurry! Offer ends soon!</p>
        <p>Limited time sale! Today only!</p>
      `);
      const result = detectPsychTactics(document.body);
      // URGENCY should appear only once in tactics array despite multiple instances
      const urgencyCount = result.tactics.filter(t => t === TacticType.URGENCY).length;
      expect(urgencyCount).toBe(1);
    });
  });

  // ─── Instance Metadata ────────────────────────────────────────────────────────

  describe('instance metadata', () => {
    it('provides tactic, text and element selector for each instance', () => {
      makeBody('<div id="hero"><p>Act now to save!</p></div>');
      const result = detectPsychTactics(document.body);
      const urgencyInstances = result.instances.filter(i => i.tactic === TacticType.URGENCY);
      expect(urgencyInstances.length).toBeGreaterThan(0);
      const inst = urgencyInstances[0];
      expect(inst).toBeDefined();
      if (inst) {
        expect(typeof inst.text).toBe('string');
        expect(inst.text.length).toBeGreaterThan(0);
        expect(typeof inst.element).toBe('string');
      }
    });
  });

  // ─── Script/Style Exclusion ───────────────────────────────────────────────────

  describe('exclusions', () => {
    it('ignores text inside <script> tags', () => {
      makeBody('<script>var x = "act now limited time";</script><p>Normal content</p>');
      const result = detectPsychTactics(document.body);
      expect(result.tactics).toHaveLength(0);
    });

    it('ignores text inside <style> tags', () => {
      makeBody('<style>.act-now { color: red; }</style><p>Hello world</p>');
      const result = detectPsychTactics(document.body);
      expect(result.tactics).toHaveLength(0);
    });
  });
});
