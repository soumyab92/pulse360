# AGENT_RULES.md — PULSE360

This file is the source of truth for the project. Read it fully before every task.
If a user message conflicts with this file, say so before proceeding.

---

## 1. Product

**PULSE360** is a web app that analyzes an internet connection from every angle: speed, stability, responsiveness, and what the user can actually do with it.

Most speed tests show one number. PULSE360 shows how the connection *feels*.

### Core measurements (real data only)
- Download and upload throughput (live, UI refresh ~100ms)
- Idle latency, jitter, packet loss
- Loaded latency / bufferbloat grade (A to F)
- DNS resolution time
- Stability Mode: 60-second run charting throughput and latency variance
- Browser Network Information API data where available
- Network details: IP, ISP, ASN, approximate location, test server

If a metric is unavailable in the browser, show a clear "not measurable here" state.
**Never mock, fake, or estimate measurements.**

### The 360 layer
1. **Real-Life Verdicts:** 4K streaming, competitive gaming, video calls, remote work, cloud backups, smart-home load. Each has a status and a one-line plain-English reason.
2. **Network DNA:** radar fingerprint (speed, stability, latency, upload, bufferbloat, DNS). Exportable as an image card.
3. **Ghost Run:** previous test overlaid as a translucent ghost on live gauges.
4. **Time Machine:** history in localStorage, time-of-day heatmap, trend line.
5. **Plan vs Reality:** user enters promised ISP speed, app shows delivered percentage.
6. **Smart Diagnosis:** rule-based insights with a concrete fix.
7. **Transfer Calculator:** time to download or upload common file sizes.

### Signature experience
- WebGL **Data Tunnel** (react-three-fiber): particle velocity, stretch, and color driven by live throughput.
- Optional sonification toggle (Web Audio, off by default).
- Haptic pulse on mobile when a test completes.
- Command palette (Cmd/Ctrl+K).
- GSAP-choreographed result reveal: rolling digits, staggered verdicts.

---

## 2. Tech stack

- React + Vite + TypeScript (strict mode)
- Tailwind CSS
- GSAP for choreographed motion
- react-three-fiber / Three.js for the Data Tunnel
- D3 or visx for custom charts (drawn by hand, no default chart look)
- Zustand for state
- localStorage for history
- `@cloudflare/speedtest` for core measurements (verify current API and CORS behavior before relying on it)
- Package manager: pnpm

Do not add any other UI kit or component library (no MUI, shadcn, Chakra, etc.) without asking first.

---

## 3. Architecture rules

- The **measurement engine** is a standalone typed module with no UI imports. It exposes a clear interface (start, abort, subscribe to live updates, final result).
- UI components only consume engine state through the store. They never call measurement code directly.
- Folder layout:
  ```
  src/
    engine/        measurement logic, types, adapters
    store/         Zustand stores
    components/    UI components (gauges, charts, panels)
    scenes/        Three.js / WebGL scenes
    features/      verdicts, diagnosis, history, share-card
    styles/        tokens, global CSS
    lib/           small pure utilities
  ```
- Keep components small and single-purpose. No file over ~300 lines without a reason.
- No `any`. Type all engine outputs.
- Handle all states explicitly: idle, running, finished, aborted, error, offline, unsupported.
- Heavy work (WebGL, future embeddings) must never run in a way that distorts speed test results. Do not load large assets or models during a test.

---

## 4. Design direction (strict)

**Concept: mission control meets editorial magazine.** A precision instrument panel with confident typography. Zero template feel.

### Color tokens
| Token | Value | Use |
|---|---|---|
| `--bg` | `#0E0D0B` | Warm near-black background |
| `--ink` | `#EDE8DF` | Bone-white primary text |
| `--signal` | `#FF4B1F` | The ONE accent (vermilion) |
| `--muted` | `#8A857B` | Secondary text, hairlines |
| `--line` | `rgba(237,232,223,0.12)` | Hairline rules |

Status colors (good/warn/bad) are used sparingly, only where meaning requires them.

