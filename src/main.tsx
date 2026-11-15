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
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import {
  LocalNotifications,
  type LocalNotificationSchema,
} from "@capacitor/local-notifications";
import "./style.css";
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
  if (pending.notifications.length) await LocalNotifications.cancel(pending);
  const active = list.filter((a) => a.enabled);
  if (!active.length) return;
  let permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted")
    permission = await LocalNotifications.requestPermissions();
  if (permission.display !== "granted")
    throw new Error(
      "Allow notifications in Settings so your alarms can alert you.",
    );
  await LocalNotifications.schedule({
    notifications: active.flatMap<LocalNotificationSchema>((a) =>
      a.days.length
        ? a.days.map((day) => ({
            id: a.id * 10 + day,
            title: a.label || "Alarm",
            body: "Time to wake up.",
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
              body: "Time to wake up.",
              sound: "default",
              schedule: { at: nextTime(a) },
            },
          ],
    ),
  });
}
function App() {
  const [alarms, setAlarms] = useState(read);
  const [tab, setTab] = useState("Alarm");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Alarm | null>(null);
  const [now, setNow] = useState(new Date());
  const [ring, setRing] = useState<Alarm | null>(null);
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
    if (!ring) return;
    const beep = () => {
      try {
        const ctx = audio.current || new AudioContext();
        audio.current = ctx;
        void ctx.resume();
        [0, 0.18, 0.36].forEach((delay) => {
          const osc = ctx.createOscillator(),
            gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 880;
          gain.gain.setValueAtTime(0.13, ctx.currentTime + delay);
          gain.gain.exponentialRampToValueAtTime(
            0.001,
            ctx.currentTime + delay + 0.15,
          );
          osc.start(ctx.currentTime + delay);
          osc.stop(ctx.currentTime + delay + 0.16);
        });
      } catch {}
    };
    beep();
    const id = setInterval(beep, 1500);
    return () => clearInterval(id);
  }, [ring]);
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
      id: Math.floor(Date.now() / 1000) % 200000000,
      time: "07:00",
      label: "Alarm",
      days: [],
      enabled: true,
      snooze: true,
      sound: "Radar",
    });
  const stopwatch = (ms: number) =>
    `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(Math.floor(ms / 10) % 100).padStart(2, "0")}`;
  return (
    <div className="app">
      <header>
        <div className="brand">
          <Clock3 size={21} />
          <span>Clock</span>
        </div>
        <span className="date">
          {now.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </span>
        <span className="live-dot" />{" "}
      </header>
      <main>
        <div className="toolbar">
          <button className="text-button" onClick={() => setEditing(!editing)}>
            {tab === "Alarm" ? (editing ? "Done" : "Edit") : ""}
          </button>
          {tab === "Alarm" && (
            <button className="add-button" aria-label="Add alarm" onClick={add}>
              <Plus size={27} />
            </button>
          )}
        </div>
        <div className="title-row">
          <h1>{tab === "Alarm" ? "Alarms" : tab}</h1>
          <span className="eyebrow">
            {tab === "Alarm" ? "MAKE TIME FOR A GOOD MORNING" : ""}
          </span>
        </div>
        {tab === "Alarm" ? (
          <>
            <section className="sleep-card">
              <div className="sleep-top">
                <span>
                  <BedDouble size={21} /> Sleep | Wake Up
                </span>
                <span className="pill">YOUR ROUTINE</span>
              </div>
              <div className="sleep-content">
                <div className="sun-icon">
                  <Sun size={31} />
                </div>
                <div>
                  <h2>A better day starts tonight.</h2>
                  <p>Give your mornings a little more rhythm.</p>
                </div>
                <button
                  className="round-link"
                  aria-label="Set a wake-up alarm"
                  onClick={() =>
                    setDraft({
                      id: Math.floor(Date.now() / 1000) % 200000000,
                      time: "07:00",
                      label: "Wake Up",
                      days: [1, 2, 3, 4, 5],
                      enabled: true,
                      snooze: true,
                      sound: "Radar",
                    })
                  }
                >
                  <ChevronRight size={22} />
                </button>
              </div>
            </section>
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
            <p className="footnote">A fresh start, right on time.</p>
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
      <nav>
        {[
          { name: "World Clock", Icon: Globe2 },
          { name: "Alarm", Icon: AlarmClock },
          { name: "Stopwatch", Icon: Clock3 },
          { name: "Timers", Icon: Timer },
        ].map(({ name, Icon }) => (
          <button
            className={tab === name ? "selected" : ""}
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
        <div className="overlay" onClick={() => setDraft(null)}>
          <form
            className="modal"
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
              <label>
                Snooze
                <button
                  type="button"
                  className={`toggle ${draft.snooze ? "on" : ""}`}
                  role="switch"
                  aria-checked={draft.snooze}
                  onClick={() => setDraft({ ...draft, snooze: !draft.snooze })}
                >
                  <span />
                </button>
              </label>
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
        </div>
      )}
      {ring && (
        <div className="overlay ringing">
          <Sun size={54} />
          <h1>{ring.label}</h1>
          <div className="ring-time">
            {now.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </div>
          {ring.snooze && (
            <button
              className="snooze"
              onClick={async () => {
                const d = new Date(Date.now() + 9 * 60000);
                const a = {
                  ...ring,
                  id: Math.floor(Date.now() / 1000) % 200000000,
                  time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
                  days: [],
                  enabled: true,
                };
                await commit([...alarms, a]);
                setRing(null);
              }}
            >
              Snooze for 9 minutes
            </button>
          )}
          <button className="dismiss" onClick={() => setRing(null)}>
            Stop
          </button>
        </div>
      )}
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
