/**
 * GuardianEye — URL Threat Analyzer (v2 — Complete Rewrite)
 * Comprehensive URL, domain, and pattern analysis engine.
 * Works entirely offline — no external API required.
 */

import { createLogger } from '@/utils/logger';
import type { UrlThreatResult, UrlThreatSignal } from '@/types/risk.types';

const log = createLogger('url-threat-analyzer');

// ─── Known safe/trusted domain list ───────────────────────────────────────────
// These domains are definitively safe and get a trust boost
const TRUSTED_DOMAINS = new Set([
  'google.com', 'google.co.in', 'youtube.com', 'gmail.com', 'docs.google.com',
  'drive.google.com', 'maps.google.com', 'accounts.google.com',
  'github.com', 'gitlab.com', 'stackoverflow.com', 'npmjs.com',
  'microsoft.com', 'live.com', 'outlook.com', 'office.com', 'azure.com',
  'apple.com', 'icloud.com',
  'amazon.com', 'amazon.in', 'aws.amazon.com', 'amazonaws.com',
  'netflix.com', 'spotify.com', 'twitch.tv',
  'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'linkedin.com',
  'whatsapp.com', 'meta.com',
  'wikipedia.org', 'wikimedia.org',
  'reddit.com', 'medium.com', 'substack.com',
  'paypal.com', 'stripe.com',
  'cloudflare.com', 'vercel.app', 'netlify.app',
  'mozilla.org', 'firefox.com',
  'w3.org', 'whatwg.org',
  'openai.com', 'anthropic.com', 'groq.com',
  'npmjs.com', 'nodejs.org', 'python.org',
  'flipkart.com', 'myntra.com', 'swiggy.com', 'zomato.com', 'ola.com',
  'paytm.com', 'phonepe.com', 'razorpay.com',
  'sbi.co.in', 'hdfcbank.com', 'icicibank.com', 'axisbank.com',
  'naukri.com', 'linkedin.com', 'indeed.com',
  'irctc.co.in', 'makemytrip.com', 'goibibo.com',
  'amtso.org',  // ← security testing org — but its phishing page IS malicious content
]);

// ─── Explicitly dangerous domain patterns ─────────────────────────────────────
const MALICIOUS_DOMAIN_PATTERNS: RegExp[] = [
  /phish/i,
  /malware/i,
  /ransomware/i,
  /trojan/i,
  /spyware/i,
];

// ─── Phishing keywords in URL path/query ──────────────────────────────────────
const PHISHING_PATH_PATTERNS: { pattern: RegExp; label: string; severity: UrlThreatSignal['severity']; score: number }[] = [
  { pattern: /phish/i,              label: 'URL contains "phishing"',             severity: 'critical', score: 90 },
  { pattern: /malware/i,            label: 'URL contains "malware"',              severity: 'critical', score: 90 },
  { pattern: /ransomware/i,         label: 'URL contains "ransomware"',           severity: 'critical', score: 90 },
  { pattern: /hack(ed|ing)/i,       label: 'URL contains hacking reference',      severity: 'high',     score: 55 },
  { pattern: /exploit/i,            label: 'URL contains "exploit"',              severity: 'high',     score: 55 },
  { pattern: /verify[-_]?account/i, label: 'Fake account verification in URL',    severity: 'high',     score: 50 },
  { pattern: /confirm[-_]?identity/i,label: 'Fake identity confirmation in URL',  severity: 'high',     score: 50 },
  { pattern: /update[-_]?payment/i, label: 'Fake payment update in URL',          severity: 'high',     score: 50 },
  { pattern: /secure[-_]?login/i,   label: 'Fake secure login page in URL',       severity: 'high',     score: 45 },
  { pattern: /account[-_]?suspend/i,label: 'Fake account suspension in URL',      severity: 'high',     score: 45 },
  { pattern: /\.php\?.*login/i,     label: 'PHP login redirect — phishing pattern', severity: 'medium', score: 30 },
  { pattern: /login[-_.]?redirect/i,label: 'Login redirect in URL',               severity: 'medium',   score: 30 },
  { pattern: /password[-_]?reset/i, label: 'Password reset in URL',               severity: 'low',      score: 10 },
];

// ─── Suspicious TLDs ──────────────────────────────────────────────────────────
const HIGH_RISK_TLDS = new Set([
  '.xyz', '.top', '.click', '.work', '.link', '.gq', '.ml', '.cf', '.ga',
  '.tk', '.pw', '.cc', '.su', '.ws', '.icu', '.fit', '.fun', '.uno',
  '.monster', '.cfd', '.bond', '.cyou', '.beauty', '.hair',
]);