### Typography
- **Display:** a characterful grotesk (Bricolage Grotesque or Familjen Grotesk)
- **Numbers and data:** tabular mono (Geist Mono or JetBrains Mono), always with tabular figures
- **Editorial accent:** italic serif (Instrument Serif), used occasionally
- Giant numerals are the hero of the interface.

### Layout and surface
- Asymmetric grid, visible hairline rules, oversized type that bleeds off edges.
- Mix tight data density with generous emptiness.
- Subtle film grain overlay.
- Custom SVG gauges and charts, hand-drawn.
- Mobile-first for the test flow. Fully responsive.

### Motion
- Purposeful, choreographed, never decorative noise.
- Numbers roll, panels stagger, the tunnel accelerates with real throughput.
- Respect `prefers-reduced-motion`: provide calm fallbacks.

### Accessibility
- WCAG AA contrast minimum.
- Keyboard-navigable, visible focus states, ARIA labels on gauges and charts.
- Never rely on color alone to convey status.

---

## 5. Hard "not generic" rules

Do **NOT** use:
- Purple or blue gradients
- Glassmorphism cards
- Inter, Poppins, or Roboto
- A centered hero with three feature cards
- Emoji as icons
- Stock illustrations
- Rounded-2xl card grids
- Generic AI sparkle icons
- Marketing filler like "Welcome to the future of..." or "Supercharge your..."

Copy style: short, sharp, slightly dry. No lorem ipsum, no placeholder text.

---

## 6. Process rules

1. **Plan before code.** For each milestone, state what you will build, then build it.
2. **One milestone at a time.** Never start the next milestone without my approval.
3. **Verify visually.** After each milestone, run the app in the browser and capture screenshots at desktop (1440px) and mobile (390px). Fix visual problems before reporting.
4. **Verify with real data.** Run an actual speed test and report each metric's value. Flag anything suspicious.
5. **Report honestly.** At the end of each milestone, list assumptions, deviations from plan, known issues, and anything you could not verify.
6. **Commit after each milestone** with a clear message.
7. **Ask before adding dependencies** that are not in the stack above.
8. If a requirement is ambiguous, ask one focused question rather than guessing.

---

## 7. Milestones

1. **Engine + minimal UI:** real measurements, typed engine module, basic styled UI, all failure states.
2. **Design system + results:** tokens, type scale, custom gauges, results screen.
3. **Signature visuals:** Data Tunnel, Network DNA, Ghost Run.
4. **Features:** Time Machine history, Smart Diagnosis, Plan vs Reality, Transfer Calculator, share card, command palette.
5. **Polish:** accessibility audit, performance (Lighthouse 90+), mobile QA, reduced-motion pass.
6. **Ask PULSE (optional, later):** grounded LLM + RAG assistant. Console-style panel, opt-in model download, never loaded during a test, answers cite sources, never invents metrics.

---

## 8. Decisions log

_Add confirmed decisions here as the project progresses (final colors, spacing scale, component patterns, naming), so later milestones stay consistent._

