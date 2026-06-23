/**
 * GuardianEye — Prompt Builder
 * Constructs AI prompts for the Mentor and Attacker-View modes.
 */

import type { RiskReport } from '@/types/risk.types';

// ─── Mentor Prompt ────────────────────────────────────────────────────────────

/**
 * Builds the human-friendly mentor analysis prompt.
 * The AI acts as a friendly security advisor explaining risks in plain English.
 */
export function buildMentorPrompt(report: RiskReport): string {
  const tactics = report.psychDetection.tactics.join(', ') || 'none';
  const fields = [...new Set(report.fieldScan.fields.map(f => f.kind))]
    .filter(k => k !== 'unknown').join(', ') || 'none';
  const perms = report.permissionScan.requests.map(r => r.kind).join(', ') || 'none';

  return `You are a friendly cybersecurity mentor. In 3 short paragraphs (max 150 words total), explain this website to a non-technical user.

Site: ${report.hostname} | Score: ${report.trustScore}/100 (${report.threatLevel}) | HTTPS: ${report.isHttps ? 'yes' : 'no'}
Manipulation tactics: ${tactics} | Sensitive fields: ${fields} | Permissions: ${perms}

Explain: 1) What risks exist, 2) What data is at risk, 3) One action the user should take now. Plain English only. No bullet points.`.trim();
}

// ─── Attacker-View Prompt ─────────────────────────────────────────────────────

/**
 * Builds the red-team / attacker perspective prompt.
 * The AI acts as a red team analyst and responds ONLY with valid JSON.
 */
export function buildAttackerPrompt(report: RiskReport): string {
  const highRiskFields = [...new Set(
    report.fieldScan.fields.filter(f => f.kind !== 'unknown').map(f => f.kind.replace(/_/g, ' '))
  )];
  const tactics = report.psychDetection.tactics.map(t => t.toLowerCase());

  return `You are a red team analyst. Respond ONLY with this JSON (no markdown, no extra text):
{"dataAtRisk":[],"attackerGoal":"","exploitVector":"","recommendation":""}

Page: ${report.hostname} | HTTPS: ${report.isHttps} | Score: ${report.trustScore}/100
Fields: ${highRiskFields.join(', ') || 'none'} | Tactics: ${tactics.join(', ') || 'none'} | Permissions: ${report.permissionScan.requests.map(r => r.kind).join(', ') || 'none'}`.trim();
}
