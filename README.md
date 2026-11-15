# Clock

An iPhone-inspired clock built with React, TypeScript, Vite, and Capacitor. Includes editable alarms, weekly repeat schedules, snooze, persistent local storage, world clocks, stopwatch laps, and a countdown timer.

## Run

```sh
npm install
npm run dev
```

## iOS

```sh
npm run build
npx cap add ios # only if the ios directory does not exist
npm run ios
```

Open the generated project in Xcode, select your signing team and a simulator or device, and run. Native alarms request notification permission when enabled. Capacitor Local Notifications schedules device alerts even when the web view is closed. Notification delivery and audio follow iOS permissions, Focus, and silent-mode settings; this app does not implement Apple's AlarmKit or the system Clock app's privileged alarm behavior. Test notification delivery on a physical device before relying on it.

In a browser, alarms and timers ring only while the page is open and active. Browser audio requires interaction with the page. Stopwatch and countdown durations use elapsed wall-clock time. Timer completion is currently an in-app alert; only saved alarms schedule native notifications.

Alarm data stays on the device. The three initial alarms are examples; native scheduling begins when you save or toggle an alarm.
