/**
 * GuardianEye — Risk Aggregator
 * Merges outputs of all 5 engines into a single RiskReport object.
 */

import { detectPsychTactics } from './psych-detector';
import { scanFields } from './field-scanner';
import { getPermissionScanResult } from './permission-engine';
import { getDownloadScanResult } from './download-analyzer';
import { computeTrustScore, detectMetaSignals, scoreToThreatLevel } from './trust-scorer';
import type { RiskReport } from '@/types/risk.types';
import { createLogger } from '@/utils/logger';

const log = createLogger('risk-aggregator');

/**
 * Aggregates all engine results into a single RiskReport.
 * Runs psych detection and field scanning on the live DOM.
 * Permission and download scans read from their cached state.
 *
 * @param url - The current page URL
 */
export async function aggregateRisks(url: string): Promise<RiskReport> {
  log.info('Aggregating risks for', url);

  let hostname = url;
  let isHttps = false;

  try {
    const parsed = new URL(url);
    hostname = parsed.hostname;
    isHttps = parsed.protocol === 'https:';
  } catch {
    log.warn('Could not parse URL', url);
  }

  // ── Run Engines ──────────────────────────────────────────────────────────────
  const psychDetection   = detectPsychTactics(document.body);
  const fieldScan        = scanFields(document);
  const permissionScan   = getPermissionScanResult();
  const downloadScan     = getDownloadScanResult();
  const metaSignals      = detectMetaSignals(document, isHttps);

  // ── Compute Trust Score ──────────────────────────────────────────────────────
  const scoreBreakdown = computeTrustScore({
    psychDetection,
    fieldScan,
    permissionScan,
    downloadScan,
    isHttps,
    metaSignals,
  });

  const trustScore  = scoreBreakdown.final;
  const threatLevel = scoreToThreatLevel(trustScore);

  const report: RiskReport = {
    url,
    hostname,
    analyzedAt: Date.now(),
    threatLevel,
    trustScore,
    scoreBreakdown,
    psychDetection,
    fieldScan,
    permissionScan,
    downloadScan,
    isHttps,
    metaSignals,
  };

  log.info(`Risk aggregation complete — score=${trustScore}, level=${threatLevel}`);

  return report;
}
