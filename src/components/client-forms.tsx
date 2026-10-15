"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { archiveHabit, deleteHabit, deleteJournal, deleteTask, reorderHabits, restoreHabit, saveCategory, saveEvening, saveHabit, saveJournal, saveMorning, savePreferences, saveProfile, saveReminder, saveTask, setOccurrenceStatus, setPriorityStatus, setTaskStatus, changePassword, completeOnboarding, archiveCategory } from "@/app/actions";
import { DEFAULT_CATEGORIES, DEFAULT_HABITS, INTENTION_OPTIONS } from "@/lib/domain/defaults";

function Notice({ message }: { message: string | null }) {
  if (!message) return null;
  return <p role="status" className="text-sm text-attention">{message}</p>;
}

export function AuthPanel({ mode, token }: { mode: "login" | "signup" | "forgot" | "reset"; token?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const payload = Object.fromEntries(formData.entries());
    const path = mode === "login" ? "/api/auth/login" : mode === "signup" ? "/api/auth/signup" : mode === "forgot" ? "/api/auth/forgot" : "/api/auth/reset";
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mode === "reset" ? { token, password: payload.password } : payload),
    });
    const body = await response.json() as { ok: boolean; error?: string; devLink?: string; verification?: string };
    setPending(false);
    if (!body.ok) {
      setError(body.error ?? "Please try again.");
      return;
    }
    if (mode === "login") {
      router.push("/home");
      router.refresh();
      return;
    }
    if (mode === "signup") {
      setInfo(body.devLink ? `Verification is not emailed in this environment. Open ${body.devLink}` : "Account created. You can sign in. Verification email is sent only when SMTP or Supabase email is configured.");
      return;
    }
    if (mode === "forgot") {
      setInfo(body.devLink ? `Reset link: ${body.devLink}` : "If an account exists, the next step is ready.");
      return;
    }
    router.push("/login");
  }

  return (
    <form action={onSubmit} className="card space-y-4 p-6">
      {mode !== "reset" && mode !== "login" ? <label className="block text-sm">Display name<input className="field mt-1" name="displayName" required={mode === "signup"} hidden={mode !== "signup"} /></label> : null}
      {mode !== "reset" ? <label className="block text-sm">Email<input className="field mt-1" name="email" type="email" autoComplete="email" required /></label> : null}
      {mode !== "forgot" ? <label className="block text-sm">Password<input className="field mt-1" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required /></label> : null}
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Working…" : mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Save new password"}</button>
      <Notice message={error} />
      <Notice message={info} />
    </form>
  );
}

