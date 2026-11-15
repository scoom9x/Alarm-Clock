import { VoiceControls } from "./VoiceControls";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUp,
  BedDouble,
  Sparkles,
  Plus,
  Bell,
  Volume2,
  Check,
  X,
  Moon,
  BarChart3,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import "./experience.css";
export type Profile = {
  name: string;
  role: string;
  responsibilities: string;
  tone: string;
};
type Message = { role: "user" | "assistant"; text: string };
type Reply = {
  message: string;
  outcome: "continue" | "awake" | "bed";
  source: "gemini" | "openrouter" | "offline";
  notice?: string;
  advance?: boolean;
};
export type Task = {
  id: number;
  title: string;
  due: string;
  status: "pending" | "done" | "missed" | "neglected";
  reminder?: string;
};
type Session = {
  id: number;
  label: string;
  started: number;
  seconds: number;
  outcome: string;
  layers: number;
};
export function stored<T>(key: string, otherwise: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? otherwise;
  } catch {
    return otherwise;
  }
}
function save(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}
export function readProfile() {
  return stored<Profile | null>("duvet-profile", null);
}
export const clockDuration = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
function localFallback(
  mode: string,
  messages: Message[],
  profile: Profile,
  nextQuestion?: string,
): Reply {
  const last = messages.filter((m) => m.role === "user").at(-1)?.text || "";
  let message =
      mode === "onboarding"
        ? "I couldn’t connect to the AI. Please try your answer again."
        : "The pillow is already warm. Stay exactly where you are for five more minutes.",
    outcome: Reply["outcome"] = "continue";
  if (mode === "alarm") {
    if (
      /\b(back to (bed|sleep)|go(ing)? to (bed|sleep)|give in|stay in bed)\b/i.test(
        last,
      ) &&
      !/\b(not|won.t|never|no)\b/i.test(last)
    ) {
      outcome = "bed";
      message =
        "The duvet wins this round. Rest well; you can choose a fresh start later.";
    } else if (
      /\b((need|must|want|will|going to) (to )?(wake|get up|leave|go)|getting up|i.?m awake)\b/i.test(
        last,
      )
    ) {
      outcome = "awake";
      message =
        "Fair enough. That is a good reason to get up. You win this round!";
    } else
      message =
        profile.tone === "Gentle"
          ? "You are more than your to-do list. You’ve earned a soft landing. Let the blanket keep you a little longer."
          : "Your to-do list can keep standing. You have already mastered lying down. Five more minutes is practically a plan.";
  }
  if (mode === "reminder")
    message =
      "Your to-do list called. I told it you were chairing a very important blanket meeting. (Kidding. You decide.)";
  return {
    message,
    outcome,
    source: "offline",
    notice: "Offline character · The AI is unavailable.",
  };
}
export async function ask(
  mode: string,
  messages: Message[],
  profile: Profile,
  nextQuestion?: string,
  task?: string,
  currentQuestion?: string,
): Promise<Reply> {
  const base =
    (import.meta as ImportMeta & { env: Record<string, string> }).env
      .VITE_AI_BASE_URL || "";
  try {
    if (Capacitor.isNativePlatform() && !base)
      return {
        ...localFallback(mode, messages, profile, nextQuestion),
        notice:
          "Live AI is not connected on this device. The offline character is replying.",
      };
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        messages: messages.slice(-16),
        profile,
        nextQuestion,
        task,
        currentQuestion,
      }),
      signal: AbortSignal.timeout(28000),
    });
    if (!res.ok)
      return {
        ...localFallback(mode, messages, profile, nextQuestion),
        notice:
          res.status === 429
            ? "Too many messages at once. The offline character is replying; try again shortly."
            : res.status === 403
              ? "The AI server rejected this app’s connection (403). The offline character is replying."
              : res.status === 400
                ? "The AI server rejected the chat request (400). The offline character is replying."
                : `The AI server returned an error (${res.status}). The offline character is replying.`,
      };
    const data = await res.json();
    if (
      typeof data.message !== "string" ||
      !["continue", "awake", "bed"].includes(data.outcome) ||
      !["gemini", "openrouter", "offline"].includes(data.source)
    )
      throw new Error("Invalid reply");
    return data;
  } catch (error) {
    return {
      ...localFallback(mode, messages, profile, nextQuestion),
      notice:
        error instanceof Error &&
        ["TimeoutError", "AbortError"].includes(error.name)
          ? "The AI took too long to respond. The offline character is replying; try your next message again."
          : "Could not reach the AI server. The offline character is replying. Check your connection and try again.",
    };
  }
}
function Avatar() {
  return (
    <span className="duvet-avatar">
      <Moon size={19} />
    </span>
  );
}
function Transcript({
  messages,
  busy,
}: {
  messages: Message[];
  busy: boolean;
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, [messages, busy]);
  return (
    <div className="transcript" aria-live="polite">
      {messages.map((m, i) => (
        <div className={`chat-line ${m.role}`} key={i}>
          {m.role === "assistant" && <Avatar />}
          <div>{m.text}</div>
        </div>
      ))}
      {busy && (
        <div className="chat-line assistant">
          <Avatar />
          <div className="typing">
            Duvet is thinking<span>…</span>
          </div>
        </div>
      )}
      <div ref={end} />
    </div>
  );
}
function Composer({
  onSend,
  busy,
  placeholder = "Talk to Duvet…",
}: {
  onSend: (s: string) => void;
  busy: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim() && !busy) {
          onSend(text.trim());
          setText("");
        }
      }}
    >
      <label className="composer-field">
        <span>Message Duvet</span>
        <input
          aria-label="Message Duvet"
          maxLength={600}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          disabled={busy}
        />
      </label>
      <button aria-label="Send message" disabled={busy || !text.trim()}>
        <ArrowUp size={21} />
      </button>
    </form>
  );
}
const questions = [
  "First things first. What should I call you?",
  "What fills your days: studying, working, looking for work, or something else?",
  "What is on your plate lately: classes, work, projects, or other plans?",
];
export function Onboarding({
  onComplete,
  onCancel,
}: {
  onComplete: (p: Profile) => void;
  onCancel?: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: `I’m Duvet, your alarm’s questionable life coach. I’m here to talk you into staying in bed. ${questions[0]}`,
    },
  ]);
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<Profile>({
    name: "",
    role: "",
    responsibilities: "",
    tone: "Cheeky",
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const [source, setSource] = useState("");
  async function send(text: string) {
    if (busy) return;
    const next = [...messages, { role: "user" as const, text }];
    setMessages(next);
    setBusy(true);
    setNotice("");
    const response = await ask(
      "onboarding",
      next,
      profile,
      step === questions.length - 1
        ? "Setup is complete. Briefly acknowledge their responsibilities, infer your personality from their answers without asking them to select a tone, and invite them to set an alarm."
        : questions[step + 1],
      undefined,
      questions[step],
    );
    setMessages([...next, { role: "assistant", text: response.message }]);
    setNotice(response.notice || "");
    setSource(response.source);
    setBusy(false);
    if (response.source === "offline" || response.advance !== true) return;
    const p = {
      ...profile,
      [["name", "role", "responsibilities"][step]]: text,
    };
    if (step === questions.length - 1) {
      const answers = `${p.role} ${p.responsibilities}`;
      p.tone = /stress|overwhelm|exhaust|tired|pressure|anxious/i.test(answers)
        ? "Gentle"
        : /exam|deadline|interview|project/i.test(answers)
          ? "Dramatic"
          : "Cheeky";
    }
    setProfile(p);
    if (step === questions.length - 1) setReady(true);
    else setStep(step + 1);
  }
  return (
    <main className="intro-screen">
      <div className="intro-shell">
        <div className="intro-top">
          <span className="wordmark">
            <BedDouble size={23} /> Alarm Clock
          </span>
          {onCancel && (
            <button onClick={onCancel} aria-label="Close profile editor">
              <X size={20} />
            </button>
          )}
          <span className="pg-badge">PG-13</span>
        </div>
        <div className="intro-heading">
          <h1>Meet Duvet.</h1>
          <p className="intro-subtitle">Your alarm’s bad influence.</p>
          <p>Three questions. Then your pillow gets an unfair advantage.</p>
          <div
            className="setup-progress"
            aria-label={`Setup question ${step + 1} of ${questions.length}`}
          >
            {questions.map((_, i) => (
              <span key={i} className={i <= step ? "complete" : ""} />
            ))}
          </div>
        </div>
        <div className="intro-chat">
          <div className="chat-title">
            <Avatar />
            <div>
              <strong>Duvet</strong>
              <span>
                {source === "gemini"
                  ? "Live Gemini reply"
                  : source === "openrouter"
                    ? "Live OpenRouter reply"
                    : "Your unproductivity sidekick"}
              </span>
            </div>
            <span className="step-count">
              {ready ? "Ready" : `${step + 1} / ${questions.length}`}
            </span>
          </div>
          <Transcript messages={messages} busy={busy} />
          {notice && <p className="ai-notice">{notice}</p>}
          {ready ? (
            <button
              className="primary-wide"
              onClick={() => {
                save("duvet-profile", profile);
                onComplete(profile);
              }}
            >
              Meet your mornings <ArrowUp size={18} />
            </button>
          ) : (
            <>
              <div className="quick-replies">
                {(step === 1
                  ? ["Student", "Working", "Looking for work", "Something else"]
                  : []
                ).map((s) => (
                  <button disabled={busy} key={s} onClick={() => void send(s)}>
                    {s}
                  </button>
                ))}
              </div>
              <Composer
                busy={busy}
                onSend={send}
                placeholder={
                  step === 0
                    ? "Your first name…"
                    : "Tell Duvet a little about you…"
                }
              />
            </>
          )}
        </div>
        <p className="intro-privacy">
          Keep it light. Your profile stays on this device and is sent to the
          selected AI provider with your chats to personalize replies. Don’t
          share private details. This is a comedy app; your responsibilities
          still matter.
        </p>
      </div>
    </main>
  );
}
export function AlarmConversation({
  label,
  profile,
  onFinish,
}: {
  label: string;
  profile: Profile;
  onFinish: () => void;
}) {
  const [started] = useState(() =>
    stored<number>("duvet-ring-start", Date.now()),
  );
  const [seconds, setSeconds] = useState(
    Math.floor((Date.now() - started) / 1000),
  );
  const [layers, setLayers] = useState(1);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: `Morning, ${characterName(profile.name)}. ${profile.tone === "Gentle" ? "You are more than your " + (profile.role.toLowerCase().includes("student") ? "grades" : "work") + ". The world can wait a moment." : "Your " + (profile.role.toLowerCase().includes("student") ? "notes" : "to-do list") + " will survive a little suspense."} Your pillow is already doing its job perfectly. Let it keep going for five more minutes.`,
    },
  ]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [outcome, setOutcome] = useState("");
  const [muted, setMuted] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const context = useRef<AudioContext | null>(null);
  const finished = useRef(false);
  useEffect(() => {
    if (outcome) return;
    save("duvet-ring-start", started);
    const id = setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      250,
    );
    return () => clearInterval(id);
  }, [started, outcome]);
  useEffect(() => {
    if (muted || voiceActive || outcome) return;
    const ctx = new AudioContext();
    context.current = ctx;
    const wake = () => void ctx.resume();
    window.addEventListener("pointerdown", wake);
    void ctx.resume();
    const master = ctx.createGain();
    master.gain.value = 0.18;
    const limiter = ctx.createDynamicsCompressor();
    master.connect(limiter); limiter.connect(ctx.destination);
    const pulse = () => {
      for (let layer = 0; layer < layers; layer++) {
        const start = ctx.currentTime;
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = layer % 2 ? "square" : "sawtooth";
        const low = [150, 440, 260, 680, 320, 880, 190, 1100][layer];
        osc.frequency.setValueAtTime(low, start);
        osc.frequency.exponentialRampToValueAtTime(low * 3.1, start + 0.65);
        osc.frequency.exponentialRampToValueAtTime(low, start + 1.3);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.5 / Math.sqrt(layers), start + 0.035);
        gain.gain.setValueAtTime(0.5 / Math.sqrt(layers), start + 1.23);
        gain.gain.linearRampToValueAtTime(0, start + 1.35);
        osc.connect(gain); gain.connect(master);
        osc.start(start); osc.stop(start + 1.36);
      }
    };
    pulse();
    const timer = setInterval(pulse, 1400);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pointerdown", wake);
      void ctx.close();
      context.current = null;
    };
  }, [layers, muted, voiceActive, outcome]);
  function finish(result: string) {
    if (finished.current) return;
    finished.current = true;
    const session: Session = {
      id: Date.now(),
      label,
      started,
      seconds: Math.floor((Date.now() - started) / 1000),
      outcome: result,
      layers,
    };
    const previousSessions = stored<Session[]>("duvet-sessions", []);
    const previousTotal = stored<number>(
      "duvet-total-ring-seconds",
      previousSessions.reduce((n, s) => n + s.seconds, 0),
    );
    save("duvet-total-ring-seconds", previousTotal + session.seconds);
    save(
      "duvet-sessions",
      [session, ...stored<Session[]>("duvet-sessions", [])].slice(0, 200),
    );
    localStorage.removeItem("duvet-ring-start");
    localStorage.removeItem("duvet-active-alarm");
    setOutcome(result);
  }
  async function send(text: string) {
    if (busy || outcome) return;
    const next = [...messages, { role: "user" as const, text }];
    setMessages(next);
    setBusy(true);
    const response = await ask("alarm", next, profile);
    setMessages([...next, { role: "assistant", text: response.message }]);
    setNotice(response.notice || "");
    setBusy(false);
    if (response.outcome !== "continue") finish(response.outcome);
  }
  return (
    <main className="alarm-conversation" aria-label="Negotiate your alarm">
      <div className="debate-shell">
        <div className="debate-top">
          <span className={`ring-indicator ${outcome ? "settled" : ""}`} />
          <span>
            {outcome
              ? "Negotiation complete"
              : voiceActive
                ? "Voice conversation · siren paused"
                : muted
                ? "Sound muted. Debate still on."
                : "Your alarm is ringing"}
          </span>
          <span className="pg-badge">PG-13</span>
        </div>
        <div className="debate-heading">
          <span className="tiny-label">{label}</span>
          <h1>
            {outcome
              ? outcome === "awake"
                ? "You won. Good morning."
                : outcome === "bed"
                  ? "The pillow wins."
                  : "A quiet moment."
              : "Your bed has a counteroffer."}
          </h1>
          <p>
            {outcome
              ? "Alarm stopped. Your next move is up to you."
              : "Duvet knows your plans. It would rather you stayed under the covers."}
          </p>
        </div>
        <div className="ring-dashboard">
          <div>
            <span>Time spent ringing</span>
            <strong>{clockDuration(seconds)}</strong>
          </div>
          <button
            className="chaos-button"
            disabled={layers >= 8 || !!outcome}
            onClick={() => setLayers((l) => Math.min(8, l + 1))}
          >
            <Volume2 size={19} />
            <span>
              {layers === 8 ? "Maximum chaos" : "Make it worse"}
              <small>
                {layers} sound{layers !== 1 ? "s" : ""} layered{" "}
                {layers < 8 ? "· tap to add one" : ""}
              </small>
            </span>
            <Plus size={18} />
          </button>
        </div>
        <div className="sound-stack" aria-label="Active alarm sounds">
          {[
            "Monster siren",
            "Air raid",
            "Broken horn",
            "Panic buzzer",
            "Doom drone",
            "Emergency wail",
            "Rusty klaxon",
            "Final warning",
          ]
            .slice(0, layers)
            .map((name, i) => (
              <div key={name}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <strong>{name}</strong>
                <span>{outcome ? "Stopped" : voiceActive ? "Paused for voice" : muted ? "Muted" : "Playing"}</span>
              </div>
            ))}
        </div>
        <div className="debate-chat">
          <div className="chat-title">
            <Avatar />
            <div>
              <strong>Duvet</strong>
              <span>
                {profile.tone} mode · questionable advice, always PG-13
              </span>
            </div>
            <Sparkles size={16} />
          </div>
          <Transcript messages={messages} busy={busy} />
          {notice && <p className="ai-notice">{notice}</p>}
          {outcome ? (
            <button className="primary-wide" onClick={onFinish}>
              Back to Alarm Clock <Check size={18} />
            </button>
          ) : (
            <><VoiceControls text={messages.filter(m => m.role === "assistant").at(-1)?.text || ""} busy={busy} onSend={send} onActive={setVoiceActive} />
            <Composer onSend={send} busy={busy} /></>
          )}
        </div>
        {!outcome && (
          <div className="debate-safety">
            <button onClick={() => setMuted(!muted)}>
              {muted ? "Restore sound" : "Mute sound for accessibility"}
            </button>
            <button
              onClick={() => {
                finish("emergency");
                onFinish();
              }}
            >
              Emergency stop
            </button>
          </div>
        )}
        <p className="debate-caption">
          A little friendly sabotage. You’re always in control.
        </p>
      </div>
    </main>
  );
}
async function syncReminders(tasks: Task[], enabled: boolean) {
  if (!Capacitor.isNativePlatform()) return;
  const pending = await LocalNotifications.getPending();
  const reminders = pending.notifications.filter((n) => n.id >= 2100000000);
  if (reminders.length)
    await LocalNotifications.cancel({ notifications: reminders });
  if (!enabled) return;
  const permission = await LocalNotifications.requestPermissions();
  if (permission.display !== "granted")
    throw new Error(
      "Enable notifications in iPhone Settings to receive reminders.",
    );
  await LocalNotifications.schedule({
    notifications: tasks
      .filter((t) => t.status === "pending" && +new Date(t.due) > Date.now())
      .slice(0, 30)
      .map((t, i) => ({
        id: 2100000000 + i,
        title: "A message from Duvet",
        body:
          t.reminder ||
          "Your to-do list called. I said you were in a blanket meeting. (Just kidding. Your call.)",
        schedule: {
          at: new Date(
            Math.max(Date.now() + 5000, +new Date(t.due) - 10 * 60000),
          ),
        },
        extra: { kind: "reminder", taskId: t.id },
      })),
  });
}
export function Dashboard({
  profile,
  onEdit,
  onDemo,
  onReset,
}: {
  profile: Profile;
  onEdit: () => void;
  onDemo: () => void;
  onReset: () => void;
}) {
  const [tasks, setTasks] = useState(() => stored<Task[]>("duvet-tasks", []));
  const [sessions] = useState(() => stored<Session[]>("duvet-sessions", []));
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [reminders, setReminders] = useState(() =>
    stored<boolean>("duvet-reminders", false),
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    save("duvet-tasks", tasks);
  }, [tasks]);
  async function update(next: Task[], enabled = reminders) {
    setNotice("");
    try {
      await syncReminders(next, enabled);
      setTasks(next);
      return true;
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "Could not schedule reminders.",
      );
      return false;
    }
  }
  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !due || busy) return;
    if (+new Date(due) <= Date.now()) {
      setNotice("Choose a future due date.");
      return;
    }
    setBusy(true);
    const result = await ask(
      "reminder",
      [{ role: "user", text: "Write a playful reminder for this task." }],
      profile,
      undefined,
      title.trim(),
    );
    const task: Task = {
      id: Date.now(),
      title: title.trim(),
      due,
      status: "pending",
      reminder: result.message,
    };
    if (await update([...tasks, task])) {
      setTitle("");
      setDue("");
      setNotice(
        result.notice ||
          "A little nudge is ready for 10 minutes before this task is due.",
      );
    }
    setBusy(false);
  }
  const total = stored<number>(
      "duvet-total-ring-seconds",
      sessions.reduce((s, x) => s + x.seconds, 0),
    ),
    neglected = tasks.filter((t) => t.status === "neglected").length,
    missed = tasks.filter((t) => t.status === "missed").length;
  return (
    <div className="my-day">
      <div className="day-welcome">
        <div>
          <span className="tiny-label">Your day with Duvet</span>
          <h2>Hey, {profile.name}.</h2>
          <p>
            Duvet has reviewed your plans.
            <br />
            It recommends a horizontal approach.
          </p>
        </div>
        <Avatar />
      </div>
      <div className="metric-grid">
        <div>
          <ClockMetric />
          <strong>{clockDuration(total)}</strong>
          <span>Time spent ringing</span>
        </div>
        <div>
          <BedDouble size={19} />
          <strong>{neglected}</strong>
          <span>Responsibilities neglected</span>
        </div>
        <div>
          <X size={19} />
          <strong>{missed}</strong>
          <span>Tasks missed</span>
        </div>
      </div>
      <p className="metric-note">
        Lifetime stats on this device. Mark your own task outcomes below.
      </p>
      <div className="routine-actions">
        <button onClick={onDemo}>
          <Volume2 size={17} /> Try an alarm conversation
        </button>
        <button onClick={onEdit}>
          Edit your AI profile <Chevron />
        </button>
        <button onClick={onReset}>Forget profile</button>
      </div>
      <section className="task-section">
        <div className="task-header">
          <div>
            <h2>Your very optional to-do list</h2>
            <p>Plans, deadlines, and opportunities to procrastinate.</p>
          </div>
          <Bell size={21} />
        </div>
        <div className="reminder-switch">
          <div>
            <strong>Unproductivity reminders</strong>
            <span>Playful nudges 10 minutes before a task is due.</span>
          </div>
          <button
            className={`toggle ${reminders ? "on" : ""}`}
            role="switch"
            aria-checked={reminders}
            aria-label="Unproductivity reminders"
            onClick={async () => {
              const enabled = !reminders;
              if (await update(tasks, enabled)) {
                setReminders(enabled);
                save("duvet-reminders", enabled);
                if (!Capacitor.isNativePlatform() && enabled)
                  setNotice(
                    "Browser reminders appear here while this page is open. iPhone reminders use local notifications.",
                  );
              }
            }}
          >
            <span />
          </button>
        </div>
        <form className="task-form" onSubmit={addTask}>
          <label className="task-label" htmlFor="task-title">
            Task (required)
          </label>
          <input
            id="task-title"
            required
            maxLength={120}
            placeholder="A task Duvet can gently undermine…"
            aria-label="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label className="task-label" htmlFor="task-due">
            Due date and time (required)
          </label>
          <div>
            <input
              id="task-due"
              required
              type="datetime-local"
              aria-label="Task due date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
            <button disabled={busy}>
              <Plus size={18} />
              {busy ? "Writing nudge…" : "Add task"}
            </button>
          </div>
        </form>
        {notice && (
          <p role="status" className="ai-notice">
            {notice}
          </p>
        )}
        <div className="tasks">
          {tasks.length === 0 ? (
            <div className="task-empty">
              <BedDouble size={26} />
              <p>No responsibilities to neglect. Yet.</p>
              <span>Add a task and give Duvet something to work with.</span>
            </div>
          ) : (
            tasks.map((t) => (
              <div className="task-item" key={t.id}>
                <div>
                  <strong>{t.title}</strong>
                  <span>
                    {new Date(t.due).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}{" "}
                    ·{" "}
                    {t.status === "pending" && +new Date(t.due) < Date.now()
                      ? "Overdue"
                      : t.status}
                  </span>
                </div>
                <select
                  aria-label={`Status for ${t.title}`}
                  value={t.status}
                  onChange={(e) =>
                    void update(
                      tasks.map((x) =>
                        x.id === t.id
                          ? { ...x, status: e.target.value as Task["status"] }
                          : x,
                      ),
                    )
                  }
                >
                  <option value="pending">Pending</option>
                  <option value="done">Done</option>
                  <option value="neglected">Neglected</option>
                  <option value="missed">Missed</option>
                </select>
                <button
                  aria-label={`Delete task ${t.title}`}
                  onClick={() =>
                    void update(tasks.filter((x) => x.id !== t.id))
                  }
                >
                  <X size={15} />
                </button>
              </div>
            ))
          )}
        </div>
      </section>
      <section className="history">
        <h2>The morning report</h2>
        {sessions.length === 0 ? (
          <p>
            No alarm debates yet. Your pillow is preparing its opening
            statement.
          </p>
        ) : (
          sessions.slice(0, 8).map((s) => (
            <div key={s.id}>
              <span>
                {s.label}
                <small>
                  {new Date(s.started).toLocaleDateString()} · {s.layers} sound
                  {s.layers === 1 ? "" : "s"}
                </small>
              </span>
              <strong>
                {s.outcome === "awake"
                  ? "You won"
                  : s.outcome === "bed"
                    ? "Bed won"
                    : "Stopped safely"}
                <small>{clockDuration(s.seconds)} ringing</small>
              </strong>
            </div>
          ))
        )}
      </section>
      <p className="platform-note">
        Locked iPhone: scheduled notification alerts. Fully powered off: alarms
        cannot run. Chat and layered sounds work while the app is open.
      </p>
    </div>
  );
}
function ClockMetric() {
  return <BarChart3 size={19} />;
}
function Chevron() {
  return <ArrowUp size={15} style={{ transform: "rotate(45deg)" }} />;
}

