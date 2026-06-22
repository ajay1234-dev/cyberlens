# GuardianEye AI — Development Guide

## For Developers

This guide covers the internal architecture, design patterns, and guidelines for developing GuardianEye.

---

## Architecture Philosophy

GuardianEye follows a **layered, event-driven architecture**:

1. **Content Script Layer** — Runs on every page
   - Detects threats using 5 independent engines
   - Aggregates into a unified RiskReport
   - Reports to background worker

2. **Background Service Worker** — Orchestrates everything
   - Receives reports from content scripts
   - Routes requests to AI services
   - Manages per-tab caching

3. **Popup UI Layer** — Displays analysis to user
   - Consumes reports from background
   - Triggers AI analysis on demand
   - Shows real-time streaming responses

4. **AI Integration Layer** — Powers explanations
   - Communicates with Groq API
   - Handles streaming and JSON parsing
   - Provides offline fallbacks

---

## Detection Engines: Deep Dive

### 1. Field Scanner (`src/engines/field-scanner.ts`)

**Purpose:** Identify sensitive form fields on the page.

**Algorithm:**
1. Query all `<input>`, `<select>`, `<textarea>` elements
2. For each field, classify by:
   - `type` attribute (e.g., `type="password"`)
   - name/id/placeholder matching regex patterns
   - autocomplete attribute
   - aria-label

**Classification Rules:**
- `password` — type="password" or keyword match
- `email` — type="email" or "email" keyword
- `credit_card` — "card number", "cc num", etc.
- `cvv` — "cvv", "cvc", "security code"
- `ssn` — "ssn", "social security"
- `dob` — "date of birth", "born", etc.
- `phone` — type="tel" or "phone" keyword
- `address` — "street", "city", "zip", etc.

**Risk Scoring:**
- High-risk fields (password, credit_card, cvv, ssn) trigger `highRisk` flag
- Form submission to HTTP (unencrypted) increases deduction
- Third-party submission (different domain) increases deduction

**Test Cases:** 18 tests covering classification, risk detection, form tracking

---

### 2. Permission Engine (`src/engines/permission-engine.ts`)

**Purpose:** Intercept and monitor permission requests.

**How It Works:**
Uses prototype patching (not API hooking) to intercept:

```javascript
navigator.mediaDevices.getUserMedia() → intercepts camera/mic requests
navigator.geolocation.getCurrentPosition() → intercepts location
Notification.requestPermission() → intercepts notifications
```