export function OnboardingForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("Africa/Casablanca");
  const [keys, setKeys] = useState<string[]>(DEFAULT_HABITS.filter((habit) => habit.enabledByDefault).map((habit) => habit.key));

  async function finish() {
    const result = await completeOnboarding({ displayName, timezone, habitKeys: keys });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/home");
    router.refresh();
  }

  return (
    <div className="card space-y-5 p-6">
      {step === 0 ? (
        <>
          <h2 className="text-xl">What should we call you?</h2>
          <label className="block text-sm">Display name<input className="field mt-1" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required /></label>
          <label className="block text-sm">Timezone<input className="field mt-1" value={timezone} onChange={(event) => setTimezone(event.target.value)} /></label>
          <p className="text-sm text-muted">Daily boundaries use this timezone. Africa/Casablanca is the default, including its real offset changes.</p>
        </>
      ) : null}
      {step === 1 ? (
        <>
          <h2 className="text-xl">Choose a calm starting set</h2>
          <p className="text-sm text-muted">These are suggestions, not rules. Uncheck anything you do not want. Nothing is marked complete for you.</p>
          {DEFAULT_CATEGORIES.map((category) => (
            <fieldset key={category.key} className="space-y-2">
              <legend className="font-medium">{category.name}</legend>
              <p className="text-sm text-muted">{category.description}</p>
              {DEFAULT_HABITS.filter((habit) => habit.categoryKey === category.key).map((habit) => (
                <label key={habit.key} className="flex min-h-11 items-start gap-3 text-sm">
                  <input type="checkbox" className="mt-1" checked={keys.includes(habit.key)} onChange={(event) => setKeys((current) => event.target.checked ? [...current, habit.key] : current.filter((key) => key !== habit.key))} />
                  <span>{habit.title}</span>
                </label>
              ))}
            </fieldset>
          ))}
        </>
      ) : null}
      {step === 2 ? (
        <>
          <h2 className="text-xl">Morning and evening</h2>
          <p className="text-sm leading-6 text-muted">Morning planning takes a few quiet minutes: an intention, up to three priorities, and one promise to protect your peace. Evening reflection asks how the day felt. Low numbers are notes, not a verdict, and unfinished items stay on the record.</p>
          <p className="text-sm text-muted">Your consistency target starts at 70% of eligible habits. Skipped and not-applicable items are left out. Days with nothing scheduled are neutral.</p>
        </>
      ) : null}
      <div className="flex gap-2">
        {step > 0 ? <button type="button" className="btn btn-ghost" onClick={() => setStep((value) => value - 1)}>Back</button> : null}
        {step < 2 ? <button type="button" className="btn btn-primary" onClick={() => displayName.trim() ? setStep((value) => value + 1) : setError("Add a display name to continue.")}>Continue</button> : <button type="button" className="btn btn-primary" onClick={finish}>Open my dashboard</button>}
      </div>
      <Notice message={error} />
    </div>
  );
}

export function HabitStatus({ id, status }: { id: string; status: string }) {
  const [current, setCurrent] = useState(status);
  const [error, setError] = useState<string | null>(null);
  async function update(next: string) {
    const previous = current;
    setCurrent(next);
    const result = await setOccurrenceStatus(id, next);
    if (!result.ok) {
      setCurrent(previous);
      setError(result.error);
    } else setError(null);
  }
  const done = current === "completed";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn btn-ghost min-w-11 px-3" aria-pressed={done} onClick={() => update(done ? "pending" : "completed")}>
        <span className="check" data-on={done}>{done ? "✓" : ""}</span>
        {done ? "Done" : "Mark done"}
      </button>
      <button type="button" className="btn btn-ghost" aria-pressed={current === "skipped"} onClick={() => update(current === "skipped" ? "pending" : "skipped")}>Skip</button>
      <button type="button" className="btn btn-ghost" aria-pressed={current === "not_applicable"} onClick={() => update(current === "not_applicable" ? "pending" : "not_applicable")}>Not applicable</button>
      <Notice message={error} />
    </div>
  );
}

export function TaskStatus({ id, status }: { id: string; status: "pending" | "completed" }) {
  const [current, setCurrent] = useState(status);
  const [error, setError] = useState<string | null>(null);
  async function update(next: "pending" | "completed") {
    const previous = current;
    setCurrent(next);
    const result = await setTaskStatus(id, next);
    if (!result.ok) {
      setCurrent(previous);
      setError(result.error);
    }
  }
  return (
    <div>
      <button type="button" className="btn btn-ghost" aria-pressed={current === "completed"} onClick={() => update(current === "completed" ? "pending" : "completed")}>
        <span className="check" data-on={current === "completed"}>{current === "completed" ? "✓" : ""}</span>
        {current === "completed" ? "Completed" : "Complete"}
      </button>
      <Notice message={error} />
    </div>
  );
}

export function PriorityToggle({ id, status, title }: { id: string; status: "pending" | "completed"; title: string }) {
  const [current, setCurrent] = useState(status);
  const [error, setError] = useState<string | null>(null);
  async function update() {
    const next = current === "completed" ? "pending" : "completed";
    const previous = current;
    setCurrent(next);
    const result = await setPriorityStatus(id, next);
    if (!result.ok) {
      setCurrent(previous);
      setError(result.error);
    }
  }
  return (
    <button type="button" onClick={update} className="flex min-h-11 w-full items-center gap-3 text-left" aria-pressed={current === "completed"}>
      <span className="check" data-on={current === "completed"}>{current === "completed" ? "✓" : ""}</span>
      <span className={current === "completed" ? "text-muted line-through" : ""}>{title}</span>
      <Notice message={error} />
    </button>
  );
}

