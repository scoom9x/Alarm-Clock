# Alarm Clock

A React + TypeScript + Capacitor clock with an unnamed, sleepy voice that makes a casual case for staying in bed.

## Run locally

```sh
npm install
cp .env.example .env.local # skip if your private .env.local already exists
# Set GEMINI_API_KEY in .env.local. Do not use a VITE_ prefix for the key.
npm run dev
```

Open http://localhost:5173. The Vite server handles `/api/chat` and calls Gemini server-side. The key never enters the browser bundle. The supplied key is saved only in the ignored `.env.local` file. Default model: `gemini-3.5-flash` with minimal thinking for low latency; override with `GEMINI_MODEL`.

### Voice input

Set `ELEVENLABS_API_KEY` in ignored `.env.local` and restart the server to enable the microphone button beside the chat input. It records up to 30 seconds, transcribes through ElevenLabs, and puts the text in the composer for review before sending. Microphone access requires permission and HTTPS or localhost. Without the key, typed chat remains available.

```sh
npm test
npm run build
npm start # local production server at http://localhost:3001
```

For the production server, add its browser origin to `ALLOWED_ORIGINS`. The server binds to loopback by default. `HOST` and `PORT` are configurable. Before exposing the API publicly, put it behind your own authentication and HTTPS gateway; the included origin allowlist and rate limit are for a personal prototype, not user authentication.

## The experience

- **Onboarding:** four conversational questions about name, daily role, responsibilities, and what makes mornings easier. The app infers a reply style from those answers. Profile editing is available in the header and Your day.
- **Alarm debate:** the voice argues back either way. A bare “I’m going” or “I’m staying” does not settle it; waking needs a time-bound obligation, serious consequence, and no reasonable alternative. Choosing bed gets one quick confirmation. Urgent safety needs and the stop control can end the sound.
- **Turn it up:** each tap doubles the synthesized sound layers, up to eight, and sharply raises the volume. Accessibility mute and the stop control stay available.
- **Your day:** tasks with due dates and explicit Pending / Done / Neglected / Missed statuses. Tasks do not send notifications.
- **Stats:** actual ringing duration, task statuses marked Neglected or Missed, and a history of alarm outcomes. Practice alarms are labeled and are included in history. Stats are saved on this device, not invented.
- Alarm editing, repeat days, and local persistence remain available.
- **Offline character:** if Gemini times out, rejects credentials, or reaches its quota, the UI labels the offline fallback and still allows either conversation outcome. An internet failure cannot trap the user in a ringing alarm.

## iPhone

```sh
npm run build
npx cap sync ios
npm run ios
```

Select your signing team and device in Xcode. The native project is already generated. The display name is **Alarm Clock**.

For Gemini on a physical iPhone, deploy the Node API behind HTTPS, set `VITE_AI_BASE_URL` to that backend's origin in `.env.local`, add `capacitor://localhost` to the server's `ALLOWED_ORIGINS`, then rebuild and sync. Keep `GEMINI_API_KEY` on the server. Without a backend URL the installed app uses the labeled offline character. A server running only on your Mac's loopback address is not reachable from a physical iPhone.

Voice input on iPhone uses the same hosted API. Set `ELEVENLABS_API_KEY` on that server and allow microphone permission in the native app.

### Timing and background limits

A fully powered-off iPhone cannot run this app or deliver its alarms. When locked or the app is closed, saved alarms use Capacitor Local Notifications. Their audio follows iOS notification, Focus, and silent-mode settings. Tap an alarm notification to open the conversation. The continuous layered audio and chatbot run while the app is open; notifications do not continuously ring until a chat is completed. This prototype does not implement Apple's AlarmKit or privileged system Clock behavior. Test delivery on a physical device before relying on it.

A browser must stay open to ring alarms. The native notification budget allows up to 64 scheduled alarms. Example alarms are not scheduled natively until saved or toggled.

## Privacy and design

Profiles, tasks, and debate outcomes remain in local storage. Profile data and chat text are sent to Google only when requesting AI replies. Voice recordings are sent to ElevenLabs only when voice transcription is used. The Node API does not log or retain chats or recordings. Avoid entering private or sensitive details.

The SvaraNova `frontend-ui` skill was installed and used for the React/plain-CSS design, shared tokens, semantic controls, visible labels, keyboard behavior, and responsive browser checks. See [SvaraNova/skills](https://github.com/SvaraNova/skills).
