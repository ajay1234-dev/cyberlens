/**
 * GuardianEye — Field Scanner
 * Walks all input/select/textarea elements to detect sensitive data collection.
 */

import type { FieldScan, FieldScanResult, SensitiveFieldKind } from '@/types/risk.types';
import { createLogger } from '@/utils/logger';

const log = createLogger('field-scanner');

// ─── Classification Rules ─────────────────────────────────────────────────────

interface FieldClassifier {
  kind: SensitiveFieldKind;
  /** Match against type attribute */
  types?: string[];
  /** Match against name/id/placeholder (case-insensitive) */
  keywords: RegExp;
}

const CLASSIFIERS: FieldClassifier[] = [
  {
    kind: 'password',
    types: ['password'],
    keywords: /password|passphrase|secret|pin\b/i,
  },
  {
    kind: 'credit_card',
    types: ['tel', 'number', 'text'],
    keywords: /card[\s_-]?(number|num|no)|credit[\s_-]?card|cc[\s_-]?num|cardno/i,
  },
  {
    kind: 'cvv',
    types: ['tel', 'number', 'text'],
    keywords: /\bcvv\b|\bcvc\b|\bcsc\b|security[\s_-]?code|card[\s_-]?code/i,
  },
  {
    kind: 'ssn',
    types: ['tel', 'number', 'text'],
    keywords: /\bssn\b|social[\s_-]?security|national[\s_-]?id|taxpayer[\s_-]?id/i,
  },
  {
    kind: 'dob',
    types: ['date', 'text'],
    keywords: /\bdob\b|date[\s_-]?of[\s_-]?birth|birth[\s_-]?(date|day|year)|born/i,
  },
  {
    kind: 'phone',
    types: ['tel'],
    keywords: /phone|mobile|cell|telephone|contact[\s_-]?number/i,
  },
  {
    kind: 'email',
    types: ['email'],
    keywords: /email|e[\s_-]?mail/i,
  },
  {
    kind: 'address',
    types: ['text'],
    keywords: /address|street|city|state|zip[\s_-]?code|postal[\s_-]?code|apt\b|suite\b/i,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classifyField(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): SensitiveFieldKind {
  const type = (el instanceof HTMLInputElement ? el.type : '').toLowerCase();
  const searchStr = [
    el.name,
    el.id,
    (el instanceof HTMLInputElement ? el.placeholder : ''),
    el.getAttribute('autocomplete') ?? '',
    el.getAttribute('aria-label') ?? '',
  ].join(' ').toLowerCase();

  for (const classifier of CLASSIFIERS) {
    const typeMatch = classifier.types === undefined || classifier.types.includes(type) || type === '';
    const keywordMatch = classifier.keywords.test(searchStr);

    // Password type is always password
    if (type === 'password') return 'password';
    // Email type is always email
    if (type === 'email') return 'email';

    if (typeMatch && keywordMatch) return classifier.kind;
  }

  return 'unknown';
}

function getFormAction(el: Element): { action: string; isHttps: boolean; isThirdParty: boolean } {
  const form = el.closest('form');
  if (!form) {
    return { action: '', isHttps: true, isThirdParty: false };
  }

  const action = form.action ?? '';
  let isHttps = true;
  let isThirdParty = false;

  if (action) {
    try {
      const actionUrl = new URL(action);
      isHttps = actionUrl.protocol === 'https:';
      isThirdParty = actionUrl.hostname !== window.location.hostname;
    } catch {
      // Relative URL — inherits page protocol
      isHttps = window.location.protocol === 'https:';
    }
  } else {
    // No action = submits to self
    isHttps = window.location.protocol === 'https:';
  }

  return { action, isHttps, isThirdParty };
}

const HIGH_RISK_KINDS: SensitiveFieldKind[] = ['password', 'credit_card', 'cvv', 'ssn'];

// ─── Main Scanner ─────────────────────────────────────────────────────────────

/**
 * Scans all input/select/textarea elements on the page for sensitive data fields.
 */
export function scanFields(doc: Document = document): FieldScanResult {
  log.debug('Starting field scan');

  const selector = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), select, textarea';
  const elements = doc.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selector);

  const fields: FieldScan[] = [];
  const formSet = new Set<HTMLFormElement>();
  let hasHighRisk = false;

  for (const el of elements) {
    const kind = classifyField(el);
    const { action, isHttps, isThirdParty } = getFormAction(el);

    // Track unique forms
    const form = el.closest('form');
    if (form instanceof HTMLFormElement) formSet.add(form);

    if (HIGH_RISK_KINDS.includes(kind)) hasHighRisk = true;

    const field: FieldScan = {
      kind,
      tag: el.tagName.toLowerCase(),
      type: el instanceof HTMLInputElement ? el.type : el.tagName.toLowerCase(),
      name: el.name,
      id: el.id,
      placeholder: el instanceof HTMLInputElement ? (el.placeholder ?? '') : '',
      formAction: action,
      formActionIsHttps: isHttps,
      isThirdPartyAction: isThirdParty,
    };

    fields.push(field);
  }

  log.info(`Field scan complete — ${fields.length} field(s), ${formSet.size} form(s), highRisk=${hasHighRisk}`);

  return {
    fields,
    highRisk: hasHighRisk,
    formCount: formSet.size,
  };
}