export function ModalShell({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="editor-dialog"
      aria-label="Alarm editor"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {children}
    </dialog>
  );
}

export function ReminderNudges() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    const id = setInterval(() => {
      if (!stored<boolean>("duvet-reminders", false)) return;
      const seen = stored<number[]>("duvet-seen-reminders", []);
      const task = stored<Task[]>("duvet-tasks", []).find(
        (t) =>
          t.status === "pending" &&
          !seen.includes(t.id) &&
          +new Date(t.due) > Date.now() &&
          +new Date(t.due) - Date.now() <= 600000,
      );
      if (task) {
        save("duvet-seen-reminders", [...seen, task.id].slice(-200));
        setMessage(
          task.reminder ||
            "Your to-do list called. I said you were in a blanket meeting. Just kidding. Your call.",
        );
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return message ? (
    <div className="toast" role="status">
      <Moon size={18} />
      <span>{message}</span>
      <button aria-label="Dismiss reminder" onClick={() => setMessage("")}>
        <X size={18} />
      </button>
    </div>
  ) : null;
}

function characterName(name: string) {
  return /\b(fuck\w*|shit\w*|bitch\w*|cunt\w*|porn\w*|suicid\w*|worthless)\b/i.test(
    name,
  )
    ? "friend"
    : name.slice(0, 50);
}
