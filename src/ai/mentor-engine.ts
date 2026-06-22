/**
 * GuardianEye — Mentor Engine
 * Streams an AI mentor analysis back token-by-token using Ollama.
 */

import { buildMentorPrompt } from './prompt-builder';
import { streamResponse, OllamaOfflineError } from './ollama-client';
import type { RiskReport } from '@/types/risk.types';
import { createLogger } from '@/utils/logger';

const log = createLogger('mentor-engine');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MentorStreamCallbacks {
  /** Called for each token as it arrives */
  onToken: (token: string) => void;
  /** Called with the complete text when streaming is done */
  onDone: (fullText: string) => void;
  /** Called if Ollama is offline or an error occurs */
  onError: (error: Error) => void;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

/**
 * Streams a mentor-style AI analysis for the given RiskReport.
 *
 * @param report    - The aggregated risk report for the current page
 * @param callbacks - Token/done/error callbacks
 */
export async function streamMentorAnalysis(
  report: RiskReport,
  callbacks: MentorStreamCallbacks
): Promise<void> {
  log.info('Starting mentor analysis stream for', report.url);

  const prompt = buildMentorPrompt(report);

  try {
    const fullText = await streamResponse(prompt, callbacks.onToken);
    log.info('Mentor analysis complete');
    callbacks.onDone(fullText);
  } catch (err) {
    if (err instanceof OllamaOfflineError) {
      log.warn('Ollama is offline — returning fallback mentor message');
      const fallback = buildOfflineFallbackMessage(report);
      callbacks.onToken(fallback);
      callbacks.onDone(fallback);
    } else {
      const error = err instanceof Error ? err : new Error(String(err));
      log.error('Mentor stream failed', error);
      callbacks.onError(error);
    }
  }
}

// ─── Offline Fallback ─────────────────────────────────────────────────────────

/**
 * A static, rule-based fallback message when Ollama is unavailable.
 * Provides basic guidance based on the trust score without AI.
 */
function buildOfflineFallbackMessage(report: RiskReport): string {
  const { trustScore, threatLevel, psychDetection, fieldScan, isHttps } = report;
  const tactics = psychDetection.tactics;
  const hasHighRiskFields = fieldScan.highRisk;

  const lines: string[] = [];

  lines.push(
    `GuardianEye has analyzed this page and assigned it a trust score of ${trustScore}/100 (${threatLevel}). ` +
    `The AI advisor is currently offline, so here is a summary based on automated analysis.`
  );

  if (!isHttps) {
    lines.push(
      `This page does not use HTTPS, which means any information you enter — including passwords or payment details — ` +
      `could be visible to others on the same network. Avoid entering sensitive information here.`
    );
  }

  if (tactics.length > 0) {
    lines.push(
      `The page contains ${tactics.length} psychological persuasion tactic(s) including ` +
      `${tactics.join(', ').toLowerCase()}. These techniques are designed to make you act quickly ` +
      `without thinking. Take a moment to pause before clicking anything.`
    );
  }

  if (hasHighRiskFields) {
    lines.push(
      `Sensitive data entry fields (such as passwords, payment details, or identity numbers) were detected. ` +
      `Before entering any personal information, verify that this is the legitimate site you intended to visit.`
    );
  }

  if (trustScore >= 80) {
    lines.push(`This site appears relatively trustworthy. Proceed with normal caution.`);
  } else if (trustScore >= 60) {
    lines.push(`Exercise caution on this site. Review what information you're being asked to provide.`);
  } else if (trustScore >= 40) {
    lines.push(`This site shows multiple warning signs. Be very cautious before interacting with it.`);
  } else {
    lines.push(
      `This site shows serious red flags. GuardianEye strongly recommends leaving this page immediately ` +
      `and not entering any personal information.`
    );
  }

  return lines.join('\n\n');
}
