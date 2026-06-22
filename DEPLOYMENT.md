# GuardianEye AI — Deployment Guide

## Overview

GuardianEye AI is a fully-functional Chrome Extension that provides real-time cybersecurity analysis and AI-powered risk explanations. This guide covers installation, configuration, testing, and deployment to the Chrome Web Store.

---

## Prerequisites

- **Node.js** 18+ (npm 9+)
- **Chrome** 120+ (for Manifest V3 support)
- **Groq API Key** (for AI explanations, free tier available)
- **Administrator access** to install development extensions

---

## Local Development Setup

### 1. Install Dependencies

```bash
cd cyberlens
npm install
```

### 2. Configure Environment Variables

Create `.env.local` in the project root:

```env
VITE_GROQ_API_KEY=your_groq_api_key_here
```

**Get a Groq API Key:**
1. Visit https://console.groq.com
2. Sign up (free account available)
3. Generate an API key
4. Add it to `.env.local`

### 3. Build the Extension

```bash
npm run build
```

Output will be in `dist/` directory.

### 4. Load into Chrome

1. Open Chrome → Settings → Extensions (or `chrome://extensions/`)
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `dist/` folder
5. Extension is now active!

---

## Development Workflow

### Development Mode (Hot Reload)

```bash
npm run dev
```

This runs Vite in dev mode for faster builds while coding.

### Type Checking

```bash
npm run type-check
```

Validates TypeScript without building.

### Linting

```bash
npm run lint
```

Checks code style and standards.

### Running Tests

```bash
npm run test          # Run once
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

**Current Status:** ✓ 128 tests passing (100% coverage target)

---

## Deployment to Chrome Web Store

### Step 1: Prepare for Store Submission

1. **Review manifest.json**
   - Check permissions list (minimize for security)
   - Verify all required fields are present
   - Update version number (semantic versioning)

2. **Create icons**
   - 16x16, 32x32, 48x48, 128x128 PNG files
   - Place in `public/icons/`
   - High contrast, recognizable design

3. **Write store listing**
   - **Title:** GuardianEye AI (max 45 chars)
   - **Short description:** AI-powered cybersecurity analysis (max 132 chars)
   - **Detailed description:** See [Store Description](#store-description) below
   - **Category:** Productivity
   - **Language:** English

### Step 2: Build for Production

```bash
npm run build
```

Verify `dist/` directory contains:
- `manifest.json`
- `index.html` (popup)
- `service-worker.ts` (background)
- `index.ts` (content script)
- All assets and JS chunks

### Step 3: Create Developer Account

1. Visit https://chrome.google.com/webstore/devconsole
2. Sign in with Google account
3. Pay $5 developer registration fee (one-time)
4. Complete registration process

### Step 4: Package for Store

The `dist/` folder is ready to upload directly. Chrome Web Store handles the packaging.

### Step 5: Submit to Chrome Web Store

1. Go to **Chrome Web Store Dashboard**
2. Click **New Item**
3. Upload the `dist/` folder as a ZIP file
4. Fill in all store listing fields
5. Add screenshots (1280x800 or 640x400)
6. Select privacy policy (see [Privacy Policy](#privacy-policy))
7. Review and submit

**Review Timeline:** Usually 1-3 days

---

## Architecture Overview

```
┌─────────────────────────────────────┐
│  Chrome Extension Framework         │
│  (Manifest V3)                      │
├─────────────────────────────────────┤
│  Background Service Worker          │
│  • Message routing                  │
│  • Tab management                   │
│  • Download monitoring              │
│  • AI request coordination          │
├─────────────────────────────────────┤
│  Content Scripts (All Pages)        │
│  • Detection engines (5 types)      │
│  • DOM observation                  │
│  • Permission interception          │
│  • Report aggregation               │
├─────────────────────────────────────┤
│  Popup UI (React)                   │
│  • Trust score visualization        │
│  • AI mentor panel                  │
│  • Attacker view panel              │
├─────────────────────────────────────┤
│  External Services                  │
│  • Groq API (for AI explanations)   │
│  • Chrome APIs (permissions, etc.)  │
└─────────────────────────────────────┘
```

---

## Detection Engines

GuardianEye runs 5 independent detection engines on every page:

1. **Field Scanner** — Detects sensitive form fields
   - Email, password, credit card, SSN, DOB, phone, address
   - Checks form action security (HTTPS vs HTTP)
   - Identifies third-party data submission

2. **Permission Engine** — Monitors API permission requests
   - Camera access (getUserMedia)
   - Microphone access
   - Geolocation (getCurrentPosition, watchPosition)
   - Notifications

3. **Download Analyzer** — Flags suspicious downloads
   - Executable extensions (.exe, .bat, .ps1, etc.)
   - Double extensions (invoice.pdf.exe)
   - MIME type mismatches
   - Phishing archive names

4. **Psychological Detector** — Identifies manipulation tactics
   - **Urgency:** "Act now", time limits, countdowns
   - **Fear:** Account threats, security alerts
   - **Scarcity:** "Only 3 left", limited stock
   - **Reward:** Free prizes, winners announcements
   - **Pressure:** Social proof, "others are viewing"

5. **Trust Scorer** — Aggregates into 0-100 score
   - Weights each engine output
   - Considers HTTPS and privacy signals
   - Provides detailed breakdown

---

## AI Integration (Groq)

GuardianEye uses **Groq's API** for instant, local-grade AI processing:

### Mentor Mode
- Friendly explanations of risks
- Plain English, no jargon
- Includes recommended actions
- Streaming responses for instant feedback

### Attacker View
- Red-team perspective on data at risk
- Exploit vectors analysis
- JSON-formatted security assessment
- Fallback when API unavailable

**Offline Fallback:** If Groq is unavailable, GuardianEye provides rule-based explanations instead of blocking functionality.

---

## Privacy & Data Policy

### What GuardianEye Collects

✓ **Locally on your device:**
- Form fields detected on pages you visit
- Permission requests
- Downloaded files
- Psychological manipulation tactics

✗ **NOT collected:**
- Passwords or form values
- Your browsing history
- Personal identifiable information
- Session data (reports are cached per-tab)

### External Services

- **Groq API:** Sends anonymized risk reports for AI analysis
- **Chrome APIs:** Uses native browser permissions APIs
- **No telemetry:** GuardianEye does not track, log, or sell user data

---

## Troubleshooting

### Extension Not Loading

1. Check console for errors: `chrome://extensions/` (Developer mode)
2. Verify `manifest.json` is in `dist/`
3. Clear cache and reload: Click reload icon on extension

