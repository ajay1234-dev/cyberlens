/**
 * GuardianEye — Overlay Injector
 * Injects a floating warning banner using Shadow DOM when trust score < 40.
 * Shadow DOM prevents CSS conflicts with the host page.
 */

import { createLogger } from '@/utils/logger';

const log = createLogger('overlay-injector');

// ─── Constants ────────────────────────────────────────────────────────────────

const OVERLAY_HOST_ID = 'guardian-eye-overlay-host';

// ─── Shadow DOM Styles ────────────────────────────────────────────────────────

const OVERLAY_CSS = `
  :host {
    all: initial;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 20px;
    background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 50%, #b91c1c 100%);
    border-bottom: 2px solid #ef4444;
    box-shadow: 0 4px 24px rgba(239, 68, 68, 0.4);
    animation: slideDown 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes slideDown {
    from { transform: translateY(-100%); opacity: 0; }
    to   { transform: translateY(0);     opacity: 1; }
  }

  .left {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
  }

  .icon {
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon svg {
    width: 28px;
    height: 28px;
  }

  .text-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .title {
    font-size: 13px;
    font-weight: 700;
    color: #fef2f2;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }

  .subtitle {
    font-size: 11.5px;
    color: #fca5a5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .score-badge {
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(239,68,68,0.5);
    border-radius: 6px;
    padding: 3px 8px;
    font-size: 12px;
    font-weight: 700;
    color: #fca5a5;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .dismiss-btn {
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 6px;
    padding: 5px 10px;
    color: #fef2f2;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: background 0.15s ease;
    letter-spacing: 0.02em;
  }

  .dismiss-btn:hover {
    background: rgba(255,255,255,0.2);
  }

  .dismiss-btn:focus-visible {
    outline: 2px solid #fca5a5;
    outline-offset: 2px;
  }
`;

// ─── SVG Icon ─────────────────────────────────────────────────────────────────

const SHIELD_ALERT_SVG = `
  <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
`;

// ─── Banner HTML Builder ──────────────────────────────────────────────────────

function buildBannerHTML(score: number, hostname: string): string {
  return `
    <div class="banner" role="alert" aria-live="assertive">
      <div class="left">
        <div class="icon" aria-hidden="true">${SHIELD_ALERT_SVG}</div>
        <div class="text-group">
          <span class="title">⚠ GuardianEye — High Risk Site</span>
          <span class="subtitle">${escapeHtml(hostname)} may be attempting to manipulate or collect your data</span>
        </div>
      </div>
      <div class="score-badge" title="Trust Score">Score: ${score}/100</div>
      <button class="dismiss-btn" id="ge-dismiss" aria-label="Dismiss GuardianEye warning">
        Dismiss
      </button>
    </div>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Inject the danger overlay banner into the page using Shadow DOM.
 * Only injects when trust score < 40. Idempotent — won't double-inject.
 *
 * @param score    - The current trust score
 * @param hostname - The current site hostname
 */
export function injectOverlay(score: number, hostname: string): void {
  if (score >= 40) return;

  // Idempotency check
  if (document.getElementById(OVERLAY_HOST_ID)) {
    log.debug('Overlay already injected — skipping');
    return;
  }

  log.warn(`Injecting danger overlay for ${hostname} (score=${score})`);

  // Create host element
  const host = document.createElement('div');
  host.id = OVERLAY_HOST_ID;

  // Attach Shadow DOM (closed mode to prevent page script access)
  const shadow = host.attachShadow({ mode: 'closed' });

  // Inject styles
  const style = document.createElement('style');
  style.textContent = OVERLAY_CSS;
  shadow.appendChild(style);

  // Inject banner HTML
  const container = document.createElement('div');
  container.innerHTML = buildBannerHTML(score, hostname);
  shadow.appendChild(container);

  // Dismiss handler
  const dismissBtn = shadow.getElementById('ge-dismiss');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      removeOverlay();
      log.info('Overlay dismissed by user');
    });
  }

  // Insert at very top of body
  document.body.insertAdjacentElement('afterbegin', host);
  log.info('Danger overlay injected');
}

/**
 * Remove the overlay if it exists.
 */
export function removeOverlay(): void {
  const host = document.getElementById(OVERLAY_HOST_ID);
  if (host) {
    host.remove();
    log.debug('Overlay removed');
  }
}

/**
 * Check if the overlay is currently active.
 */
export function isOverlayActive(): boolean {
  return document.getElementById(OVERLAY_HOST_ID) !== null;
}