export function MorningWizard({ date, categories, initial }: { date: string; categories: { id: string; name: string }[]; initial: { intention: string; custom: string; commitment: string; priorities: { id?: string; title: string; description: string; categoryId: string; targetTime: string }[] } }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [intention, setIntention] = useState(initial.intention);
  const [custom, setCustom] = useState(initial.custom);
  const [commitment, setCommitment] = useState(initial.commitment);
  const [priorities, setPriorities] = useState(initial.priorities.length ? initial.priorities : [{ title: "", description: "", categoryId: "", targetTime: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    const result = await saveMorning({
      localDate: date,
      intention: intention || null,
      customIntention: custom || null,
      personalCommitment: commitment || null,
      priorities: priorities.filter((item) => item.title.trim()).map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description || null,
        categoryId: item.categoryId || null,
        targetTime: item.targetTime || null,
      })),
    });
    if (!result.ok) setError(result.error);
    else {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <div className="card space-y-4 p-5">
      <p className="text-sm text-muted">Step {step + 1} of 5</p>
      {step === 0 ? (
        <fieldset>
          <legend className="text-lg">How do you want to show up today?</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {INTENTION_OPTIONS.map((option) => (
              <button type="button" key={option} className="btn btn-ghost" aria-pressed={intention === option} onClick={() => setIntention(option)}>{option}</button>
            ))}
          </div>
          <label className="mt-3 block text-sm">Custom intention<input className="field mt-1" value={custom} onChange={(event) => setCustom(event.target.value)} /></label>
        </fieldset>
      ) : null}
      {step === 1 ? (
        <div className="space-y-3">
          <h2 className="text-lg">Three priorities</h2>
          {priorities.map((priority, index) => (
            <div key={priority.id ?? index} className="grid gap-2">
              <input className="field" aria-label={`Priority ${index + 1}`} value={priority.title} onChange={(event) => setPriorities((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} />
              <input className="field" aria-label={`Description ${index + 1}`} placeholder="Optional note" value={priority.description} onChange={(event) => setPriorities((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))} />
              <div className="grid gap-2 sm:grid-cols-2">
                <select className="field" aria-label={`Category ${index + 1}`} value={priority.categoryId} onChange={(event) => setPriorities((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, categoryId: event.target.value } : item))}>
                  <option value="">No category</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
                <input className="field" type="time" aria-label={`Target time ${index + 1}`} value={priority.targetTime} onChange={(event) => setPriorities((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, targetTime: event.target.value } : item))} />
              </div>
            </div>
          ))}
          {priorities.length < 3 ? <button type="button" className="btn btn-ghost" onClick={() => setPriorities((items) => [...items, { title: "", description: "", categoryId: "", targetTime: "" }])}>Add priority</button> : null}
        </div>
      ) : null}
      {step === 2 ? <p className="text-sm leading-6 text-muted">Today&apos;s habits are listed on My Day. You can complete, skip, or mark them not applicable there. Rest and genuine not-applicable days are not treated as missed work.</p> : null}
      {step === 3 ? (
        <label className="block">What is one thing you will do today to protect your peace?
          <textarea className="field mt-2 min-h-28" value={commitment} onChange={(event) => setCommitment(event.target.value)} />
        </label>
      ) : null}
      {step === 4 ? (
        <div className="space-y-2 text-sm">
          <p>Intention: {custom || intention || "Not set"}</p>
          <p>Priorities: {priorities.filter((item) => item.title).map((item) => item.title).join(", ") || "None yet"}</p>
          <p>Commitment: {commitment || "Not set"}</p>
          <button type="button" className="btn btn-primary" onClick={save}>Save morning plan</button>
          {saved ? <p role="status">Saved. You can edit this plan later without creating a second check-in.</p> : null}
          {saved ? <button type="button" className="btn btn-ghost" onClick={() => router.push("/home")}>Return to dashboard</button> : null}
        </div>
      ) : null}
      <div className="flex gap-2">
        {step > 0 ? <button type="button" className="btn btn-ghost" onClick={() => setStep((value) => value - 1)}>Back</button> : null}
        {step < 4 ? <button type="button" className="btn btn-primary" onClick={() => setStep((value) => value + 1)}>Continue</button> : null}
      </div>
      <Notice message={error} />
    </div>
  );
}

