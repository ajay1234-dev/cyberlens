/**
 * GuardianEye — Risk Aggregator
 * Merges outputs of all engines into a single RiskReport object.
 */

import { detectPsychTactics } from './psych-detector';
import { scanFields } from './field-scanner';
import { getPermissionScanResult } from './permission-engine';
import { getDownloadScanResult } from './download-analyzer';
import { computeTrustScore, detectMetaSignals, scoreToThreatLevel } from './trust-scorer';
import { analyzeUrl, getUrlTrustModifier } from './url-threat-analyzer';
import { analyzePageDynamically } from './ai-threat-analyzer';
import type { RiskReport } from '@/types/risk.types';
import { createLogger } from '@/utils/logger';

const log = createLogger('risk-aggregator');

export async function aggregateRisks(url: string): Promise<RiskReport> {
  log.info('Aggregating risks for', url);

  let hostname = url;
  let isHttps = false;

  try {
    const parsed = new URL(url);
    hostname = parsed.hostname;
    isHttps  = parsed.protocol === 'https:';
  } catch {
    log.warn('Could not parse URL', url);
  }

  // ── Run all engines in parallel where possible ───────────────────────────────
  const psychDetection = detectPsychTactics(document.body);
  const fieldScan      = scanFields(document);
  const permissionScan = getPermissionScanResult();
  const downloadScan   = getDownloadScanResult();
  const metaSignals    = detectMetaSignals(document, isHttps);
  const urlThreats     = analyzeUrl(url);
  const { trusted: isTrustedDomain } = getUrlTrustModifier(url);

  // AI analysis runs in parallel — if Ollama is offline it returns score=0
  const aiThreats = await analyzePageDynamically(url, document.body.innerText ?? '');

  if (urlThreats.signals.length > 0) {
    log.warn(`URL threats: ${urlThreats.summary}`);
  }
  if (aiThreats.isMalicious) {
    log.warn(`AI flagged site as malicious. Score: ${aiThreats.score}. Reason: ${aiThreats.reason}`);
  }

  // ── Compute Trust Score ───────────────────────────────────────────────────────
  const scoreBreakdown = computeTrustScore({
    psychDetection,
    fieldScan,
    permissionScan,
    downloadScan,
    isHttps,
    metaSignals,
    urlThreats,
    aiThreats,
    isTrustedDomain,
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
    urlThreats,
    aiThreats,
  };

  log.info(`Analysis complete — score=${trustScore}, level=${threatLevel}, trusted=${isTrustedDomain}`);
  return report;
}
