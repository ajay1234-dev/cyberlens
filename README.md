# GuardianEye AI

## Human-Centric Cybersecurity Browser Extension

GuardianEye is an AI-powered Chrome Extension that shifts cybersecurity from **"Is this malicious?"** to **"How is this manipulating me?"**

Unlike traditional antivirus or phishing detectors, GuardianEye analyzes websites from a **behavioral and psychological perspective**, helping you understand how sites influence user behavior, collect sensitive information, and request access to personal data.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ (npm 9+)
- **Chrome** 120+
- **Groq API Key** (free, get at https://console.groq.com)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/guardianEye
cd cyberlens

# Install dependencies
npm install

# Create .env.local with your Groq API key
echo "VITE_GROQ_API_KEY=your_api_key_here" > .env.local

# Build the extension
npm run build

# Load into Chrome
# 1. Open chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the "dist" folder
```

---

## ✨ Features

### 1. Trust Score (0-100)
- Aggregates all detection engines into a single score
- **80+:** SAFE (green)
- **60-79:** CAUTION (amber)
- **40-59:** WARNING (orange)
- **0-39:** DANGER (red)

### 2. Psychological Manipulation Detection
Identifies 5 dark patterns used to manipulate users:

- **URGENCY:** "Act now!", time limits, countdowns
- **FEAR:** Account threats, security alerts, "verify immediately"
- **SCARCITY:** "Only 3 left", limited stock, exclusive offers
- **REWARD:** Free prizes, congratulations, cash prizes
- **PRESSURE:** Social proof, "others are viewing", trending

### 3. Sensitive Data Detection
Detects form fields requesting:
- Email addresses
- Passwords
- Credit card numbers
- CVV/CVC codes
- Social Security numbers
- Date of birth
- Phone numbers
- Physical addresses

Also checks:
- Form submission security (HTTPS vs HTTP)
- Third-party data collection
- Form count and high-risk indicators

### 4. Permission Awareness
Monitors and alerts on requests for:
- **Camera access** — Full facial recognition data
- **Microphone access** — Audio recording capability
- **Geolocation** — Precise location tracking
- **Notifications** — Background messages and tracking

### 5. Download Safety
Flags dangerous files including:
- Executable extensions (.exe, .bat, .cmd, .ps1, etc.)
- Double extensions (invoice.pdf.exe)
- MIME type mismatches
- Suspicious archive names (invoice.zip, payment_statement.rar)

### 6. AI Security Mentor
- Friendly, plain-English explanations
- No technical jargon
- Explains why specific risks matter
- Provides actionable recommendations
- Streams responses in real-time

### 7. Attacker's View
- Simulates red-team perspective
- Shows what attackers could steal
- Identifies exploit vectors
- JSON-formatted security assessment

### 8. Visual Dashboard
- Animated trust score ring
- Real-time risk list
- Threat level indicators
- Three-tab interface:
  - **Overview:** Summary of risks
  - **Mentor:** AI explanations
  - **Attacker:** Attack simulation

---

## 📊 Architecture

```
Content Script (Every Page)
├── Psych Detector (text analysis)
├── Field Scanner (form detection)
├── Permission Engine (API interception)
├── Download Analyzer (file monitoring)
└── Risk Aggregator (combines signals)
        ↓
    Risk Report (100+ data points)
        ↓
Background Service Worker
├── Message Router (content ↔ popup)
├── Tab Manager (per-tab caching)
└── Download Hook (file monitoring)
        ↓
    Risk Score + Breakdown
        ↓
React Popup UI
├── Header (site name)
├── TrustRing (score visualization)
├── OverviewPanel (risk summary)
├── MentorPanel (AI explanations)
└── AttackerPanel (attack vectors)
```

---

## 🛠️ Development

### Build Commands

```bash
npm run dev          # Development server (Vite watch)
npm run build        # Production build
npm run preview      # Preview production build
npm run test         # Run all tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
npm run type-check   # TypeScript validation
npm run lint         # ESLint check
```

### Project Structure

```
src/
├── ai/                    # AI/LLM integration
│   ├── ollama-client.ts   # Groq API client
│   ├── mentor-engine.ts   # Mentor mode
│   ├── attacker-view.ts   # Attacker perspective
│   └── prompt-builder.ts  # Prompt construction
├── background/           # Service worker
│   ├── service-worker.ts  # Entry point
│   ├── message-router.ts  # IPC dispatcher
│   └── tab-manager.ts     # Tab caching
├── content/              # Content scripts
│   ├── index.ts          # Entry point
│   ├── observer.ts       # DOM monitor
│   └── overlay-injector.ts # Warning banner
├── engines/              # Detection engines
│   ├── field-scanner.ts   # Form field detection
│   ├── permission-engine.ts # Permission interception
│   ├── download-analyzer.ts # File risk analysis
│   ├── psych-detector.ts  # Manipulation detection
│   ├── risk-aggregator.ts # Signal combination
│   └── trust-scorer.ts    # Score calculation
├── popup/                # React UI
│   ├── App.tsx           # Main popup
│   ├── main.tsx          # Entry
│   └── components/       # UI components
├── store/                # State management
│   └── risk-store.ts     # Zustand store
├── types/                # TypeScript types
├── utils/                # Helpers
└── test/                 # Unit tests
```

### Testing

```bash
# Run all tests
npm run test

# Watch mode (re-run on file changes)
npm run test:watch

# Coverage report
npm run test:coverage
```

**Current Status:** ✓ 128 tests passing | 100% detection engines covered

### Key Test Coverage

- Field scanner: 18 tests
- Download analyzer: 23 tests
- Trust scorer: 22 tests
- Attacker view: 15 tests
- Prompt builder: 21 tests
- Psychological detector: 29 tests

---

## 🔧 Configuration

### Environment Variables

Create `.env.local`:

```env
# Required for AI explanations
VITE_GROQ_API_KEY=gsk_your_key_here
```

### Manifest Configuration

Key permissions in `manifest.json`:

```json
{
  "permissions": [
    "activeTab",      // Analyze current tab
    "storage",        // Cache reports
    "downloads",      // Monitor files
    "notifications",  // Alert warnings
    "scripting",      // Run analysis
    "tabs"            // Track navigation
  ],
  "host_permissions": [
    "<all_urls>"      // Universal analysis
  ]
}
```

---

## 🚀 Deployment

### Local Testing

1. Build: `npm run build`
2. Load in Chrome: `chrome://extensions` → Load unpacked → select `dist/`
3. Test on websites
4. View logs: `chrome://extensions/` (Details → Errors)

### Chrome Web Store

See [DEPLOYMENT.md](DEPLOYMENT.md) for:
- Store submission checklist
- Privacy policy template
- Store description copy
- Review timeline expectations

---

## 📈 Performance

- **Content script:** <50ms analysis per page
- **Permission intercepts:** Real-time, no latency
- **AI mentor:** 2-5 second streaming response
- **Memory:** <15MB per tab
- **Cache:** 30-minute TTL, auto-cleanup

---

## 🔒 Privacy & Security

### What We Collect (On Your Device)
✓ Form field types (not values)
✓ Permission requests
✓ Downloaded files
✓ Manipulation tactics detected

### What We DON'T Collect
✗ Your passwords or form input
✗ Browsing history
✗ Personal identification
✗ Cookies or tracking data
✗ User telemetry

### External Services
- **Groq API:** Anonymous risk reports for AI analysis
- **No telemetry:** No tracking, logging, or data sales

---

## 🐛 Troubleshooting

### Extension Not Loading
```bash
# Check for errors
npm run build
npm run type-check

# Verify dist/manifest.json exists
ls dist/manifest.json
```

### AI Mentor Not Working
1. Verify Groq API key: `.env.local`
2. Check Groq console for rate limits
3. Extension falls back to rule-based explanations
4. View logs: `chrome://extensions/` Details

### Tests Failing
```bash
npm run test -- --reporter=verbose
npm run test:coverage
```

---

## 📚 Technology Stack

| Layer | Technology |
|-------|------------|
| **UI** | React 18, TypeScript |
| **Styling** | Tailwind CSS, PostCSS |
| **Animations** | Framer Motion |
| **Icons** | Lucide React |
| **State** | Zustand |
| **Build** | Vite, @crxjs/vite-plugin |
| **Testing** | Vitest, jsdom |
| **AI** | Groq API (Llama, Qwen models) |
| **Extension** | Chrome Manifest V3 |

---

## 🎯 Roadmap

### v1.0.0 ✓
- 5 detection engines
- AI mentor + attacker view
- React popup UI with animations
- 128 unit tests
- Shadow DOM overlay

### v1.1.0 (Planned)
- Custom risk thresholds
- Site whitelist/blacklist
- Enhanced download quarantine
- Privacy policy scanner

### v1.2.0 (Planned)
- Credential breach detection
- Multi-device sync
- Family controls dashboard

---

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

---

## 📄 License

GuardianEye AI is provided for educational and personal security use.

---

## ❓ FAQ

**Q: Does GuardianEye block websites?**
A: No. GuardianEye alerts you and provides information. You decide what to do.

**Q: Is my data sent to servers?**
A: Only anonymized risk reports are sent to Groq for AI analysis. Form values, passwords, and personal data never leave your device.

**Q: Does it work offline?**
A: Yes! The 5 detection engines work completely offline. AI explanations fall back to rule-based text if Groq is unavailable.

**Q: How accurate are the detection engines?**
A: Each engine is independently tested with 128 unit tests. Real-world accuracy depends on website structure and design patterns.

**Q: Can I disable the warning banner?**
A: Yes. The banner only appears for scores <40. You can dismiss it with the close button.

---

## 🔗 Resources

- [Deployment Guide](DEPLOYMENT.md)
- [Groq Console](https://console.groq.com)
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/mv3/)
- [Vite Guide](https://vitejs.dev)

---

## 📞 Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review test output: `npm run test:coverage`
3. Check browser console logs

---

*Last updated: 2026-06-22*
*Version: 1.0.0*
*Status: ✓ Production Ready*

- **Test urgency detection:** visit any countdown sale page.
- **Test field scanner:** visit any login or checkout page.
- **Test attacker view:** visit a page requesting location permission.
- **Test download analyzer:** attempt to download a `.exe` file.