export function EveningForm({ date, initial }: { date: string; initial: { peace: number; confidence: number; well: string; drain: string; tomorrow: string; closed: boolean } }) {
  const [peace, setPeace] = useState(initial.peace);
  const [confidence, setConfidence] = useState(initial.confidence);
  const [well, setWell] = useState(initial.well);
  const [drain, setDrain] = useState(initial.drain);
  const [tomorrow, setTomorrow] = useState(initial.tomorrow);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    const result = await saveEvening({ localDate: date, peaceRating: peace, confidenceRating: confidence, whatWentWell: well, energyDrainers: drain, tomorrowAdjustment: tomorrow });
    setMessage(result.ok ? "Reflection saved. You can edit it later. Progress isn't perfection. Tomorrow is another opportunity." : result.error);
  }

  return (
    <form action={save} className="card space-y-4 p-5">
      <label className="block text-sm">How peaceful did today feel? {peace}
        <input className="mt-2 w-full" type="range" min={1} max={10} value={peace} onChange={(event) => setPeace(Number(event.target.value))} />
      </label>
      <label className="block text-sm">How confident did you feel? {confidence}
        <input className="mt-2 w-full" type="range" min={1} max={10} value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} />
      </label>
      <label className="block text-sm">What went well today?<textarea className="field mt-1 min-h-24" value={well} onChange={(event) => setWell(event.target.value)} /></label>
      <label className="block text-sm">What drained your energy?<textarea className="field mt-1 min-h-24" value={drain} onChange={(event) => setDrain(event.target.value)} /></label>
      <label className="block text-sm">What would you like to approach differently tomorrow?<textarea className="field mt-1 min-h-24" value={tomorrow} onChange={(event) => setTomorrow(event.target.value)} /></label>
      <button className="btn btn-primary" type="submit">{initial.closed ? "Update reflection" : "Close My Day"}</button>
      <p className="text-sm text-muted">Closing the day keeps unfinished habits and tasks. A low rating is a note, not a failure.</p>
      <Notice message={message} />
    </form>
  );
}

