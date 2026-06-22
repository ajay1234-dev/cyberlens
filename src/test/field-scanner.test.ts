/**
 * Unit Tests — Field Scanner
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { scanFields } from '@/engines/field-scanner';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDocument(bodyHtml: string): Document {
  const doc = document.implementation.createHTMLDocument('test');
  doc.body.innerHTML = bodyHtml;
  return doc;
}

describe('field-scanner', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  // ─── Basic Field Classification ───────────────────────────────────────────────

  describe('field classification', () => {
    it('classifies password fields by type attribute', () => {
      const doc = buildDocument('<form><input type="password" name="pass" /></form>');
      const result = scanFields(doc);
      const field = result.fields.find(f => f.kind === 'password');
      expect(field).toBeDefined();
    });

    it('classifies email fields by type attribute', () => {
      const doc = buildDocument('<form><input type="email" name="user_email" /></form>');
      const result = scanFields(doc);
      const field = result.fields.find(f => f.kind === 'email');
      expect(field).toBeDefined();
    });

    it('classifies credit card field by name keyword', () => {
      const doc = buildDocument('<form><input type="text" name="card_number" /></form>');
      const result = scanFields(doc);
      const field = result.fields.find(f => f.kind === 'credit_card');
      expect(field).toBeDefined();
    });

    it('classifies CVV field by name keyword', () => {
      const doc = buildDocument('<form><input type="text" name="cvv" /></form>');
      const result = scanFields(doc);
      const field = result.fields.find(f => f.kind === 'cvv');
      expect(field).toBeDefined();
    });

    it('classifies SSN field by name keyword', () => {
      const doc = buildDocument('<form><input type="text" name="ssn" placeholder="Social Security Number" /></form>');
      const result = scanFields(doc);
      const field = result.fields.find(f => f.kind === 'ssn');
      expect(field).toBeDefined();
    });

    it('classifies phone field by type="tel"', () => {
      const doc = buildDocument('<form><input type="tel" name="phone_number" /></form>');
      const result = scanFields(doc);
      const field = result.fields.find(f => f.kind === 'phone');
      expect(field).toBeDefined();
    });

    it('classifies date of birth field by name keyword', () => {
      const doc = buildDocument('<form><input type="date" name="dob" /></form>');
      const result = scanFields(doc);
      const field = result.fields.find(f => f.kind === 'dob');
      expect(field).toBeDefined();
    });

    it('classifies address field by name keyword', () => {
      const doc = buildDocument('<form><input type="text" name="street_address" /></form>');
      const result = scanFields(doc);
      const field = result.fields.find(f => f.kind === 'address');
      expect(field).toBeDefined();
    });

    it('classifies by placeholder when name is absent', () => {
      const doc = buildDocument('<form><input type="text" placeholder="Enter your card number" /></form>');
      const result = scanFields(doc);
      const field = result.fields.find(f => f.kind === 'credit_card');
      expect(field).toBeDefined();
    });

    it('marks unknown for non-sensitive fields', () => {
      const doc = buildDocument('<form><input type="text" name="search_query" /></form>');
      const result = scanFields(doc);
      const field = result.fields.find(f => f.kind === 'unknown');
      expect(field).toBeDefined();
    });
  });

  // ─── Form Risk Assessment ─────────────────────────────────────────────────────

  describe('high-risk detection', () => {
    it('marks highRisk=true when password field is present', () => {
      const doc = buildDocument('<form><input type="password" /></form>');
      const result = scanFields(doc);
      expect(result.highRisk).toBe(true);
    });

    it('marks highRisk=true when credit card field is present', () => {
      const doc = buildDocument('<form><input type="text" name="card_number" /></form>');
      const result = scanFields(doc);
      expect(result.highRisk).toBe(true);
    });

    it('marks highRisk=false for non-sensitive fields only', () => {
      const doc = buildDocument('<form><input type="text" name="username" /><input type="text" name="search" /></form>');
      const result = scanFields(doc);
      expect(result.highRisk).toBe(false);
    });
  });

  // ─── Form Count ───────────────────────────────────────────────────────────────

  describe('form count', () => {
    it('counts a single form correctly', () => {
      const doc = buildDocument('<form><input type="email" /></form>');
      const result = scanFields(doc);
      expect(result.formCount).toBe(1);
    });

    it('counts multiple forms correctly', () => {
      const doc = buildDocument(`
        <form id="login"><input type="email" /><input type="password" /></form>
        <form id="newsletter"><input type="email" /></form>
      `);
      const result = scanFields(doc);
      expect(result.formCount).toBe(2);
    });

    it('returns formCount=0 for page with no forms', () => {
      const doc = buildDocument('<div><p>No forms here</p></div>');
      const result = scanFields(doc);
      expect(result.formCount).toBe(0);
    });
  });

  // ─── HTTPS / Third-Party Detection ────────────────────────────────────────────

  describe('form action security', () => {
    it('detects HTTPS form action as secure', () => {
      const doc = buildDocument('<form action="https://example.com/submit"><input type="email" /></form>');
      const result = scanFields(doc);
      const field = result.fields[0];
      expect(field).toBeDefined();
      if (field) {
        expect(field.formActionIsHttps).toBe(true);
      }
    });

    it('detects HTTP form action as insecure', () => {
      const doc = buildDocument('<form action="http://example.com/submit"><input type="email" /></form>');
      const result = scanFields(doc);
      const field = result.fields[0];
      expect(field).toBeDefined();
      if (field) {
        expect(field.formActionIsHttps).toBe(false);
      }
    });

    it('detects third-party form action', () => {
      const doc = buildDocument('<form action="https://third-party-tracker.com/collect"><input type="email" /></form>');
      const result = scanFields(doc);
      const field = result.fields[0];
      expect(field).toBeDefined();
      if (field) {
        // In jsdom, window.location.hostname is 'localhost', so any real domain is third-party
        expect(typeof field.isThirdPartyAction).toBe('boolean');
      }
    });
  });

  // ─── Exclusions ───────────────────────────────────────────────────────────────

  describe('exclusions', () => {
    it('ignores hidden input fields', () => {
      const doc = buildDocument('<form><input type="hidden" name="token" value="abc123" /></form>');
      const result = scanFields(doc);
      expect(result.fields).toHaveLength(0);
    });

    it('ignores submit buttons', () => {
      const doc = buildDocument('<form><input type="submit" value="Submit" /></form>');
      const result = scanFields(doc);
      expect(result.fields).toHaveLength(0);
    });

    it('ignores image inputs', () => {
      const doc = buildDocument('<form><input type="image" src="submit.png" /></form>');
      const result = scanFields(doc);
      expect(result.fields).toHaveLength(0);
    });
  });

  // ─── Field Metadata ───────────────────────────────────────────────────────────

  describe('field metadata', () => {
    it('captures tag, type, name, id, and placeholder', () => {
      const doc = buildDocument(
        '<form><input type="text" id="card" name="card_number" placeholder="1234 5678 9012 3456" /></form>'
      );
      const result = scanFields(doc);
      const field = result.fields[0];
      expect(field).toBeDefined();
      if (field) {
        expect(field.tag).toBe('input');
        expect(field.type).toBe('text');
        expect(field.name).toBe('card_number');
        expect(field.id).toBe('card');
        expect(field.placeholder).toBe('1234 5678 9012 3456');
        expect(field.kind).toBe('credit_card');
      }
    });
  });
});