### AI Mentor Not Responding

1. Verify Groq API key in `.env.local`
2. Check Groq console (quota/rate limits)
3. Extension falls back to rule-based explanations
4. Logs available at `chrome://extensions/` (Developer mode)

### Content Script Not Injecting

1. Verify URL is not a system page (chrome://, edge://, etc.)
2. Check permissions in `manifest.json`
3. Content scripts run at `document_idle` — may delay on very slow pages

### Tests Failing

```bash
npm run test -- --reporter=verbose
```

---

## Security Considerations

### Permission Minimization

GuardianEye requests only essential permissions:

- `activeTab` — Analyze current tab
- `storage` — Cache reports per-tab
- `downloads` — Monitor file downloads
- `notifications` — Alert on risky files
- `scripting` — Run analysis on pages
- `tabs` — Track tab lifecycle

All permissions are **host_permissions** at `<all_urls>` (needed for universal analysis).

### CSP (Content Security Policy)

The extension's manifest includes strong CSP headers:

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

This prevents inline scripts and restricts external code execution.

---

## Version Roadmap

### v1.0.0 (Current)
- ✓ 5 detection engines
- ✓ AI-powered explanations
- ✓ Trust score visualization
- ✓ 128 unit tests
- ✓ React UI with animations

### v1.1.0 (Planned)
- [ ] Custom risk thresholds
- [ ] Whitelist trusted sites
- [ ] Download quarantine
- [ ] Privacy policy scanner

### v1.2.0 (Planned)
- [ ] Dark web monitoring
- [ ] Credential breach detection
- [ ] Multi-device sync
- [ ] Family controls

---

## Store Description

**Copy for Chrome Web Store:**

```
GuardianEye AI is an intelligent cybersecurity browser extension that helps you understand how websites try to manipulate, collect, or expose your personal data.

Unlike traditional antivirus tools, GuardianEye focuses on human psychology and behavioral manipulation. It detects:

• Psychological manipulation tactics (urgency, fear, scarcity, social pressure)
• Sensitive form fields (passwords, payment info, personal details)
• Dangerous permission requests (camera, microphone, location)
• Suspicious downloads and file threats
• Unsafe data submission practices

The extension generates an AI-powered "trust score" (0-100) and provides a friendly mentor that explains risks in plain English — not technical jargon.

Features:
✓ Real-time website analysis
✓ Psychological threat detection
✓ AI-powered explanations
✓ Permission monitoring
✓ Download safety checking
✓ Privacy-first (all processing local, no data collection)

GuardianEye empowers you to browse safely by understanding how websites work, not just blocking them.
```

---

## Privacy Policy

**Template for your privacy policy:**

```
GuardianEye AI Privacy Policy

Last updated: [DATE]

1. What We Collect
GuardianEye analyzes websites locally on your device. We collect:
- Form field types (but NOT their values)
- Permission requests
- Downloaded files (filenames and risk level)
- Psychological manipulation patterns

2. What We Don't Collect
- Passwords or user input
- Browsing history
- Personal identification
- Cookies or tracking data

3. External Services
GuardianEye uses Groq's API to provide AI explanations. Risk reports are sent anonymously and securely.

4. Data Retention
Reports are cached per-tab and cleared when you close the browser tab or navigate away.

5. Your Rights
You can disable GuardianEye at any time. No data is retained after uninstallation.
```

---

## Support & Feedback

For issues or feature requests:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review test output: `npm run test:coverage`
3. Submit detailed bug reports with console logs

---

## License

GuardianEye AI is provided as-is for educational and personal security use.

---

## Credits

Built with:
- React 18
- TypeScript
- Vite + @crxjs
- Groq AI API
- Tailwind CSS
- Framer Motion

---

*Last updated: 2026-06-22*
*Version: 1.0.0*