export function TaskForm({ date, categories }: { date: string; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(formData: FormData) {
    const result = await saveTask({
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      categoryId: (String(formData.get("categoryId") ?? "")) || null,
      priority: String(formData.get("priority") ?? "medium"),
      scheduledDate: String(formData.get("scheduledDate") ?? date),
      targetTime: (String(formData.get("targetTime") ?? "")) || null,
    });
    if (!result.ok) setError(result.error);
    else router.refresh();
  }
  return (
    <form action={onSubmit} className="card grid gap-3 p-4">
      <h2 className="text-lg">Add a goal</h2>
      <input className="field" name="title" aria-label="Task title" required />
      <textarea className="field min-h-20" name="description" aria-label="Description" />
      <div className="grid gap-2 sm:grid-cols-2">
        <select className="field" name="categoryId" aria-label="Category"><option value="">No category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
        <select className="field" name="priority" aria-label="Priority" defaultValue="medium"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
        <input className="field" type="date" name="scheduledDate" aria-label="Scheduled date" defaultValue={date} />
        <input className="field" type="time" name="targetTime" aria-label="Target time" />
      </div>
      <button className="btn btn-primary">Save goal</button>
      <Notice message={error} />
    </form>
  );
}

export function DeleteTaskButton({ id }: { id: string }) {
  const router = useRouter();
  return <button type="button" className="btn btn-danger" onClick={async () => { if (confirm("Delete this task? This cannot be undone.")) { await deleteTask(id); router.refresh(); } }}>Delete</button>;
}

export function HabitEditor({ categories, today, habit }: { categories: { id: string; name: string }[]; today: string; habit?: { id: string; title: string; description: string; categoryId: string; recurrenceType: string; days: number[]; targetCount: number; date: string; startDate: string; endDate: string; archived: boolean } }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(formData: FormData) {
    const days = formData.getAll("days").map(Number);
    const result = await saveHabit({
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      categoryId: (String(formData.get("categoryId") ?? "")) || null,
      recurrenceType: String(formData.get("recurrenceType") ?? "daily"),
      recurrenceConfig: { days, targetCount: Number(formData.get("targetCount") || 3), date: String(formData.get("onceDate") || "") || undefined },
      startDate: String(formData.get("startDate") || today),
      endDate: String(formData.get("endDate") || "") || null,
      targetQuantity: null,
      targetUnit: null,
    }, habit?.id);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }
  return (
    <form action={onSubmit} className="card grid gap-3 p-4">
      <h2 className="text-lg">{habit ? "Edit habit" : "New habit"}</h2>
      <input className="field" name="title" aria-label="Habit title" defaultValue={habit?.title} required />
      <textarea className="field" name="description" aria-label="Description" defaultValue={habit?.description} />
      <select className="field" name="categoryId" aria-label="Category" defaultValue={habit?.categoryId ?? ""}><option value="">No category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
      <select className="field" name="recurrenceType" aria-label="Frequency" defaultValue={habit?.recurrenceType ?? "daily"}>
        <option value="daily">Every day</option>
        <option value="weekdays">Selected weekdays</option>
        <option value="weekly">Weekly frequency target</option>
        <option value="once">One time</option>
      </select>
      <div className="flex flex-wrap gap-2 text-sm">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, index) => <label key={label} className="min-h-11"><input type="checkbox" name="days" value={index + 1} defaultChecked={habit?.days.includes(index + 1)} /> {label}</label>)}</div>
      <label className="text-sm">Weekly target<input className="field" name="targetCount" type="number" min={1} max={7} defaultValue={habit?.targetCount ?? 3} /></label>
      <label className="text-sm">One-time date<input className="field" type="date" name="onceDate" defaultValue={habit?.date} /></label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm">Start<input className="field" type="date" name="startDate" defaultValue={habit?.startDate ?? today} /></label>
        <label className="text-sm">End<input className="field" type="date" name="endDate" defaultValue={habit?.endDate} /></label>
      </div>
      <button className="btn btn-primary">Save habit</button>
      {habit ? <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost" onClick={async () => { habit.archived ? await restoreHabit(habit.id) : await archiveHabit(habit.id); router.refresh(); }}>{habit.archived ? "Restore" : "Archive"}</button>
        <button type="button" className="btn btn-danger" onClick={async () => { if (confirm("Delete this habit and its history?")) { await deleteHabit(habit.id); router.refresh(); } }}>Delete</button>
      </div> : null}
      <Notice message={error} />
    </form>
  );
}

export function ReorderHabits({ ids }: { ids: string[] }) {
  const router = useRouter();
  return <button type="button" className="btn btn-ghost" onClick={async () => { await reorderHabits([...ids].reverse()); router.refresh(); }}>Reverse order</button>;
}

