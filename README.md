# GuardianEye — Human-Centric Cybersecurity Browser Extension

An AI-powered Manifest V3 browser extension built with React, TypeScript, Tailwind CSS, and Ollama. GuardianEye helps users understand how websites attempt to influence, manipulate, or expose their sensitive information.

## Prerequisites

- **Node.js** 20+
- **Ollama** installed locally (https://ollama.com)
- Run: `ollama pull qwen2.5:3b`
- Run: `OLLAMA_ORIGINS="chrome-extension://*" ollama serve`

## Setup

1. `npm install`
2. `npm run dev` (Runs Vite in watch mode)
3. Open `chrome://extensions` → Enable **Developer Mode** → Click **Load Unpacked** → select the `dist/` directory.

## Features Overview

- **Trust Score Engine:** Computes a 0–100 trust score based on a deduction system capping psychological manipulation, data fields, and permissions.
- **Psychological Manipulation Scanner:** Detects urgency, fear, scarcity, reward, and social pressure tactics in DOM text using TreeWalker.
- **Sensitive Field Classifier:** Classifies forms and identifies high-risk inputs (passwords, credit cards, SSN) and third-party insecure submission actions.
- **Permission Monitor:** Intercepts `navigator.permissions` and `getUserMedia` to flag access to camera, microphone, and geolocation.
- **Download Analyzer:** Heuristically blocks risky executable extensions, double extensions (e.g. `.pdf.exe`), and suspicious archive names.
- **AI Security Mentor:** Streams contextual, plain-English advice explaining the specific risks of the current page using a local LLM.
- **Attacker's View:** Generates a structured JSON Red Team report detailing exactly how an attacker would exploit the user's current data context.
- **Shadow DOM Overlay:** Injects an isolated, tamper-proof warning banner directly into high-risk pages without CSS bleed.

## Testing

- **Test urgency detection:** visit any countdown sale page.
- **Test field scanner:** visit any login or checkout page.
- **Test attacker view:** visit a page requesting location permission.
- **Test download analyzer:** attempt to download a `.exe` file.
