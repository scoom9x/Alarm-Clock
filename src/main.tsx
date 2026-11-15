import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlarmClock,
  Globe2,
  Timer,
  Clock3,
  Plus,
  ChevronRight,
  BedDouble,
  Sun,
  X,
  Minus,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import {
  LocalNotifications,
  type LocalNotificationSchema,
} from "@capacitor/local-notifications";
import "./style.css";
import {
  AlarmConversation,
  ModalShell,
  ReminderNudges,
  Dashboard,
  Onboarding,
  readProfile,
  stored,
  type Profile,
} from "./experience";
type Alarm = {
  id: number;
  time: string;
  label: string;
  days: number[];
  enabled: boolean;
  snooze: boolean;
  sound: string;
};
const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const initial: Alarm[] = [
  {
    id: 1,
    time: "07:00",
    label: "Early bird",
    days: [1, 2, 3, 4, 5],
    enabled: true,
    snooze: true,
    sound: "Radar",
  },
  {
    id: 2,
    time: "08:30",
    label: "Slow mornings",
    days: [0, 6],
    enabled: false,
    snooze: true,
    sound: "Radar",
  },
  {
    id: 3,
    time: "09:00",
    label: "Alarm",
    days: [],
    enabled: false,
    snooze: true,
    sound: "Radar",
  },
];
function read(): Alarm[] {
  try {
    return (
      JSON.parse(localStorage.getItem("clock-alarms") || "null") || initial
    );
  } catch {
    return initial;
  }
}
function timeParts(t: string) {
  const [h, m] = t.split(":").map(Number);
  return {
    time: `${h % 12 || 12}:${String(m).padStart(2, "0")}`,
    period: h < 12 ? "AM" : "PM",
  };
}
function repeatText(a: Alarm) {
  return a.days.length === 7
    ? "Every day"
    : a.days.length === 0
      ? ""
      : a.days.join() === "1,2,3,4,5"
        ? "Weekdays"
        : a.days.join() === "0,6"
          ? "Weekends"
          : a.days.map((d) => days[d]).join(", ");
}
function nextTime(a: Alarm) {
  const now = new Date();
  for (let i = 0; i < 8; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const [h, m] = a.time.split(":").map(Number);
    d.setHours(h, m, 0, 0);
    if (d > now && (!a.days.length || a.days.includes(d.getDay()))) return d;
  }
  return new Date();
}
async function schedule(list: Alarm[]) {
  if (!Capacitor.isNativePlatform()) return;
  const pending = await LocalNotifications.getPending();
  const alarmNotifications = pending.notifications.filter(
    (n) => n.id < 2100000000,
  );
  const active = list.filter((a) => a.enabled);
  if (!active.length) {
    if (alarmNotifications.length)
      await LocalNotifications.cancel({ notifications: alarmNotifications });
    return;
  }
  let permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted")
    permission = await LocalNotifications.requestPermissions();
  if (permission.display !== "granted")
    throw new Error(
      "Allow notifications in Settings so your alarms can alert you.",
    );
  const notifications = active.flatMap<LocalNotificationSchema>((a) =>
    a.days.length
      ? a.days.map((day) => ({
          id: a.id * 10 + day,
          title: a.label || "Alarm",
          body: "Your bed has a counteroffer. Open Alarm Clock to make your case.",
          extra: { kind: "alarm", alarmId: a.id },
          sound: "default",
          schedule: {
            on: {
              weekday: day + 1,
              hour: Number(a.time.split(":")[0]),
              minute: Number(a.time.split(":")[1]),
            },
            repeats: true,
          },
        }))
      : [
          {
            id: a.id * 10 + 7,
            title: a.label || "Alarm",
            body: "Your bed has a counteroffer. Open Alarm Clock to make your case.",
            extra: { kind: "alarm", alarmId: a.id },
            sound: "default",
            schedule: { at: nextTime(a) },
          },
        ],
  );
  if (notifications.length > 32)
    throw new Error(
      "Choose fewer repeat days or enabled alarms (32 scheduled alerts maximum, leaving room for task reminders).",
    );
  await LocalNotifications.schedule({ notifications });
  const keep = new Set(notifications.map((n) => n.id));
  const removed = alarmNotifications.filter((n) => !keep.has(n.id));
  if (removed.length)
    await LocalNotifications.cancel({ notifications: removed });
}
function App() {
  const [alarms, setAlarms] = useState(read);
  const [tab, setTab] = useState("Alarm");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Alarm | null>(null);
  const [now, setNow] = useState(new Date());
  const [ring, setRing] = useState<Alarm | null>(() =>
    stored<Alarm | null>("duvet-active-alarm", null),
  );
  const [profile, setProfile] = useState<Profile | null>(readProfile);
  const [editProfile, setEditProfile] = useState(false);
  const [error, setError] = useState("");
  const fired = useRef(new Set<string>());
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  const [minutes, setMinutes] = useState(5);
  const [remaining, setRemaining] = useState(0);
  const [timerEnd, setTimerEnd] = useState<number | null>(null);
  const audio = useRef<AudioContext | null>(null);
  useEffect(() => {
    const unlock = () => {
      try {
        audio.current ||= new AudioContext();
        void audio.current.resume();
      } catch {}
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 250);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    localStorage.setItem("clock-alarms", JSON.stringify(alarms));
  }, [alarms]);
  useEffect(() => {
    const t = now.toTimeString().slice(0, 5);
    alarms.forEach((a) => {
      const key = `${a.id}-${now.toDateString()}-${t}`;
      if (
        a.enabled &&
        a.time === t &&
        (!a.days.length || a.days.includes(now.getDay())) &&
        !fired.current.has(key)
      ) {
        fired.current.add(key);
        setRing(a);
        if (!a.days.length)
          setAlarms((v) =>
            v.map((x) => (x.id === a.id ? { ...x, enabled: false } : x)),
          );
      }
    });
    if (timerEnd) {
      setRemaining(Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000)));
      if (now.getTime() >= timerEnd) {
        setTimerEnd(null);
        setRing({
          id: 0,
          time: "00:00",
          label: "Timer",
          days: [],
          enabled: false,
          snooze: false,
          sound: "Radar",
        });
      }
    }
  }, [now, alarms, timerEnd]);
  useEffect(() => {
    if (!running) return;
    let last = Date.now();
    const id = setInterval(() => {
      const n = Date.now();
      setElapsed((v) => v + n - last);
      last = n;
    }, 30);
    return () => clearInterval(id);
  }, [running]);
  useEffect(() => {
    if (ring) {
      localStorage.setItem("duvet-active-alarm", JSON.stringify(ring));
      if (!localStorage.getItem("duvet-ring-start"))
        localStorage.setItem("duvet-ring-start", String(Date.now()));
    }
  }, [ring]);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = LocalNotifications.addListener(
      "localNotificationActionPerformed",
      ({ notification }) => {
        if (notification.extra?.kind === "reminder") {
          setTab("Your day");
          return;
        }
        const alarm = stored<Alarm[]>("clock-alarms", []).find(
          (a) => a.id === notification.extra?.alarmId,
        );
        if (alarm) {
          setRing(alarm);
          if (!alarm.days.length)
            setAlarms((v) =>
              v.map((a) => (a.id === alarm.id ? { ...a, enabled: false } : a)),
            );
        }
      },
    );
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, []);
  function demo() {
    setRing({
      id: -1,
      time: new Date().toTimeString().slice(0, 5),
      label: "Practice alarm",
      days: [],
      enabled: false,
      snooze: false,
      sound: "Radar",
    });
  }
  async function commit(list: Alarm[]) {
    try {
      await schedule(list);
      setAlarms(list);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not schedule alarm.");
      return false;
    }
  }
  const active = alarms
    .filter((a) => a.enabled)
    .sort((a, b) => +nextTime(a) - +nextTime(b))[0];
  const next = active ? nextTime(active) : null;
  const duration = next ? Math.ceil((+next - +now) / 60000) : 0;
  const add = () =>
    setDraft({
      id: crypto.getRandomValues(new Uint32Array(1))[0] % 200000000,
      time: "07:00",
      label: "Alarm",
      days: [],
      enabled: true,
      snooze: true,
      sound: "Radar",
    });
  const stopwatch = (ms: number) =>
    `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(Math.floor(ms / 10) % 100).padStart(2, "0")}`;
  if (!profile || editProfile)
    return (
      <Onboarding
        onComplete={(p) => {
          setProfile(p);
          setEditProfile(false);
        }}
        onCancel={profile ? () => setEditProfile(false) : undefined}
      />
    );
  if (ring)
    return (
      <AlarmConversation
        label={ring.label}
        profile={profile}
        onFinish={() => {
          setRing(null);
          localStorage.removeItem("duvet-active-alarm");
          localStorage.removeItem("duvet-ring-start");
          setTab("Your day");
        }}
      />
    );
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header>
        <div className="brand">
          <Clock3 size={21} />
          <span>Alarm Clock</span>
        </div>
        <span className="date">
          {now.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </span>
        <button className="profile-button" onClick={() => setEditProfile(true)}>
          <Sparkles size={13} />
          <span>
            {profile.name} · {profile.tone}
          </span>
        </button>
        <span className="live-dot" />{" "}
      </header>
      <main id="main" tabIndex={-1}>
        <div className="toolbar">
          {tab === "Alarm" && (
            <button
              className="text-button"
              onClick={() => setEditing(!editing)}
            >
              {editing ? "Done" : "Edit"}
            </button>
          )}
          {tab === "Alarm" && (
            <button className="add-button" aria-label="Add alarm" onClick={add}>
              <Plus size={27} />
            </button>
          )}
        </div>
        <div className="title-row">
          <h1>{tab === "Alarm" ? "Alarms" : tab}</h1>
          <span className="eyebrow">
            {tab === "Alarm" ? "A LITTLE FRIENDLY SABOTAGE" : ""}
          </span>
        </div>
        {tab === "Your day" ? (
          <Dashboard
            profile={profile}
            onEdit={() => setEditProfile(true)}
            onDemo={demo}
            onReset={() => {
              localStorage.removeItem("duvet-profile");
              setProfile(null);
            }}
          />
        ) : tab === "Alarm" ? (
          <>
            <button className="demo-banner" onClick={demo}>
              <BedDouble size={27} />
              <div>
                <strong>Your bed has a counteroffer.</strong>
                <span>
                  Meet Duvet, your {profile.tone.toLowerCase()} unproductivity
                  sidekick.
                </span>
              </div>
              <small>TRY AN ALARM</small>
              <ChevronRight size={18} />
            </button>
            <div className="section-heading">
              <h2>
                Your alarms <span>{alarms.length}</span>
              </h2>
              <span>
                LOCAL TIME ·{" "}
                {now.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className="alarm-list">
              {[...alarms]
                .sort((a, b) => a.time.localeCompare(b.time))
                .map((a) => {
                  const t = timeParts(a.time);
                  return (
                    <div
                      className={`alarm-row ${a.enabled ? "enabled" : ""}`}
                      key={a.id}
                    >
                      {editing && (
                        <button
                          className="delete-icon"
                          aria-label={`Delete ${a.label}`}
                          onClick={() =>
                            void commit(alarms.filter((x) => x.id !== a.id))
                          }
                        >
                          <Minus size={18} />
                        </button>
                      )}
                      <button
                        className="alarm-info"
                        onClick={() => setDraft({ ...a, days: [...a.days] })}
                      >
                        <div className="alarm-time">
                          {t.time}
                          <span>{t.period}</span>
                        </div>
                        <div className="alarm-label">
                          {a.label}
                          {repeatText(a) && (
                            <>
                              <span className="separator">·</span>
                              {repeatText(a)}
                            </>
                          )}
                        </div>
                      </button>
                      <button
                        role="switch"
                        aria-checked={a.enabled}
                        aria-label={`${a.label} at ${t.time} ${t.period}`}
                        className={`toggle ${a.enabled ? "on" : ""}`}
                        onClick={() =>
                          void commit(
                            alarms.map((x) =>
                              x.id === a.id ? { ...x, enabled: !x.enabled } : x,
                            ),
                          )
                        }
                      >
                        <span />
                      </button>
                    </div>
                  );
                })}
              {!alarms.length && (
                <div className="empty">
                  No alarms yet.
                  <button onClick={add}>Add your first alarm</button>
                </div>
              )}
            </div>
            <div className="next-alarm">
              <span className="next-symbol">
                <AlarmClock size={19} />
              </span>
              <div>
                <p>
                  {active
                    ? `Next alarm in ${Math.floor(duration / 60) ? `${Math.floor(duration / 60)} hr ` : ""}${duration % 60} min`
                    : "A little peace and quiet."}
                </p>
                <span>
                  {active
                    ? "Rest easy. We’ll keep an eye on the time."
                    : "All alarms are turned off."}
                </span>
              </div>
            </div>
            <p className="footnote">
              An alarm with questionable intentions. Strictly PG-13.
            </p>
          </>
        ) : tab === "World Clock" ? (
          <div className="world-list">
            {["America/Toronto", "Europe/London", "Asia/Tokyo"].map((zone) => (
              <div className="world-row" key={zone}>
                <div>
                  <p>{zone.split("/")[1]}</p>
                  <span>
                    {now.toLocaleDateString("en-US", {
                      timeZone: zone,
                      weekday: "long",
                    })}
                  </span>
                </div>
                <strong>
                  {now.toLocaleTimeString("en-US", {
                    timeZone: zone,
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </strong>
              </div>
            ))}
          </div>
        ) : tab === "Stopwatch" ? (
          <section className="utility">
            <div className="digital">{stopwatch(elapsed)}</div>
            <div className="utility-controls">
              <button
                onClick={() =>
                  running
                    ? setLaps((v) => [elapsed, ...v])
                    : (setElapsed(0), setLaps([]))
                }
              >
                {running ? "Lap" : "Reset"}
              </button>
              <button
                className={running ? "stop" : "start"}
                onClick={() => setRunning(!running)}
              >
                {running ? "Stop" : "Start"}
              </button>
            </div>
            {laps.map((lap, i) => (
              <div className="lap" key={i}>
                <span>Lap {laps.length - i}</span>
                {stopwatch(lap)}
              </div>
            ))}
          </section>
        ) : (
          <section className="utility">
            <div className="digital">
              {timerEnd || remaining ? (
                `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`
              ) : (
                <>
                  <input
                    aria-label="Timer minutes"
                    type="number"
                    min="1"
                    max="1440"
                    value={minutes}
                    onChange={(e) =>
                      setMinutes(
                        Math.min(
                          1440,
                          Math.max(1, Number(e.target.value) || 1),
                        ),
                      )
                    }
                  />
                  <span className="unit">min</span>
                </>
              )}
            </div>
            <div className="utility-controls">
              <button
                onClick={() => {
                  setTimerEnd(null);
                  setRemaining(0);
                }}
              >
                Cancel
              </button>
              <button
                className={timerEnd ? "stop" : "start"}
                onClick={() => {
                  if (timerEnd) setTimerEnd(null);
                  else {
                    const seconds = remaining || Math.max(1, minutes) * 60;
                    setRemaining(seconds);
                    setTimerEnd(Date.now() + seconds * 1000);
                  }
                }}
              >
                {timerEnd ? "Pause" : remaining ? "Resume" : "Start"}
              </button>
            </div>
          </section>
        )}
      </main>
      <nav aria-label="Clock sections">
        {[
          { name: "World Clock", Icon: Globe2 },
          { name: "Alarm", Icon: AlarmClock },
          { name: "Stopwatch", Icon: Clock3 },
          { name: "Timers", Icon: Timer },
          { name: "Your day", Icon: BarChart3 },
        ].map(({ name, Icon }) => (
          <button
            className={tab === name ? "selected" : ""}
            aria-current={tab === name ? "page" : undefined}
            key={name}
            onClick={() => {
              setTab(name);
              setEditing(false);
            }}
          >
            <Icon size={24} strokeWidth={1.7} />
            <span>{name}</span>
          </button>
        ))}
      </nav>
      {draft && (
        <ModalShell onClose={() => setDraft(null)}>
          <form
            className="modal"

            onKeyDown={(e) => {
              if (e.key === "Escape") setDraft(null);
            }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await commit([
                  ...alarms.filter((a) => a.id !== draft.id),
                  draft,
                ])
              )
                setDraft(null);
            }}
          >
            <div className="modal-header">
              <button type="button" onClick={() => setDraft(null)}>
                Cancel
              </button>
              <h2>
                {alarms.some((a) => a.id === draft.id)
                  ? "Edit Alarm"
                  : "Add Alarm"}
              </h2>
              <button type="submit">Save</button>
            </div>
            <input
              className="time-input"
              autoFocus
              type="time"
              aria-label="Alarm time"
              required
              value={draft.time}
              onChange={(e) => setDraft({ ...draft, time: e.target.value })}
            />
            <div className="form-group">
              <label>
                Label
                <input
                  maxLength={50}
                  value={draft.label}
                  onChange={(e) =>
                    setDraft({ ...draft, label: e.target.value })
                  }
                />
              </label>
              <div className="repeat-row">
                <span>Repeat</span>
                <span>{repeatText(draft) || "Never"}</span>
              </div>
              <div className="days">
                {days.map((day, i) => (
                  <button
                    type="button"
                    aria-pressed={draft.days.includes(i)}
                    className={draft.days.includes(i) ? "chosen" : ""}
                    key={day}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        days: draft.days.includes(i)
                          ? draft.days.filter((x) => x !== i)
                          : [...draft.days, i].sort(),
                      })
                    }
                  >
                    {day}
                  </button>
                ))}
              </div>
              <label>
                Sound<span className="sound-label">Radar</span>
              </label>
              <p className="alarm-mode-note">
                To stop this alarm, make your case to Duvet or agree to go back
                to bed. Emergency stop is always available.
              </p>
            </div>
            {alarms.some((a) => a.id === draft.id) && (
              <button
                className="delete-alarm"
                type="button"
                onClick={async () => {
                  if (await commit(alarms.filter((a) => a.id !== draft.id)))
                    setDraft(null);
                }}
              >
                Delete Alarm
              </button>
            )}
          </form>
        </ModalShell>
      )}
      <ReminderNudges />
      {error && (
        <div role="alert" className="toast">
          {error}
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
