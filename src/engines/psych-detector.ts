/**
 * GuardianEye — Psychological Manipulation Detector
 * Scans page text for dark patterns: urgency, fear, scarcity, reward, pressure.
 */

import { TacticType } from '@/types/risk.types';
import type { PsychDetectionResult, TacticInstance } from '@/types/risk.types';
import { createLogger } from '@/utils/logger';

const log = createLogger('psych-detector');

// ─── Pattern Definitions ──────────────────────────────────────────────────────

interface TacticPattern {
  tactic: TacticType;
  patterns: RegExp[];
}

const TACTIC_PATTERNS: TacticPattern[] = [
  {
    tactic: TacticType.URGENCY,
    patterns: [
      /limited[\s-]time/gi,
      /expires?\s+in/gi,
      /act\s+now/gi,
      /hurry[!.]*/gi,
      /offer\s+ends/gi,
      /today\s+only/gi,
      /\d+\s*(hours?|minutes?|seconds?)\s+(left|remaining)/gi,
      /sale\s+ends/gi,
      /countdown/gi,
      /don['']t\s+wait/gi,
      /time\s+is\s+running\s+out/gi,
      /flash\s+sale/gi,
    ],
  },
  {
    tactic: TacticType.FEAR,
    patterns: [
      /account\s+suspended/gi,
      /verify\s+immediately/gi,
      /security\s+alert[!:]\s/gi,                  // "security alert!" not "security alert: here's how"
      /unauthorized\s+access\s+detected/gi,         // more specific
      /your\s+account\s+(has\s+been|is|was)\s+(compromised|hacked|locked)/gi,
      /suspicious\s+activity\s+detected/gi,         // more specific than just "suspicious activity"
      /immediately\s+confirm/gi,
      /your\s+(password|account|data)\s+(is\s+at\s+risk|has\s+been\s+breached)/gi,
      /critical\s+security\s+warning/gi,            // "critical security warning" not just "warning:"
      /virus\s+detected/gi,
      /malware\s+(found|detected)/gi,
      /your\s+computer\s+(is|has\s+been)\s+(infected|hacked)/gi,
      /action\s+required/gi,
    ],
  },
  {
    tactic: TacticType.SCARCITY,
    patterns: [
      /only\s+\d+\s+left/gi,
      /almost\s+gone/gi,
      /last\s+chance/gi,
      /selling\s+fast/gi,
      /\d+\s+remaining/gi,
      /low\s+stock/gi,
      /limited\s+stock/gi,
      /nearly\s+sold\s+out/gi,
      /few\s+left/gi,
      /limited\s+availability/gi,
      /exclusive\s+offer/gi,
    ],
  },
  {
    tactic: TacticType.REWARD,
    patterns: [
      /you['']?ve?\s+won/gi,
      /free\s+gift/gi,
      /claim\s+your\s+prize/gi,
      /congratulations[!.]*/gi,
      /you\s+(have\s+been\s+selected|are\s+a\s+winner)/gi,
      /reward\s+points/gi,
      /cash\s+prize/gi,
      /enter\s+to\s+win/gi,
      /lucky\s+winner/gi,
      /bonus\s+offer/gi,
      /gift\s+card/gi,
      /100%\s+free/gi,
    ],
  },
  {
    tactic: TacticType.PRESSURE,
    patterns: [
      /don['']t\s+miss\s+out/gi,
      /\d+\s+people\s+(are\s+)?(watching|viewing)/gi,
      /others?\s+are\s+viewing/gi,
      /\d+\s+people\s+bought/gi,
      /trending\s+now/gi,
      /popular\s+choice/gi,
      /\d+\s+(customers?|buyers?)\s+(are\s+)?(viewing|looking)/gi,
      /just\s+purchased\s+by/gi,
      /sold\s+\d+\s+times\s+today/gi,
      /high\s+demand/gi,
    ],
  },
];

// ─── Element CSS Selector Builder ─────────────────────────────────────────────

function buildSelector(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : '';
  const classes = element.className && typeof element.className === 'string'
    ? '.' + element.className.trim().split(/\s+/).slice(0, 2).join('.')
    : '';
  return `${tag}${id}${classes}`.slice(0, 80);
}

// ─── Text Chunk Extractor ─────────────────────────────────────────────────────

interface TextChunk {
  text: string;
  element: Element;
}

function extractTextChunks(root: Element): TextChunk[] {
  const chunks: TextChunk[] = [];
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'meta'].includes(tag)) {
          return NodeFilter.FILTER_REJECT;
        }
        const text = node.textContent?.trim() ?? '';
        return text.length > 2 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    }
  );

  let node: Node | null;
  while ((node = walker.nextNode()) !== null) {
    const text = node.textContent?.trim() ?? '';
    const parent = (node as Text).parentElement;
    if (text && parent) {
      chunks.push({ text, element: parent });
    }
  }

  return chunks;
}

// ─── Main Scanner ─────────────────────────────────────────────────────────────

/**
 * Scans the document body for psychological manipulation tactics.
 * Returns all detected tactic types and their specific instances.
 */
export function detectPsychTactics(root: Element = document.body): PsychDetectionResult {
  log.debug('Starting psychological tactic scan');

  const instances: TacticInstance[] = [];
  const detectedTactics = new Set<TacticType>();
  const chunks = extractTextChunks(root);

  for (const { text, element } of chunks) {
    for (const { tactic, patterns } of TACTIC_PATTERNS) {
      for (const pattern of patterns) {
        // Reset lastIndex for global regexes
        pattern.lastIndex = 0;
        const match = pattern.exec(text);
        if (match !== null) {
          detectedTactics.add(tactic);
          instances.push({
            tactic,
            text: match[0],
            element: buildSelector(element),
          });
          // One instance per pattern per chunk is enough — break inner loop
          break;
        }
      }
    }
  }

  // Also scan element attributes (title, aria-label, data-*)
  const allElements = root.querySelectorAll('[title],[aria-label],[data-label]');
  for (const el of allElements) {
    const attrText = [
      el.getAttribute('title'),
      el.getAttribute('aria-label'),
      el.getAttribute('data-label'),
    ].filter(Boolean).join(' ');

    for (const { tactic, patterns } of TACTIC_PATTERNS) {
      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        const match = pattern.exec(attrText);
        if (match !== null) {
          detectedTactics.add(tactic);
          instances.push({
            tactic,
            text: match[0],
            element: buildSelector(el),
          });
          break;
        }
      }
    }
  }

  log.info(`Psych scan complete — ${detectedTactics.size} tactic(s), ${instances.length} instance(s)`);

  return {
    tactics: Array.from(detectedTactics),
    instances,
  };
}
