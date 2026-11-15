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

## AI follow-up

- Expanded to 11 passing automated tests, including incomplete-model-output labeling and daily versus temporary quota errors.
- Live requests confirmed that the original Flash model hit its 20-request free-tier daily quota. The offline character is expected under that condition; it must not be labeled as a live Gemini response.
- Switched the default to `gemini-3.1-flash-lite`, which returned a real onboarding response using the same key. No key changes were needed.
- Live smoke tests use one real request by default; `--all` explicitly runs five scenarios. They require `source: gemini`, so a working fallback does not create a false pass.

## OpenRouter migration

At the user’s request, replaced Gemini with OpenRouter’s Chat Completions API, server-side bearer authentication, strict JSON schema, and default `openrouter/free` model routing. The private environment file now contains only the OpenRouter credentials. Client source labels and error messages now identify OpenRouter. All 13 automated tests pass, including authorization, response parsing, quota errors, and insufficient credits.

Live OpenRouter onboarding smoke test passed in 3.3 seconds with `source: openrouter`. Running `/api/health` confirmed `provider: openrouter` and `model: openrouter/free`. Production build and iOS asset sync passed.

## Gemini key update

Selected Gemini explicitly with the newly supplied server-only key. Kept optional OpenRouter support so changing providers no longer requires rewriting the integration. All 15 automated tests and the production build pass. Verified the actual `/api/chat` endpoint with an Origin header: HTTP 200, source `gemini`, real onboarding reply. The key remains ignored and is not included in the repository or app bundle. Client errors now distinguish HTTP 400 and 403 from provider unavailability.

Browser follow-up identified a Gemini timeout on an actual chat request, despite successful endpoint replays. Added one bounded retry for timeouts, connection failures, and HTTP 502/503/504. Each attempt has a 12-second deadline, within the client's 28-second timeout. Quota and credential failures are never retried. Two additional automated tests cover retry behavior and non-retryable errors.

Final check: all 17 automated tests, production build, and iOS asset sync passed. In the actual browser, a fresh onboarding message received a personalized Gemini reply with no offline warning after timeout recovery was added. The saved profile was restored after the test.

## Origin and conversational onboarding fix

Removed the hardcoded browser-origin dependency: same-host requests work on the actual server port, and localhost / 127.0.0.1 / IPv6 loopback aliases are accepted on the same port. Explicitly configured origins remain supported; unrelated and opaque origins are still rejected.

Onboarding now asks the AI whether an answer fits the current question. Off-topic questions are answered without advancing the setup or storing them as profile fields. Offline failures do not advance setup. A visible “Live Gemini reply” label appears only after a real provider response.

All 20 automated tests and the production build pass. A live HTTP request with Origin http://127.0.0.1:5173 to localhost:5173 returned HTTP 200, source gemini, message “1+1 is 2!”, and advance false.

Chrome verification: submitted “whats 1+1” in the actual UI. Gemini replied “It is 2, though I much prefer counting sheep while tucked in! What should I call you?” The UI displayed “Live Gemini reply,” remained at question 1/4, and showed no offline notice. Chrome was left open on this verified exchange.

## Stupid Ideas hackathon personality update

Removed personality-selection questions and wake-up-justification prompts. Onboarding has three questions and infers tone from the answers. Alarm and reminder instructions now use playful status-quo comfort, small commitments, earned-rest framing, and immediate sensory rewards, personalized to ordinary responsibilities. Mentioning school/work does not itself stop the alarm; an explicit final wake/bed choice does. PG-13 boundaries and emergency stop remain.

## Monster siren and ElevenLabs voice
- Replaced gentle beep with synthesized sweeping sawtooth/square monster sirens; eight stackable layers, master gain and compressor, mute/emergency stop retained.
- Added server-only ElevenLabs text-to-speech and speech-to-text endpoints with origin checks, request limits and sanitized errors. Push-to-talk silences alarm during recording/playback, caps recording at 30 seconds, and retains text input.
- Added iOS microphone usage description. Build, Capacitor sync and all 26 automated tests pass (five voice endpoint tests use mocked ElevenLabs responses).
- Live ElevenLabs testing pending: Chrome account sign-in displayed “Unable to sign in”; no ElevenLabs key configured. Voice must not be reported as live until authenticated and tested.

## ElevenLabs live connection
- Created user-approved restricted Alarm Clock Duvet key: speech synthesis and transcription only; 10,000-credit refresh-period limit; expires December 15, 2026. Stored only in ignored `.env.local`.
- Live synthesis produced a 74,439-byte MP3. Live Scribe transcription returned: “Your pillow has an excellent proposal. Five more minutes. Stay in bed”.
- Reloaded Vite; running localhost:5173 `/api/voice/status` reports configured=true.
- Microphone capture and a full human voice conversation still require testing with a person; automated live check used synthesized audio for transcription.

## Continuous voice and orb
- Added single-owner playback, request cancellation and generation checks so interrupted or stale synthesis cannot start later. Ending voice cancels requests, stops tracks, closes audio monitoring and revokes audio URLs.
- Voice mode pauses the siren throughout the session. Spoken replies transition to microphone listening; sustained speech followed by 1.3 seconds of silence submits a turn, with a 30-second recording cap. Orb tap interrupts speech or submits the current recording.
- Warm animated orb has ready/listening/thinking/speaking states and reduced-motion support. Same-origin tabs coordinate voice ownership.
- Removed onboarding question context from alarm requests to prevent voice replies asking setup questions.
- Build, iOS sync and 27 tests pass. Chrome confirmed orb rendering and the siren-paused state; automatic microphone flow was waiting on browser permission and was not verified end-to-end.
