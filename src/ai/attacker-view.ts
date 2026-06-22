/**
 * GuardianEye — Attacker View
 * Generates a red-team perspective JSON report using Ollama.
 */

import { buildAttackerPrompt } from './prompt-builder';
import { fetchResponse, OllamaOfflineError } from './ollama-client';
import type { RiskReport, AttackerViewReport } from '@/types/risk.types';
import { createLogger } from '@/utils/logger';

const log = createLogger('attacker-view');

// ─── JSON Extraction ──────────────────────────────────────────────────────────

/**
 * Extract and parse the JSON object from the LLM response.
 * The model sometimes wraps JSON in markdown fences — strip those.
 */
function extractJson(raw: string): string {
  // Remove markdown code fences
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');

  // Find the first { and last } to isolate the JSON object
  const start = cleaned.indexOf('{');
  const end   = cleaned.lastIndexOf('}');

  if (start === -1 || end === -1 || end < start) {
    throw new Error('No valid JSON object found in model response');
  }

  return cleaned.slice(start, end + 1);
}

/**
 * Validate that the parsed object matches AttackerViewReport shape.
 */
function validateAttackerReport(obj: unknown): AttackerViewReport {
  if (typeof obj !== 'object' || obj === null) {
    throw new Error('Parsed JSON is not an object');
  }

  const record = obj as Record<string, unknown>;

  if (!Array.isArray(record['dataAtRisk'])) {
    throw new Error('Missing or invalid "dataAtRisk" array');
  }

  if (typeof record['attackerGoal'] !== 'string') {
    throw new Error('Missing or invalid "attackerGoal" string');
  }

  if (typeof record['exploitVector'] !== 'string') {
    throw new Error('Missing or invalid "exploitVector" string');
  }

  if (typeof record['recommendation'] !== 'string') {
    throw new Error('Missing or invalid "recommendation" string');
  }

  return {
    dataAtRisk:     (record['dataAtRisk'] as unknown[]).map(String),
    attackerGoal:    record['attackerGoal'],
    exploitVector:   record['exploitVector'],
    recommendation:  record['recommendation'],
  };
}

// ─── Offline Fallback ─────────────────────────────────────────────────────────

function buildOfflineAttackerReport(report: RiskReport): AttackerViewReport {
  const fields = [...new Set(report.fieldScan.fields.filter(f => f.kind !== 'unknown').map(f => f.kind.replace(/_/g, ' ')))];

  return {
    dataAtRisk: fields.length > 0
      ? fields
      : ['browsing behavior', 'IP address', 'device fingerprint'],
    attackerGoal:
      report.trustScore < 40
        ? 'Harvest credentials or financial data through phishing or deceptive collection forms.'
        : 'Collect user behavioral and profile data for advertising or resale.',
    exploitVector:
      report.psychDetection.tactics.length > 0
        ? `Psychological manipulation tactics (${report.psychDetection.tactics.join(', ').toLowerCase()}) used to compel hasty user action.`
        : 'Data collection via legitimate-appearing form fields without transparent disclosure.',
    recommendation:
      report.trustScore < 60
        ? 'Do not enter any personal information. Leave this page and navigate to the official website directly.'
        : 'Verify the site\'s identity before submitting any personal or financial information.',
  };
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Fetch and parse the attacker-perspective JSON report for a given RiskReport.
 *
 * @param report - The aggregated risk report
 * @returns Validated AttackerViewReport
 */
export async function getAttackerView(report: RiskReport): Promise<AttackerViewReport> {
  log.info('Requesting attacker view for', report.url);

  const prompt = buildAttackerPrompt(report);

  try {
    const rawResponse = await fetchResponse(prompt);
    log.debug('Raw attacker view response received', { length: rawResponse.length });

    const jsonStr = extractJson(rawResponse);
    const parsed  = JSON.parse(jsonStr) as unknown;
    const validated = validateAttackerReport(parsed);

    log.info('Attacker view parsed and validated successfully');
    return validated;
  } catch (err) {
    if (err instanceof OllamaOfflineError) {
      log.warn('Ollama offline — returning offline fallback attacker report');
      return buildOfflineAttackerReport(report);
    }

    log.error('Attacker view parse/fetch failed, using fallback', err);
    // For JSON parse or validation errors, also return a sensible fallback
    return buildOfflineAttackerReport(report);
  }
}
