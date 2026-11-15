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
