/**
 * GuardianEye — Download Analyzer
 * Hooks chrome.downloads.onCreated in the service worker to flag risky files.
 * Also exports a standalone analyzeDownload() for direct analysis.
 */

import { DownloadRiskLevel } from '@/types/risk.types';
import type { DownloadRisk, DownloadScanResult } from '@/types/risk.types';
import type { DownloadFlaggedMessage } from '@/types/detection.types';
import { createLogger } from '@/utils/logger';

const log = createLogger('download-analyzer');

// ─── Dangerous Extension Lists ────────────────────────────────────────────────

const EXECUTABLE_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'com', 'msi', 'pif',
  'scr', 'vbs', 'vbe', 'js', 'jse', 'wsf',
  'wsh', 'ps1', 'ps2', 'psm1', 'reg',
  'lnk', 'jar', 'app', 'deb', 'rpm',
]);

const ARCHIVE_EXTENSIONS = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2']);
const DOCUMENT_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx']);

// MIME type to expected extension mapping
const MIME_EXTENSION_MAP: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/gif': ['gif'],
  'text/plain': ['txt'],
  'application/zip': ['zip'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractExtension(filename: string): string {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? (parts[parts.length - 1] ?? '') : '';
}

function extractAllExtensions(filename: string): string[] {
  return filename.toLowerCase().split('.').slice(1);
}

function hasDoubleExtension(filename: string): boolean {
  const extensions = extractAllExtensions(filename);
  if (extensions.length < 2) return false;
  const secondToLast = extensions[extensions.length - 2];
  const last = extensions[extensions.length - 1];
  // e.g. invoice.pdf.exe — last is executable, second-to-last is harmless
  return (
    EXECUTABLE_EXTENSIONS.has(last ?? '') &&
    (DOCUMENT_EXTENSIONS.has(secondToLast ?? '') || secondToLast === 'pdf')
  );
}

function isMimeMismatch(filename: string, mimeType: string): boolean {
  const ext = extractExtension(filename);
  const expectedExts = MIME_EXTENSION_MAP[mimeType.split(';')[0]?.trim() ?? ''];
  if (!expectedExts) return false; // Unknown MIME — can't determine mismatch
  return !expectedExts.includes(ext);
}

function hasExecutableInsideContainer(filename: string): boolean {
  const extensions = extractAllExtensions(filename);
  if (extensions.length < 2) return false;
  const outerExt = extensions[extensions.length - 1];
  // Container that hides an executable indication in the name
  if (!ARCHIVE_EXTENSIONS.has(outerExt ?? '') && !DOCUMENT_EXTENSIONS.has(outerExt ?? '')) {
    return false;
  }
  // If any inner extension looks executable (e.g., malware.exe.zip)
  return extensions.slice(0, -1).some(e => EXECUTABLE_EXTENSIONS.has(e));
}

// ─── Core Analyzer ────────────────────────────────────────────────────────────

/**
 * Analyze a single download item and return a risk assessment.
 */
export function analyzeDownload(item: {
  filename: string;
  url: string;
  mime?: string;
}): DownloadRisk {
  const filename = item.filename.split(/[\\/]/).pop() ?? item.filename;
  const mimeType = item.mime ?? 'application/octet-stream';
  const ext = extractExtension(filename);

  let riskLevel = DownloadRiskLevel.SAFE;
  const reasons: string[] = [];

  // Check: executable extension
  if (EXECUTABLE_EXTENSIONS.has(ext)) {
    riskLevel = DownloadRiskLevel.DANGEROUS;
    reasons.push(`The file has a dangerous executable extension (.${ext})`);
  }

  // Check: double extension (invoice.pdf.exe)
  if (hasDoubleExtension(filename)) {
    riskLevel = DownloadRiskLevel.DANGEROUS;
    reasons.push(
      `Double extension detected ("${filename}") — this is a common trick to disguise executables as documents`
    );
  }

  // Check: executable disguised inside archive/document name
  if (hasExecutableInsideContainer(filename)) {
    riskLevel = DownloadRiskLevel.DANGEROUS;
    reasons.push(`Executable extension found inside a container filename ("${filename}")`);
  }

  // Check: MIME type mismatch
  if (isMimeMismatch(filename, mimeType)) {
    if (riskLevel === DownloadRiskLevel.SAFE) riskLevel = DownloadRiskLevel.SUSPICIOUS;
    reasons.push(
      `MIME type mismatch: server reported "${mimeType}" but filename extension suggests otherwise`
    );
  }

  // Check: archive containing known bad patterns in filename
  // Note: no \b anchors — underscores are word chars, so payment_statement would fail \bpayment\b
  if (
    ARCHIVE_EXTENSIONS.has(ext) &&
    /(invoice|document|receipt|payment|order|statement)/i.test(filename) &&
    riskLevel === DownloadRiskLevel.SAFE
  ) {
    riskLevel = DownloadRiskLevel.SUSPICIOUS;
    reasons.push(
      `Archive file with a financial/document-themed name — commonly used in phishing campaigns`
    );
  }

  const explanation =
    reasons.length > 0
      ? reasons.join('. ') + '.'
      : 'This file appears safe based on its extension and MIME type.';

  log.info(`Download analyzed: ${filename} → ${riskLevel}`);

  return {
    filename,
    url: item.url,
    mimeType,
    riskLevel,
    explanation,
    detectedAt: Date.now(),
  };
}

// ─── Service Worker Hook ──────────────────────────────────────────────────────

const downloadHistory: DownloadRisk[] = [];

/**
 * Install the chrome.downloads.onCreated listener.
 * Call this once inside the service worker.
 */
export function installDownloadHook(): void {
  if (!chrome.downloads?.onCreated) {
    log.warn('chrome.downloads API not available');
    return;
  }

  chrome.downloads.onCreated.addListener((downloadItem) => {
    try {
      const risk = analyzeDownload({
        filename: downloadItem.filename,
        url: downloadItem.url,
        mime: downloadItem.mime,
      });

      downloadHistory.push(risk);

      if (risk.riskLevel !== DownloadRiskLevel.SAFE) {
        log.warn(`Risky download detected: ${downloadItem.filename}`, risk);

        // Notify popup if open
        const message: DownloadFlaggedMessage = {
          type: 'DOWNLOAD_FLAGGED',
          payload: risk,
        };

        chrome.runtime.sendMessage(message).catch(() => {
          // Popup may not be open — that's fine
        });

        // Show a browser notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'assets/icons/icon48.png',
          title: 'GuardianEye — Risky Download',
          message: `"${risk.filename}" may be dangerous. ${risk.explanation}`,
          priority: 2,
        });
      }
    } catch (err) {
      log.error('Error analyzing download', err);
    }
  });

  log.info('Download hook installed');
}

/**
 * Returns a snapshot of all analyzed downloads.
 */
export function getDownloadScanResult(): DownloadScanResult {
  return {
    downloads: [...downloadHistory],
    hasRiskyDownload: downloadHistory.some(d => d.riskLevel !== DownloadRiskLevel.SAFE),
  };
}

/**
 * Clear download history (e.g., on new session).
 */
export function resetDownloadHistory(): void {
  downloadHistory.length = 0;
}