const MEDIUM_RISK_TLDS = new Set([
  '.biz', '.info', '.online', '.site', '.website', '.store', '.shop',
]);

// ─── Brand impersonation ──────────────────────────────────────────────────────
const BRAND_IMPERSONATION: { brand: string; safeDomains: string[]; pattern: RegExp }[] = [
  { brand: 'PayPal',    safeDomains: ['paypal.com', 'paypal.me'],                                                           pattern: /paypal/i },
  { brand: 'Google',    safeDomains: ['google.com', 'google.co.in', 'googleapis.com', 'gstatic.com', 'youtube.com', 'gmail.com'], pattern: /g[o0][o0]gle/i },
  { brand: 'Apple',     safeDomains: ['apple.com', 'icloud.com', 'itunes.com'],                                             pattern: /apple/i },
  { brand: 'Microsoft', safeDomains: ['microsoft.com', 'live.com', 'outlook.com', 'office.com', 'windows.com', 'azure.com', 'msn.com'], pattern: /micr[o0]s[o0]ft/i },
  { brand: 'Amazon',    safeDomains: ['amazon.com', 'amazon.in', 'amazonaws.com'],                                          pattern: /amaz[o0]n/i },
  { brand: 'Netflix',   safeDomains: ['netflix.com'],                                                                       pattern: /netfl[i1]x/i },
  { brand: 'Facebook',  safeDomains: ['facebook.com', 'fb.com', 'instagram.com', 'meta.com', 'whatsapp.com'],               pattern: /faceb[o0][o0]k/i },
  { brand: 'SBI',       safeDomains: ['sbi.co.in', 'onlinesbi.sbi'],                                                        pattern: /\bsbi\b/i },
  { brand: 'HDFC',      safeDomains: ['hdfcbank.com'],                                                                      pattern: /hdfc/i },
  { brand: 'ICICI',     safeDomains: ['icicibank.com'],                                                                     pattern: /icici/i },
];

// ─── IP-based URL detection ───────────────────────────────────────────────────
const IP_DOMAIN_PATTERN = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/;

// ─── Homograph / Unicode detection ───────────────────────────────────────────
const HOMOGRAPH_PATTERN = /[^\x00-\x7F]/;

// ─── Executable extensions ────────────────────────────────────────────────────
const MALICIOUS_EXTENSIONS = new Set(['exe', 'dll', 'bat', 'cmd', 'vbs', 'ps1', 'msi', 'scr', 'jar', 'sh', 'py']);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRootDomain(hostname: string): string {
  const parts = hostname.split('.');
  if (parts.length >= 2) return parts.slice(-2).join('.');
  return hostname;
}

function isTrustedDomain(hostname: string): boolean {
  const root = getRootDomain(hostname);
  // Check exact root domain match
  if (TRUSTED_DOMAINS.has(root)) return true;
  // Check if the full hostname ends with any trusted domain
  for (const trusted of TRUSTED_DOMAINS) {
    if (hostname === trusted || hostname.endsWith('.' + trusted)) return true;
  }
  return false;
}

// ─── Main Analyzer ────────────────────────────────────────────────────────────

