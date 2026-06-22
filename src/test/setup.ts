/// <reference types="vitest/globals" />

/**
 * Vitest Global Setup
 * Mocks Chrome Extension APIs for unit tests.
 */

// ─── Chrome API Mock ──────────────────────────────────────────────────────────

const chromeMock = {
  runtime: {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    lastError: undefined as chrome.runtime.LastError | undefined,
    getURL: (path: string) => `chrome-extension://test-id/${path}`,
  },
  storage: {
    sync: {
      get: vi.fn((_keys: string[], callback: (items: Record<string, unknown>) => void) => {
        callback({});
      }),
      set: vi.fn((_items: Record<string, unknown>, callback?: () => void) => {
        callback?.();
      }),
    },
  },
  tabs: {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    onRemoved: { addListener: vi.fn() },
    onUpdated: { addListener: vi.fn() },
    create: vi.fn().mockResolvedValue({ id: 1 }),
  },
  action: {
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn(),
  },
  downloads: {
    onCreated: { addListener: vi.fn() },
  },
  notifications: {
    create: vi.fn(),
  },
};

// Attach to global
(globalThis as Record<string, unknown>)['chrome'] = chromeMock;

// ─── import.meta.env mock ─────────────────────────────────────────────────────
Object.defineProperty(import.meta, 'env', {
  value: { DEV: true, MODE: 'test' },
  writable: true,
});
