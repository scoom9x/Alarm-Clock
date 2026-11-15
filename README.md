# Alarm Clock

A React + TypeScript + Capacitor clock with Duvet, a PG-13 chatbot that makes a playful case for staying in bed.

## Run locally

```sh
npm install
cp .env.example .env.local # skip if your private .env.local already exists
# Set GEMINI_API_KEY in .env.local. Do not use a VITE_ prefix for the key.
npm run dev
```

Open http://localhost:5173. The Vite server handles `/api/chat` and calls the selected AI provider server-side. The key never enters the browser bundle. The supplied key is saved only in the ignored `.env.local` file. Default provider: Gemini with `gemini-3.1-flash-lite`. Set `GEMINI_API_KEY` and optionally `GEMINI_MODEL`. Set `AI_PROVIDER=openrouter` with `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` to use OpenRouter instead. Provider selection is explicit; no unused key is sent.

```sh
npm test
npm run test:ai:live # one real AI request, consumes quota
# npm run test:ai:live -- --all # all five live scenarios, consumes five requests
npm run build
npm start # local production server at http://localhost:3001
```

For the production server, add its browser origin to `ALLOWED_ORIGINS`. The server binds to loopback by default. `HOST` and `PORT` are configurable. Before exposing the API publicly, put it behind your own authentication and HTTPS gateway; the included origin allowlist and rate limit are for a personal prototype, not user authentication.

## The experience

- **Onboarding:** three conversational questions about name, daily role, and responsibilities. Personality is inferred from those answers. The AI acknowledges answers and asks follow-ups. Profile editing is available in the header and Your day.
- **Alarm debate:** the alarm rings while you text Duvet. Duvet actively pitches staying in bed using cozy defaults, tiny commitments, earned-rest framing, and immediate comfort. It does not ask users to justify getting up. An explicit final choice to wake up or go back to bed ends the alarm. PG-13 instructions, structured responses, and output screening constrain the character. Generated content still needs evaluation; no model filter is an absolute guarantee.
- **Make it worse:** each tap adds a different synthesized sound layer, up to eight. Overall gain is bounded. Accessibility mute and emergency stop stay available.
- **Your day:** tasks with due dates, opt-in unproductivity reminders, and explicit Pending / Done / Neglected / Missed statuses. Reminder copy is generated when a task is created, then saved for scheduled delivery. No background AI connection is needed to deliver it. Browser reminders appear across app tabs while the page remains open.
- **Stats:** actual ringing duration, task statuses marked Neglected or Missed, and a history of alarm outcomes. Practice alarms are labeled and are included in history. Stats are saved on this device, not invented.
- Existing world clocks, stopwatch/laps, timer, alarm editing, repeat days, and local persistence remain available.
- **Offline character:** if the AI provider times out, rejects credentials, or reaches its quota, the UI labels the offline fallback and still allows either conversation outcome. An internet failure cannot trap the user in a ringing alarm.

## iPhone

```sh
npm run build
npx cap sync ios
npm run ios
```

Select your signing team and device in Xcode. The native project is already generated. The display name is **Alarm Clock**.

For live AI on a physical iPhone, deploy the Node API behind HTTPS, set `VITE_AI_BASE_URL` to that backend's origin in `.env.local`, add `capacitor://localhost` to the server's `ALLOWED_ORIGINS`, then rebuild and sync. Keep provider API keys on the server. Without a backend URL the installed app uses the labeled offline character. A server running only on your Mac's loopback address is not reachable from a physical iPhone.

### Timing and background limits

A fully powered-off iPhone cannot run this app or deliver its alarms. When locked or the app is closed, saved alarms and task reminders use Capacitor Local Notifications. Their audio follows iOS notification, Focus, and silent-mode settings. Tap an alarm notification to open the conversation. The continuous layered audio and chatbot run while the app is open; notifications do not continuously ring until a chat is completed. This prototype does not implement Apple's AlarmKit or privileged system Clock behavior. Test delivery on a physical device before relying on it.

A browser must stay open to ring alarms or show task reminders. Timer completion is an in-app alarm debate, not a scheduled native timer notification. Durations use timestamps rather than counting interval ticks. The native notification budget reserves up to 32 alert schedules for alarms and 30 for tasks, within iOS's 64-pending-notification limit. Example alarms are not scheduled natively until saved or toggled.

## Privacy and design

Profiles, tasks, and debate outcomes remain in local storage. Profile data and chat text are sent to the selected AI provider only when requesting AI replies; task titles are sent when generating reminder copy. The Node API does not log or retain chats. Avoid entering private or sensitive details.

The SvaraNova `frontend-ui` skill was installed and used for the React/plain-CSS design, shared tokens, semantic controls, visible labels, keyboard behavior, and responsive browser checks. See [SvaraNova/skills](https://github.com/SvaraNova/skills).

If the AI says it is offline, check the displayed reason. Daily quota exhaustion requires waiting for the provider reset or changing the server-side model to one with available quota. Temporary rate limits, invalid credentials, filtered responses, and unreachable servers are reported separately. Automated tests use mocked responses and consume no provider quota.

Onboarding is conversational: unrelated questions are answered before returning to setup, and only accepted answers advance it. A failed AI call keeps the current question. The origin guard accepts the current server host/port and same-port loopback aliases, so localhost, 127.0.0.1, and the preview server need not share a hardcoded port. Other cross-origin clients must be listed in `ALLOWED_ORIGINS`.

### ElevenLabs voice
Set `ELEVENLABS_API_KEY` in ignored `.env.local`, optionally set `ELEVENLABS_VOICE_ID`, then restart the dev server. During an alarm choose Start voice conversation. Duvet speaks, then listens automatically; pause after speaking to send. Tap the orb to interrupt Duvet or submit a recording, and use End voice conversation to stop microphone access. Recording requires microphone permission and HTTPS or localhost; recordings are capped at 30 seconds. Gemini remains the conversation model; ElevenLabs handles transcription and spoken replies. Alarm audio stays paused throughout voice mode. Native builds need the hosted API configured and microphone permission.