export function JournalEditor({ date, categories, entry }: { date: string; categories: { id: string; name: string }[]; entry?: { id: string; title: string; body: string; localDate: string; categoryId: string; moodTag: string } }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  async function onSubmit(formData: FormData) {
    const result = await saveJournal({
      title: String(formData.get("title") ?? ""),
      body: String(formData.get("body") ?? ""),
      localDate: String(formData.get("localDate") ?? date),
      categoryId: String(formData.get("categoryId") || "") || null,
      moodTag: String(formData.get("moodTag") || "") || null,
    }, entry?.id);
    setMessage(result.ok ? "Saved." : result.error);
    if (result.ok) router.refresh();
  }
  return (
    <form action={onSubmit} className="card space-y-3 p-4">
      <input className="field text-lg" name="title" aria-label="Title" defaultValue={entry?.title} required />
      <textarea className="field min-h-64 text-base leading-7" name="body" aria-label="Journal" defaultValue={entry?.body} required />
      <div className="grid gap-2 sm:grid-cols-3">
        <input className="field" type="date" name="localDate" aria-label="Date" defaultValue={entry?.localDate ?? date} />
        <select className="field" name="categoryId" aria-label="Category" defaultValue={entry?.categoryId ?? ""}><option value="">No category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
        <input className="field" name="moodTag" aria-label="Mood tag" placeholder="Optional mood" defaultValue={entry?.moodTag} />
      </div>
      <div className="flex gap-2">
        <button className="btn btn-primary">Save entry</button>
        {entry ? <button type="button" className="btn btn-danger" onClick={async () => { if (confirm("Delete this private entry?")) { await deleteJournal(entry.id); router.push("/journal"); router.refresh(); } }}>Delete</button> : null}
      </div>
      <Notice message={message} />
    </form>
  );
}