export function analyzeUrl(rawUrl: string): UrlThreatResult {
  const signals: UrlThreatSignal[] = [];
  let isDefinitelyMalicious = false;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    log.warn('Could not parse URL for threat analysis', rawUrl);
    return { signals: [], totalDeduction: 0, isDefinitelyMalicious: false, summary: 'URL could not be parsed' };
  }

  const hostname = parsed.hostname.toLowerCase();
  const fullPath = (parsed.pathname + parsed.search).toLowerCase();

  // ── 1. Phishing keywords in URL path/query ──────────────────────────────────
  for (const { pattern, label, severity, score } of PHISHING_PATH_PATTERNS) {
    if (pattern.test(fullPath)) {
      signals.push({ type: 'phishing_keyword', description: label, severity, score });
      if (severity === 'critical') isDefinitelyMalicious = true;
    }
  }

  // ── 2. Malicious domain name patterns ───────────────────────────────────────
  for (const pattern of MALICIOUS_DOMAIN_PATTERNS) {
    if (pattern.test(hostname)) {
      signals.push({ type: 'phishing_keyword', description: `Domain name contains malicious keyword: "${pattern.source}"`, severity: 'critical', score: 90 });
      isDefinitelyMalicious = true;
    }
  }

  // ── 3. IP address as domain ─────────────────────────────────────────────────
  if (IP_DOMAIN_PATTERN.test(hostname)) {
    signals.push({ type: 'ip_domain', description: 'Site uses raw IP address instead of domain — classic phishing indicator', severity: 'high', score: 50 });
  }

  // ── 4. High-risk TLD ────────────────────────────────────────────────────────
  const tld = '.' + hostname.split('.').slice(-1)[0];
  if (HIGH_RISK_TLDS.has(tld)) {
    signals.push({ type: 'suspicious_tld', description: `High-risk TLD "${tld}" commonly used by malicious sites`, severity: 'high', score: 35 });
  } else if (MEDIUM_RISK_TLDS.has(tld)) {
    signals.push({ type: 'suspicious_tld', description: `Medium-risk TLD "${tld}" — verify site legitimacy`, severity: 'medium', score: 15 });
  }

  // ── 5. Excessive subdomains ─────────────────────────────────────────────────
  const subdomainCount = hostname.split('.').length - 2;
  if (subdomainCount >= 4) {
    signals.push({ type: 'excessive_subdomains', description: `Very deep subdomain chain (${subdomainCount} levels) — used to obscure real domain`, severity: 'high', score: 30 });
  }

  // ── 6. Brand impersonation ──────────────────────────────────────────────────
  for (const { brand, safeDomains, pattern } of BRAND_IMPERSONATION) {
    if (pattern.test(hostname)) {
      const isSafe = safeDomains.some(safe => hostname === safe || hostname.endsWith('.' + safe));
      if (!isSafe) {
        signals.push({ type: 'brand_impersonation', description: `Domain impersonates "${brand}" but is NOT an official ${brand} domain`, severity: 'critical', score: 80 });
        isDefinitelyMalicious = true;
      }
    }
  }

  // ── 7. Homograph/Unicode domain attack ─────────────────────────────────────
  if (HOMOGRAPH_PATTERN.test(hostname)) {
    signals.push({ type: 'homograph_attack', description: 'Domain contains non-ASCII characters — possible lookalike attack', severity: 'critical', score: 70 });
    isDefinitelyMalicious = true;
  }

  // ── 8. Punycode domain ──────────────────────────────────────────────────────
  if (hostname.startsWith('xn--') || hostname.includes('.xn--')) {
    signals.push({ type: 'punycode_domain', description: 'Punycode domain — may visually impersonate a trusted domain', severity: 'high', score: 55 });
    isDefinitelyMalicious = true;
  }

  // ── 9. Executable extension in path ─────────────────────────────────────────
  const ext = parsed.pathname.split('.').pop()?.toLowerCase() ?? '';
  if (MALICIOUS_EXTENSIONS.has(ext)) {
    signals.push({ type: 'malicious_extension', description: `URL path ends with executable ".${ext}" — potential malware delivery`, severity: 'high', score: 45 });
  }

  // ── 10. HTTP (not HTTPS) — flag but don't mark malicious ───────────────────
  if (parsed.protocol === 'http:') {
    signals.push({ type: 'suspicious_tld', description: 'Site uses insecure HTTP — data is not encrypted in transit', severity: 'low', score: 10 });
  }

  // ── 11. Suspicious login/verify patterns in subdomain ──────────────────────
  if (/\b(secure|login|verify|account|update|confirm|billing)\b/.test(hostname.replace(getRootDomain(hostname), ''))) {
    if (!isTrustedDomain(hostname)) {
      signals.push({ type: 'suspicious_subdomain', description: 'Subdomain mimics banking/account services (e.g. "secure-login" or "verify-account")', severity: 'high', score: 40 });
    }
  }

  // ─── Calculate totals ───────────────────────────────────────────────────────
  const totalDeduction = Math.min(signals.reduce((sum, s) => sum + s.score, 0), 100);
  const summary = signals.length === 0
    ? 'No URL-based threat signals detected'
    : `${signals.length} URL threat signal(s): ${signals.map(s => s.type).join(', ')}`;

  log.info(`URL analysis for ${hostname}: ${signals.length} signals, deduction=${totalDeduction}, malicious=${isDefinitelyMalicious}`);

  return { signals, totalDeduction, isDefinitelyMalicious, summary };
}

// ─── Export trust modifier for known-good sites ───────────────────────────────

export function getUrlTrustModifier(rawUrl: string): { trusted: boolean; boost: number } {
  try {
    const { hostname } = new URL(rawUrl);
    if (isTrustedDomain(hostname.toLowerCase())) {
      return { trusted: true, boost: 20 }; // Known safe domain gets a 20-point trust boost
    }
  } catch { /* ignore */ }
  return { trusted: false, boost: 0 };
}