**Key Points:**
- Patches must run BEFORE page scripts (content script lifecycle)
- Records timestamp, permission type, allowed/denied status
- Notifies background worker of suspicious requests
- Permissions remain allowed (doesn't block user interaction)

**Risk Assessment:**
- Camera: 10 points deduction
- Microphone: 8 points
- Geolocation: 7 points
- Notifications: 3 points

---

### 3. Download Analyzer (`src/engines/download-analyzer.ts`)

**Purpose:** Flag risky downloads in real-time.

**Threat Detection:**
1. **Executable Extensions** — Blocked list: exe, bat, cmd, ps1, vbs, scr, msi, jar, deb, rpm, etc.
2. **Double Extensions** — invoice.pdf.exe, document.docx.bat (common phishing)
3. **MIME Mismatches** — File extension doesn't match MIME type
4. **Suspicious Archives** — zip/rar with financial names (invoice, payment, statement)
5. **Executables in Archives** — malware.exe.zip detected by extension analysis

**Risk Levels:**
- `DANGEROUS` — Executable or double extension
- `SUSPICIOUS` — MIME mismatch or phishing archive name
- `SAFE` — Normal files (PDF, PNG, DOC, etc.)

**Service Worker Hook:**
```javascript
chrome.downloads.onCreated.addListener(analyzeDownload)
```

Also shows browser notifications for dangerous files.

---

### 4. Psychological Detector (`src/engines/psych-detector.ts`)

**Purpose:** Identify dark patterns and manipulation tactics.

**Tactics (5 Categories):**

| Tactic | Keywords | Example |
|--------|----------|---------|
| URGENCY | "Act now", "expires in", "only today" | "Offer ends in 2 hours" |
| FEAR | "Account suspended", "verify immediately", "hacked" | "Your account is at risk" |
| SCARCITY | "Only 3 left", "selling fast", "limited stock" | "Almost gone, 2 remaining" |
| REWARD | "You've won", "claim prize", "congratulations" | "You're a lucky winner!" |
| PRESSURE | "People are viewing", "trending", "just bought" | "500 people watching this" |

**Algorithm:**
1. Extract all text nodes from DOM (via TreeWalker)
2. For each tactic, apply regex patterns
3. Record matched text + element selector
4. Report all detected tactics

**Optimization:**
- Skips script/style/noscript tags
- Minimum text length threshold (avoid noise)
- Searches attributes (title, aria-label, data-*)
- Returns instance locations for highlighting

---

### 5. Trust Scorer (`src/engines/trust-scorer.ts`)

**Purpose:** Aggregate all signals into a 0-100 score.

**Scoring Formula:**
```
base = 100
deductions:
  - psychological: up to -30 (based on tactic count & instances)
  - fields: up to -25 (based on high-risk fields & form security)
  - permissions: up to -20 (based on permission types requested)
  - downloads: up to -15 (dangerous/suspicious files)
bonus:
  + HTTPS: +5 (encrypted connection)
  + privacy_policy: +2
  + contact_info: +1
  + secure_forms: +2

final = clamp(base - deductions + bonuses, 0, 100)
```

**High-Impact Tactics:**
- FEAR and PRESSURE are weighted +5 extra deduction

**Threat Level Mapping:**
- 80-100: SAFE (green)
- 60-79: CAUTION (amber)
- 40-59: WARNING (orange)
- 0-39: DANGER (red)

---

### 6. Risk Aggregator (`src/engines/risk-aggregator.ts`)

**Purpose:** Run all engines and combine into unified RiskReport.

**Flow:**
```
aggregateRisks(url)
  ├── detectPsychTactics(document.body)
  ├── scanFields(document)
  ├── getPermissionScanResult() [cached from permission engine]
  ├── getDownloadScanResult() [cached from download analyzer]
  ├── detectMetaSignals(document)
  ├── computeTrustScore() [all inputs]
  └── return RiskReport {
        url, hostname, trustScore, threatLevel,
        psychDetection, fieldScan, permissionScan,
        downloadScan, metaSignals, scoreBreakdown
      }
```

---

## Message Flow

### Content Script → Background Worker

```
Content Script                    Background Worker
    │
    ├─ RISK_REPORT ────────────→ tabManager.setReport(tabId, report)
    │                                 ├─ Badge update
    │                                 └─ Cache with 30-min TTL
    │
    ├─ PERMISSION_INTERCEPTED ──→ Log (stored for analysis)
    │
    └─ DOWNLOAD_FLAGGED ────────→ Notification + Cache
```

### Popup ← Background Worker

```
Popup                          Background Worker
    │
    ├─ REQUEST_MENTOR ──────→ streamMentorAnalysis(report)
    │                            └─ MENTOR_TOKEN (streaming)
    │                            └─ MENTOR_DONE (complete)
    │
    └─ REQUEST_ATTACKER_VIEW → getAttackerView(report)
                                 └─ ATTACKER_VIEW_RESULT (JSON)
```

---

## State Management (Zustand)

GuardianEye uses Zustand for popup state:

```typescript
interface RiskState {
  // Page metadata
  currentSite: string | null;
  trustScore: number;
  threatLevel: ThreatLevel | null;

  // Engine outputs
  tactics: TacticType[];
  fields: FieldScan[];
  permissions: PermissionRequest[];
  threats: string[];

  // AI analysis
  mentorText: string;
  isMentorStreaming: boolean;
  mentorError: string | null;

  attackerReport: AttackerViewReport | null;
  isAttackerLoading: boolean;
  attackerError: string | null;

  // Lifecycle
  isAnalyzing: boolean;
  lastAnalyzedAt: number | null;
  activeTabId: number | null;
}
```

**Actions:**
- `setRiskReport()` — New report from content script
- `appendMentorToken()` — Streaming token from AI
- `finishMentorStream()` — AI done
- `setAttackerReport()` — JSON report received
- `resetForNewPage()` — Navigation

---

## AI Integration (Groq)

### Mentor Mode

**Flow:**
```
User clicks "Get Mentor Analysis"
  ↓
Popup: chrome.runtime.sendMessage({ type: 'REQUEST_MENTOR' })
  ↓
Background: streamMentorAnalysis(report)
  ↓
Groq API (streaming)
  ├─ prompt = buildMentorPrompt(report) [detailed context]
  ├─ model = "llama3-8b-8192" [fast, accurate]
  ├─ stream = true
  └─ onToken callback for each chunk
  ↓
Background: chrome.runtime.sendMessage({ type: 'MENTOR_TOKEN', token })
  ↓
Popup: useRiskStore.appendMentorToken(token)
  ↓
UI: Real-time text streaming display
```

**Offline Fallback:**
If Groq is unreachable, `buildOfflineFallbackMessage()` generates rule-based text:
- Analyzes trust score
- Mentions specific tactics detected
- Gives safety recommendations
- No jargon

### Attacker View Mode

**Flow:**
```
User clicks "Attacker's View"
  ↓
Popup: chrome.runtime.sendMessage({ type: 'REQUEST_ATTACKER_VIEW' })
  ↓
Background: getAttackerView(report)
  ↓
Groq API (non-streaming)
  ├─ prompt = buildAttackerPrompt(report) [structured context]
  ├─ model = "llama3-8b-8192"
  ├─ stream = false
  ├─ temperature = 0.2 [deterministic for JSON]
  └─ max_tokens = 1024
  ↓
Parse JSON response: extractJson() → validate
  ↓
Background: chrome.runtime.sendMessage({ 
    type: 'ATTACKER_VIEW_RESULT', 
    payload: AttackerViewReport 
  })
  ↓
Popup: useRiskStore.setAttackerReport(payload)
  ↓
UI: Display dataAtRisk, attackerGoal, exploitVector, recommendation
```

**Offline Fallback:**
If Groq fails, `buildOfflineAttackerReport()` generates heuristic JSON:
```json
{
  "dataAtRisk": ["email", "browsing history", "IP address"],
  "attackerGoal": "Phishing credentials",
  "exploitVector": "Fear-based psychological manipulation",
  "recommendation": "Do not enter personal information"
}
```

---

## Testing Strategy

### Test Organization

```
src/test/
├── setup.ts                      # Global mocks (chrome API)
├── field-scanner.test.ts         # 18 tests
├── permission-engine.test.ts     # 12 tests (via integration)
├── download-analyzer.test.ts     # 23 tests
├── psych-detector.test.ts        # 29 tests
├── trust-scorer.test.ts          # 22 tests
├── prompt-builder.test.ts        # 21 tests
└── attacker-view.test.ts         # 15 tests
```

### Test Categories

1. **Unit Tests** — Individual engine functions
   - Input validation
   - Classification correctness
   - Edge cases (unicode, HTML entities, etc.)

2. **Integration Tests** — Engine combinations
   - Risk scoring with multiple engines
   - Prompt generation from reports
   - JSON parsing robustness

3. **Mocking Strategy**
   - Chrome API mocked in setup.ts
   - DOM created via document.implementation
   - Groq API not mocked (errors tested via try/catch)

### Running Tests

```bash
npm run test              # Run once
npm run test:watch       # Watch mode
npm run test:coverage    # HTML report in coverage/
```

---

## Performance Optimization

### Content Script

- **DOM Scanning:** One TreeWalker pass (reuses DOM references)
- **Debounced Observer:** 2-second debounce on mutations
- **Lazy Field Classification:** Only classifies when needed
- **Early Exit:** Stops on first match for some patterns

### Background Worker

- **Per-tab Cache:** 30-minute TTL, auto-cleanup
- **Lazy Initialization:** Engines loaded only on demand
- **Message Queuing:** Prevents race conditions

### Popup UI

- **Lazy Loading:** Tabs render only when active
- **Streaming Responses:** Mentor text displays incrementally
- **Memoization:** useRiskStore prevents unnecessary re-renders

---

## Security Considerations

### Content Security Policy

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

Prevents:
- Inline scripts
- External code injection
- Eval execution

### Permissions Minimization

Only requests necessary permissions:
- `activeTab` — Current tab analysis
- `storage` — Cache management
- `downloads` — File monitoring
- `notifications` — User alerts
- `scripting` — Analysis execution
- `tabs` — Navigation tracking

### Data Privacy

- No telemetry or analytics
- Reports cached per-tab only
- AI requests anonymized (no user data)
- Cache cleared on tab close
- No persistence to storage

---

## Common Tasks

### Adding a New Tactic Pattern

**File:** `src/engines/psych-detector.ts`

```typescript
// Add to TACTIC_PATTERNS array
{
  tactic: TacticType.YOUR_TACTIC,
  patterns: [
    /pattern1/gi,
    /pattern2/gi,
  ],
}
```

Then add test in `src/test/psych-detector.test.ts`:

```typescript
it('detects YOUR_TACTIC pattern', () => {
  const doc = buildDocument('text with pattern1');
  const result = detectPsychTactics(doc.body);
  expect(result.tactics).toContain(TacticType.YOUR_TACTIC);
});
```

### Adding a New Field Classification

**File:** `src/engines/field-scanner.ts`

```typescript
// Add to CLASSIFIERS array
{
  kind: 'new_field_type',
  types: ['text', 'email'],
  keywords: /new_keyword|pattern/i,
}
```

### Changing Scoring Weights

**File:** `src/engines/trust-scorer.ts`

```typescript
// Modify these constants:
const MAX_PSYCH_DEDUCTION = 30;  // Max points lost to manipulation
const MAX_FIELD_DEDUCTION = 25;  // Max points lost to form fields
// ... etc
```

---

## Debugging

### View Content Script Logs

1. Right-click on page → Inspect
2. Console tab shows content script logs
3. Prefix: `[GuardianEye:engine-name]`

### View Background Worker Logs

1. `chrome://extensions/`
2. Click "Details" on GuardianEye
3. Click "Service Worker" or "Errors"

### View Popup Logs

1. `chrome://extensions/` → GuardianEye → Details
2. Look for popup console (if extension popup is focused)

### Zooming Out on Popup

Popup is 360x600px. To zoom:
1. Right-click popup → Inspect
2. DevTools appears
3. Use zoom controls (top-right)

---

## Deployment Checklist

Before submitting to Chrome Web Store:

- [ ] Version bumped in package.json
- [ ] All tests passing: `npm run test`
- [ ] No TypeScript errors: `npm run type-check`
- [ ] Build succeeds: `npm run build`
- [ ] Icons present in `public/icons/`
- [ ] Privacy policy written
- [ ] Store description finalized
- [ ] Screenshots prepared (1280x800)
- [ ] Manifest permissions reviewed
- [ ] HTTPS required for AI features documented

---

## Resources

- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/mv3/)
- [Groq API Docs](https://console.groq.com/docs/api)
- [Vite Guide](https://vitejs.dev)
- [React Best Practices](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

*Last updated: 2026-06-22*
*For contributors and maintainers*
