# Verification

2026-11-15, React + Capacitor prototype.

- `npm test`: 8 passing tests covering alarm outcomes, offline behavior, malformed requests, PG-13 output screening, provider errors, and structured model replies.
- `npm run build`: TypeScript and Vite production build passed.
- `npx cap sync ios`: passed.
- Xcode Debug simulator compilation with signing disabled: BUILD SUCCEEDED.
- Live Gemini requests succeeded using the supplied server-side key with `gemini-3.5-flash`. The older 2.5 model rejected new-user requests. API timeouts are handled by an explicitly labeled offline character.
- Browser: conversational onboarding, saved profile after reload, three layered sounds, accessibility mute, waking and returning-to-bed conversation outcomes, saved session history, task creation, generated reminder display, and Missed/Neglected metric updates verified. Temporary task removed and reminders restored to off.
- Layout inspections at 375 / 768 / 1280 CSS pixels reported no horizontal overflow. Inspected onboarding, alarm negotiation, and dashboard. Sampled interactive targets were at least 24px. This is a fixed dark design, including when the OS prefers light.
- Contrast ratios for the new semantic tokens exceed AA: main text 15.77:1; muted text 8.11:1; user-message text 9.60:1; action text 10.08:1; input border 4.00:1.
- Keyboard: Enter submits chats; the native alarm dialog opens and Escape dismisses it. The browser check showed focus returning to body after dismissal; explicit trigger-focus restoration remains to be improved.
- Source, tracked files, and production output scanned for the supplied key: no copies found outside ignored `.env.local`.

Not verified: full axe scan, VoiceOver, Safari, emulated reduced-motion behavior, physical-device notifications, powered-off behavior, or live Gemini on a physical iPhone. CSS disables the live pulse under reduced motion and uses instant transcript scrolling. A hosted HTTPS API must be configured for live Gemini in an installed iPhone app; otherwise it uses the offline character. Fully powered-off phones cannot run these alarms. Locked-phone notifications do not continuously ring until chat completion.

## Final-branch replacement — 2026-11-15
- Replaced main's tracked snapshot with origin/Final-branch at 1805137, excluding its tracked .env.local. Recovery branch: codex/before-final-branch-replacement.
- Preserved working ignored local Gemini and ElevenLabs credentials. Updated .env.example to the tested Gemini provider/model and server-only voice variables.
- npm ci completed; 27 tests, production build and Capacitor iOS sync passed. Restarted development server on localhost:5173.
- Live Gemini returned a conversation reply; live ElevenLabs returned HTTP 200 with 38,913 bytes of speech. Running health endpoints report Gemini and voice configured.
- Active-key scan found no credentials in tracked files or built client assets. Physical-device alarm delivery and microphone interaction were not retested in this replacement.

## iOS simulator launch and AI connection
- Built and launched com.lenny.alarmclock on iPhone 17 Pro / iOS 26.1 simulator.
- Enabled CapacitorHttp native fetch transport and allowed local networking for the localhost development backend; production still requires a reachable HTTPS backend.
- Simulator build uses VITE_AI_BASE_URL=http://localhost:5173, also saved in ignored local environment for subsequent local builds. Server-only provider keys remain unchanged.
- Confirmed an actual simulator onboarding request returned “Live Gemini reply” and advanced from question 1 to question 2. Xcode build and TypeScript checks passed.

## Android APK
- Added official Capacitor Android 8 project. Build succeeded using Android Studio Java 21 and Android SDK 36; signed debug APK at android/app/build/outputs/apk/debug/app-debug.apk, copy /private/tmp/Alarm-Clock.apk (4.2 MB).
- apksigner verified APK v2 signature. Client-asset scan found no active Gemini or ElevenLabs keys.
- APK API base is http://10.1.62.124:5173 for same-Wi-Fi demo; backend health reachable from laptop. Debug-only HTTP rule is scoped to this host. Production requires HTTPS hosting.
- Microphone and exact-alarm permissions declared. No phone connected through ADB; installation, microphone and notification behavior on the physical phone remain unverified.