- **Ask PULSE Floating AI Assistant Widget (Sole Assistant UI Specification)**:
  - **Single Widget Architecture**:
    - The bottom-right floating widget (`#askPulseFloatingWidget`) is the **sole and exclusive** Ask PULSE interface in the application.
    - Any inline console section on the main page is deprecated and removed to keep the interface focused, uncluttered, and unified.
    - Top navigation button `#navAskPulseBtn` programmatically invokes the corner floating popup launcher.
  - **Component Structure & DOM IDs**:
    - Floating Container: `#askPulseFloatingWidget` at `fixed bottom-6 right-6 z-50 font-mono`
    - Launcher Pill: `#floatingAskPulseLauncher` (compact circular pill with glowing vermilion ping dot, text "ASK PULSE", and "AI" badge)
    - Floating Window: `#floatingAskPulsePopup` (`w-[420px] max-w-[calc(100vw-32px)] h-[560px] max-h-[calc(100vh-100px)]`)
    - Header & Close Control: `#btnCloseFloatingPopup`
    - Lockout Banner: `#popupSpeedLockout` (shows warning and blocks queries while speed test is executing)
    - Action Preset Chips: `#popupChipTestSpeed`, `#popupChipExplain`, `#popupChipComplaint`, `#popupChipStability`
    - Terminal Text Output: `#popupConsoleText` (monospace typewriter stream) with cursor `#popupBlinkingCursor`
    - Options Tray: `#popupOptionsArea` and `#popupOptionButtons` (positioned directly above the input bar for easy access)
    - Source Citations: Suppressed in chat popup (`sourcesUsed: []` emitted; no source badges rendered in chat popup)
    - Input & Submission: `#popupAskForm`, `#popupAskInput` (max 1000 chars), `#popupCharCounter`, `#popupBtnSubmit`, `#popupBtnClear`
  - **Typo Tolerance & Nearest Intent Matching (ChatGPT / Gemini Style)**:
    - **Fuzzy Keyword & Transposition Matching**:
      - Uses Damerau-Levenshtein distance and token similarity to find nearest intents for misspelled words (e.g. `donwload speed`, `dwonload`, `dwnld` &rarr; Download Speed; `uplaod`, `upld` &rarr; Upload Speed; `pnig`, `latncy` &rarr; Latency; `buffrblot` &rarr; Bufferbloat; `stablty` &rarr; Stability; `draf complnt` &rarr; ISP Complaint).
      - If a near match is found, immediately returns the direct, grounded result or dispatches the relevant action like ChatGPT / Gemini.
    - **Unmatched / Unknown Commands (Generic Fallback)**:
      - If a prompt does not match any network diagnostic intent (e.g. `tell me a recipe`, `what is the weather today?`, `asdfghjkl`), return a polite generic ChatGPT/Gemini-style response:
        `"I'm PULSE Agent, the AI operator for PULSE360. I didn't recognize that command, but I can help you test your connection, check download and upload speeds, measure latency and bufferbloat, or draft an ISP complaint letter. What would you like to check?"`
      - Accompanied by interactive suggested options: `['What is my download speed?', 'Test my internet speed', 'What is my bufferbloat grade?', 'Explain my result', 'Run 60s stability test']`.
    - **No Verified Sources in Chat Popup**:
      - Verified sources (`VERIFIED SOURCES: [SRC: ...]`) are suppressed from the chat popup so conversations remain clean, natural, and uncluttered.
  - **Strict, Laser-Focused Answering Policy ("Jototuku Ask Korbo Totai Answar Debe")**:
    - **Identity & Name**: When asked name ("what is your name", "who are you", "whos ur nam", "naam ki", "tomar naam ki"), respond strictly: `"I am PULSE Agent, the AI diagnostic operator for PULSE360."`
    - **Download Speed Only & Auto-Test Reporting**:
      - When asked download speed ("what is my download speed", "download speed koto", "dwonload", "donwload speed"):
        - If speed is already measured: reply strictly `"Your download speed is {download} Mbps."` and provide interactive option chips (`[What is my upload speed?]`, `[What is my bufferbloat grade?]`, `[What is my ping?]`, `[Explain my result]`, `[Export Network DNA]`).
        - If speed has not been measured yet: dispatch `[ACTION:START_SPEED_TEST]\nTesting your internet speed now. Your download speed and follow-up options will appear here once the test finishes.`
      - **Post-Test Chat Notification (Result Shown First)**: Upon completion of the speed test (`startFull360Analysis()`), the chat replaces intermediate status text and renders the final result FIRST right under the prompt header with `scrollTop = 0`:
        `{promptHeader}\n\nYour download speed is {download} Mbps.\nUpload: {upload} Mbps • Latency: {ping} ms • Bloat: Grade {bloat}.`
        and renders interactive clickable option buttons inside `#popupOptionsArea`. Clicking any chip immediately queries the agent.
    - **Interactive Follow-up Option Chips**:
      - Every metric response returns a list of contextual option chips rendered in `#popupOptionsArea` (e.g. `What is my upload speed?`, `What is my bufferbloat grade?`, `Explain my result`, `Export Network DNA`, etc.).
      - Clicking any chip sends that exact command to the assistant without needing to type.
    - **Upload Speed Only**: When asked upload speed ("upload speed koto", "upload", "uplaod", "upld"), reply strictly: `"Your upload speed is {upload} Mbps."` with contextual follow-up options.
    - **Ping / Latency Only**: When asked ping or latency ("what is my ping", "ping koto", "latency", "pnig", "latncy"), reply strictly: `"Your latency is {ping} ms."`
    - **Jitter Only**: When asked jitter ("what is my jitter", "jitter koto", "jittr"), reply strictly: `"Your jitter is {jitter} ms."`
    - **Bufferbloat Only**: When asked bufferbloat ("what is my bufferbloat", "bufferbloat grade", "buffrblot"), reply strictly: `"Your bufferbloat grade is Grade {grade}."`
    - **Bufferbloat Remediation**: When asked how to fix bufferbloat, reply strictly with SQM router instructions.
    - **Packet Loss Only**: When asked packet loss, reply strictly: `"Your packet loss is {loss}%."`
    - **IP & ISP Only**: When asked IP/ISP, reply strictly with the detected network details: `"Your IP is {ip}."` / `"Your ISP is {isp}."`
    - **Missing / Unmeasured Telemetry**: If a requested metric has not been tested yet, reply: `"I don't have enough data. Please run a speed test first."`
  - **Agentic Action Dispatching Protocol**:
    - When commanded to test speed ("test my internet speed", "check speed", "speed test koro", "tset speed"), emit:
      `[ACTION:START_SPEED_TEST]\nTesting your internet speed now.`
      The client intercepts the action tag, renders `⚡ [AGENT ACTION DISPATCHED]`, and immediately invokes `startFull360Analysis()`.
    - Additional actions:
      - `[ACTION:RUN_STABILITY]` &rarr; invokes `runStabilityMode()`
      - `[ACTION:EXPORT_DNA]` &rarr; invokes `exportDnaCardPng(...)`
      - `[ACTION:PROBE_DNS]` &rarr; invokes `probeDnsResolvers()`