export function SettingsPanels({ profile, reminders, singleUser = false }: { profile: { displayName: string; email: string; timezone: string; preferences: { theme: string; reducedMotion: boolean; streakThreshold: number; startOfWeek: number; motivationalEnabled: boolean; dashboardMission: string; quietHoursStart: string; quietHoursEnd: string } }; reminders: { morning: { enabled: boolean; time: string }; evening: { enabled: boolean; time: string } }; singleUser?: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  return (
    <div className="space-y-6">
      <form className="card space-y-3 p-4" action={async (formData) => {
        const result = await saveProfile({ displayName: String(formData.get("displayName")), timezone: String(formData.get("timezone")) });
        setMessage(result.ok ? "Profile saved." : result.error);
      }}>
        <h2 className="text-xl">Profile</h2>
        <label className="text-sm">Display name<input className="field" name="displayName" defaultValue={profile.displayName} /></label>
        {singleUser ? null : <p className="text-sm text-muted">Email: {profile.email}</p>}
        <label className="text-sm">Timezone<input className="field" name="timezone" defaultValue={profile.timezone} /></label>
        <p className="text-sm text-muted">Changing timezone does not rewrite historical local dates. New days use the new zone.</p>
        <button className="btn btn-primary">Save profile</button>
      </form>
      <form className="card space-y-3 p-4" action={async (formData) => {
        const result = await savePreferences({
          theme: String(formData.get("theme")),
          reducedMotion: formData.get("reducedMotion") === "on",
          streakThreshold: Number(formData.get("streakThreshold")),
          startOfWeek: Number(formData.get("startOfWeek")),
          motivationalEnabled: formData.get("motivationalEnabled") === "on",
          dashboardMission: String(formData.get("dashboardMission")),
          quietHoursStart: String(formData.get("quietHoursStart")),
          quietHoursEnd: String(formData.get("quietHoursEnd")),
        });
        setMessage(result.ok ? "Preferences saved on this account." : result.error);
        if (result.ok) router.refresh();
      }}>
        <h2 className="text-xl">Appearance and goals</h2>
        <label className="text-sm">Theme<select className="field" name="theme" defaultValue={profile.preferences.theme}><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option></select></label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="reducedMotion" defaultChecked={profile.preferences.reducedMotion} /> Reduce motion</label>
        <label className="text-sm">Streak threshold (%)<input className="field" type="number" name="streakThreshold" min={1} max={100} defaultValue={profile.preferences.streakThreshold} /></label>
        <label className="text-sm">Week starts on weekday number (1 Monday, 7 Sunday)<input className="field" type="number" name="startOfWeek" min={1} max={7} defaultValue={profile.preferences.startOfWeek} /></label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="motivationalEnabled" defaultChecked={profile.preferences.motivationalEnabled} /> Show daily motivational message</label>
        <label className="text-sm">Dashboard mission<textarea className="field" name="dashboardMission" defaultValue={profile.preferences.dashboardMission} /></label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm">Quiet hours start<input className="field" type="time" name="quietHoursStart" defaultValue={profile.preferences.quietHoursStart} /></label>
          <label className="text-sm">Quiet hours end<input className="field" type="time" name="quietHoursEnd" defaultValue={profile.preferences.quietHoursEnd} /></label>
        </div>
        <button className="btn btn-primary">Save preferences</button>
      </form>
      <form className="card space-y-3 p-4" action={async (formData) => {
        await saveReminder({ reminderType: "morning_planning", isEnabled: formData.get("morningEnabled") === "on", reminderTime: String(formData.get("morningTime")) });
        const result = await saveReminder({ reminderType: "evening_reflection", isEnabled: formData.get("eveningEnabled") === "on", reminderTime: String(formData.get("eveningTime")) });
        setMessage(result.ok ? "In-app reminders saved. Push notifications are not enabled in this version." : result.error);
      }}>
        <h2 className="text-xl">Reminders</h2>
        <p className="text-sm text-muted">Reminders appear inside the app. Browser push is not configured, so these toggles do not send background notifications.</p>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="morningEnabled" defaultChecked={reminders.morning.enabled} /> Morning planning</label>
        <input className="field" type="time" name="morningTime" defaultValue={reminders.morning.time} aria-label="Morning time" />
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="eveningEnabled" defaultChecked={reminders.evening.enabled} /> Evening reflection</label>
        <input className="field" type="time" name="eveningTime" defaultValue={reminders.evening.time} aria-label="Evening time" />
        <button className="btn btn-primary">Save reminders</button>
      </form>
      {singleUser ? null : <form className="card space-y-3 p-4" action={async (formData) => {
        const result = await changePassword(String(formData.get("current") ?? ""), String(formData.get("next") ?? ""));
        setMessage(result.ok ? "Password updated." : result.error);
      }}>
        <h2 className="text-xl">Password</h2>
        <input className="field" type="password" name="current" aria-label="Current password" />
        <input className="field" type="password" name="next" aria-label="New password" minLength={8} />
        <button className="btn btn-primary">Change password</button>
      </form>}
      <section className="card space-y-3 p-4">
        <h2 className="text-xl">Privacy</h2>
        <a className="btn btn-ghost" href="/api/export">Export my data</a>
        {singleUser ? null : <form className="space-y-2" action={async (formData) => {
          const response = await fetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: formData.get("password"), confirmation: formData.get("confirmation") }) });
          const body = await response.json() as { ok: boolean; error?: string };
          if (!body.ok) setDeleteError(body.error ?? "Deletion failed.");
          else router.push("/login");
        }}>
          <p className="text-sm text-muted">Deletion removes your account and private records. Type DELETE and your password to confirm.</p>
          <input className="field" type="password" name="password" aria-label="Password confirmation" />
          <input className="field" name="confirmation" aria-label="Type DELETE" />
          <button className="btn btn-danger">Delete account</button>
          <Notice message={deleteError} />
        </form>}
      </section>
      <CategoryManager />
      <Notice message={message} />
    </div>
  );
}

function CategoryManager() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="card space-y-3 p-4" action={async (formData) => {
      const result = await saveCategory({ name: String(formData.get("name")), description: String(formData.get("description") || ""), icon: "leaf", color: "#8FBFA8" });
      if (!result.ok) setError(result.error);
      else router.refresh();
    }}>
      <h2 className="text-xl">New category</h2>
      <input className="field" name="name" aria-label="Category name" required />
      <textarea className="field" name="description" aria-label="Category description" />
      <button className="btn btn-primary">Add category</button>
      <Notice message={error} />
    </form>
  );
}

export function ArchiveCategoryButton({ id, archived }: { id: string; archived: boolean }) {
  const router = useRouter();
  return <button type="button" className="btn btn-ghost" onClick={async () => { await archiveCategory(id, !archived); router.refresh(); }}>{archived ? "Restore" : "Archive"}</button>;
}
