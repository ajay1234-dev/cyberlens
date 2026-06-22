/**
 * GuardianEye — DOM Observer
 * MutationObserver watching for new forms and significant DOM changes.
 * Debounces re-runs to once per 2 seconds to avoid thrashing.
 */

import { createLogger } from '@/utils/logger';

const log = createLogger('observer');

// ─── Types ────────────────────────────────────────────────────────────────────

type RescanCallback = () => void;

// ─── DOM Observer ─────────────────────────────────────────────────────────────

class DOMObserver {
  private observer: MutationObserver | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly debounceMs: number;
  private readonly onRescan: RescanCallback;

  constructor(onRescan: RescanCallback, debounceMs = 2_000) {
    this.onRescan = onRescan;
    this.debounceMs = debounceMs;
  }

  /**
   * Start observing the document body for DOM mutations.
   */
  start(): void {
    if (this.observer) {
      log.debug('Observer already running');
      return;
    }

    this.observer = new MutationObserver(this.handleMutations.bind(this));

    this.observer.observe(document.body, {
      childList:  true,
      subtree:    true,
      attributes: false, // Avoid noisy attribute changes
    });

    log.info('MutationObserver started');
  }

  /**
   * Stop observing and clean up.
   */
  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
      log.info('MutationObserver stopped');
    }

    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private handleMutations(mutations: MutationRecord[]): void {
    const isSignificant = mutations.some(m => this.isSignificantMutation(m));
    if (!isSignificant) return;

    this.scheduleRescan();
  }

  private isSignificantMutation(mutation: MutationRecord): boolean {
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const el = node as Element;

      // New form added
      if (el.tagName === 'FORM' || el.querySelector('form')) return true;

      // New input field added
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) return true;
      if (el.querySelector('input, select, textarea')) return true;

      // Large content blocks (e.g., SPA route change)
      if (el.tagName === 'MAIN' || el.tagName === 'ARTICLE' || el.tagName === 'SECTION') return true;
      if (el.id === 'root' || el.id === 'app' || el.id === '__next') return true;

      // Elements with significant text content
      const textLength = el.textContent?.length ?? 0;
      if (textLength > 500) return true;
    }

    return false;
  }

  private scheduleRescan(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      log.debug('Debounced rescan triggered');
      try {
        this.onRescan();
      } catch (err) {
        log.error('Rescan callback threw an error', err);
      }
    }, this.debounceMs);
  }
}

// ─── Module-level instance ────────────────────────────────────────────────────

let activeObserver: DOMObserver | null = null;

/**
 * Install the MutationObserver. Call once in the content script.
 *
 * @param onRescan - Callback invoked (debounced) when significant DOM changes occur.
 */
export function installObserver(onRescan: RescanCallback): void {
  if (activeObserver) {
    activeObserver.stop();
  }

  activeObserver = new DOMObserver(onRescan, 2_000);
  activeObserver.start();
}

/**
 * Uninstall the MutationObserver. Call on page unload.
 */
export function uninstallObserver(): void {
  if (activeObserver) {
    activeObserver.stop();
    activeObserver = null;
  }
}