## 9. Production Readiness & Deployment Architecture
- **Zero-Dependency Native Runtime**:
  - Pure native Node.js 22 built-ins (`http`, `fs`, `path`, `zlib`, `url`).
  - No heavy backend frameworks or npm production install steps required.
- **Dynamic Port Binding**:
  - Listens on `process.env.PORT || 3000` with host `0.0.0.0` for full compatibility with Docker, Cloud Run, Heroku, Railway, Render, and Fly.io.
- **Production Security Headers**:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: geolocation=(), microphone=(), camera=()`
- **Asset Compression & High-Throughput Caching**:
  - Real-time `gzip` compression (level 6) for compressible MIME types (`.html`, `.js`, `.mjs`, `.css`, `.json`, `.svg`, `.md`).
  - `Cache-Control: public, max-age=86400, stale-while-revalidate=3600` on static assets for CDN edge and browser caching.
  - `Cache-Control: no-cache, must-revalidate` on HTML to ensure instant cache invalidation upon fresh deployments.
- **Health Probes & Liveness**:
  - Endpoints: `GET /health` and `GET /api/health` return HTTP 200 with JSON payload `{ status: "healthy", service: "pulse360", uptimeSeconds, timestamp }`.
  - Integrated with Docker container `HEALTHCHECK` with 30s interval, 5s timeout, and 3 retries.
- **Graceful Process Lifecycle**:
  - Listens to POSIX signals `SIGTERM` and `SIGINT` to cleanly close open connections before terminating.
  - 5-second hard timeout safety barrier against stalled HTTP connections.
- **PWA & Mobile Ready**:
  - Compliant `manifest.json` with theme color `#08090d`, standalone display mode, and high-DPI vector icons (`icon-192.svg`, `icon-512.svg`).
  - Apple mobile web app metadata tags (`apple-mobile-web-app-capable`, `black-translucent`).
- **Open Graph & Social Share**:
  - Fully configured Open Graph (`og:title`, `og:description`, `og:image`, `og:type`) and Twitter Summary Large Card metadata.
- **Production Containerization**:
  - Dockerfile targeting `node:22-alpine` with minimal image footprint (<180MB) and non-privileged execution model.