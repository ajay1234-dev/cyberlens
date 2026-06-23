/**
 * GuardianEye — Tab Manager
 * Per-tab RiskReport cache with 30-minute TTL and cleanup on tab close.
 */

import type { RiskReport } from '@/types/risk.types';
import { createLogger } from '@/utils/logger';

const log = createLogger('tab-manager');

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ─── Cache Entry ──────────────────────────────────────────────────────────────

interface CacheEntry {
  report:    RiskReport;
  storedAt:  number;
  tabId:     number;
}

// ─── Tab Manager ──────────────────────────────────────────────────────────────

class TabManager {
  private readonly cache = new Map<number, CacheEntry>();

  /**
   * Store or update the RiskReport for a tab.
   */
  setReport(tabId: number, report: RiskReport): void {
    this.cache.set(tabId, {
      report,
      storedAt: Date.now(),
      tabId,
    });
    log.debug(`Stored report for tab ${tabId} (score=${report.trustScore})`);
  }

  /**
   * Retrieve the RiskReport for a tab, respecting TTL.
   * Returns null if not found or expired.
   */
  getReport(tabId: number): RiskReport | null {
    const entry = this.cache.get(tabId);
    if (!entry) return null;

    const age = Date.now() - entry.storedAt;
    if (age > CACHE_TTL_MS) {
      log.debug(`Cache expired for tab ${tabId} (age=${Math.round(age / 1000)}s)`);
      this.cache.delete(tabId);
      return null;
    }

    return entry.report;
  }

  /**
   * Clear the cache for a specific tab.
   */
  clearTab(tabId: number): void {
    if (this.cache.has(tabId)) {
      this.cache.delete(tabId);
      log.debug(`Cache cleared for tab ${tabId}`);
    }
  }

  /**
   * Clear all cached entries.
   */
  clearAll(): void {
    this.cache.clear();
    log.info('All tab cache cleared');
  }

  /**
   * Check whether a valid (non-expired) report exists for a tab.
   */
  has(tabId: number): boolean {
    return this.getReport(tabId) !== null;
  }

  /**
   * Returns the number of active cached tabs.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Evict all expired entries. Call periodically to prevent memory leaks.
   */
  evictExpired(): void {
    const now = Date.now();
    let evicted = 0;
    for (const [tabId, entry] of this.cache) {
      if (now - entry.storedAt > CACHE_TTL_MS) {
        this.cache.delete(tabId);
        evicted++;
      }
    }
    if (evicted > 0) {
      log.debug(`Evicted ${evicted} expired cache entries`);
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const tabManager = new TabManager();

// ─── Tab Lifecycle Listeners ──────────────────────────────────────────────────

/**
 * Install chrome.tabs listeners to keep the cache clean.
 * Call this once inside the service worker.
 */
export function installTabListeners(): void {
  // Clear cache when a tab is closed
  chrome.tabs.onRemoved.addListener((tabId) => {
    tabManager.clearTab(tabId);
    log.debug(`Tab ${tabId} removed — cache cleared`);
  });

  // Clear cache when a tab navigates or reloads
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    // If the status is loading (page reload/navigation) or the URL explicitly changed (SPA)
    if (changeInfo.status === 'loading' || changeInfo.url !== undefined) {
      tabManager.clearTab(tabId);
      log.debug(`Tab ${tabId} navigated/reloaded — cache cleared`);
    }
  });

  // Periodic eviction every 10 minutes
  setInterval(() => {
    tabManager.evictExpired();
  }, 10 * 60 * 1000);

  log.info('Tab listeners installed');
}
