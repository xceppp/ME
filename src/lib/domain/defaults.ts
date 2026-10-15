export type DefaultHabit = {
  key: string;
  categoryKey: string;
  title: string;
  description?: string;
  enabledByDefault: boolean;
  recurrenceType: "daily";
};

export type DefaultCategory = {
  key: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
};

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  {
    key: "workplace",
    name: "Workplace Boundaries",
    description:
      "Remain professional, protect personal energy, and develop healthy workplace relationships. Healthy boundaries do not mean ignoring colleagues, suppressing natural laughter, or refusing reasonable professional cooperation.",
    icon: "shield",
    color: "#8FBFA8",
    sortOrder: 1,
  },
  {
    key: "confidence",
    name: "Confidence and Charisma",
    description: "Build natural confidence without depending on external validation.",
    icon: "sparkles",
    color: "#A8C3D4",
    sortOrder: 2,
  },
  {
    key: "fitness",
    name: "Fitness",
    description: "Maintain a consistent fitness lifestyle. Rest and recovery count as successful care.",
    icon: "dumbbell",
    color: "#C4B48A",
    sortOrder: 3,
  },
  {
    key: "discipline",
    name: "Discipline and Productivity",
    description: "Improve focus, execution, and consistency without turning the day into a guilt ledger.",
    icon: "target",
    color: "#B7C4A8",
    sortOrder: 4,
  },
  {
    key: "peace",
    name: "Mental Peace",
    description:
      "Encourage calm and emotional self-awareness. Difficult emotions are information, not failure. Ratings here are personal notes, not a clinical assessment.",
    icon: "leaf",
    color: "#C3B4C9",
    sortOrder: 5,
  },
];

export const DEFAULT_HABITS: DefaultHabit[] = [
  { key: "wb-greet", categoryKey: "workplace", title: "Greet colleagues respectfully.", enabledByDefault: true, recurrenceType: "daily", description: "Be polite without forcing conversations." },
  { key: "wb-focus", categoryKey: "workplace", title: "Focus on my work without seeking attention.", enabledByDefault: true, recurrenceType: "daily" },
  { key: "wb-stress", categoryKey: "workplace", title: "Leave workplace stress behind.", enabledByDefault: true, recurrenceType: "daily", description: "Do not carry avoidable workplace stress into personal time." },
  { key: "wb-gossip", categoryKey: "workplace", title: "Avoid unnecessary gossip.", enabledByDefault: false, recurrenceType: "daily", description: "Stay out of gossip and unnecessary workplace conflict." },
  { key: "wb-calm", categoryKey: "workplace", title: "Maintain calm communication.", enabledByDefault: false, recurrenceType: "daily", description: "Communicate calmly and professionally." },
  { key: "wb-boundary", categoryKey: "workplace", title: "Set a healthy boundary where needed.", enabledByDefault: false, recurrenceType: "daily", description: "Set boundaries respectfully." },
  { key: "wb-natural", categoryKey: "workplace", title: "Allow myself to enjoy natural conversations.", enabledByDefault: false, recurrenceType: "daily", description: "Isolation is not the goal." },
  { key: "wb-focus-time", categoryKey: "workplace", title: "Protect focused working time.", enabledByDefault: false, recurrenceType: "daily" },
  { key: "cf-speak", categoryKey: "confidence", title: "Speak clearly.", enabledByDefault: true, recurrenceType: "daily", description: "Speak clearly and calmly." },
  { key: "cf-posture", categoryKey: "confidence", title: "Maintain comfortable posture.", enabledByDefault: true, recurrenceType: "daily" },
  { key: "cf-explain", categoryKey: "confidence", title: "Avoid excessive self-explanation.", enabledByDefault: true, recurrenceType: "daily", description: "Avoid unnecessary overexplaining." },
  { key: "cf-opinion", categoryKey: "confidence", title: "Express opinions respectfully.", enabledByDefault: false, recurrenceType: "daily" },
  { key: "cf-silence", categoryKey: "confidence", title: "Remain comfortable with natural silence.", enabledByDefault: false, recurrenceType: "daily" },
  { key: "cf-approval", categoryKey: "confidence", title: "Avoid compulsive approval-seeking.", enabledByDefault: false, recurrenceType: "daily" },
  { key: "cf-respect", categoryKey: "confidence", title: "Practice self-respect without arrogance.", enabledByDefault: false, recurrenceType: "daily" },
  { key: "ft-plan", categoryKey: "fitness", title: "Follow the planned workout or recovery routine.", enabledByDefault: true, recurrenceType: "daily", description: "Rest days count when recovery is the plan." },
  { key: "ft-move", categoryKey: "fitness", title: "Maintain healthy movement.", enabledByDefault: true, recurrenceType: "daily", description: "Movement appropriate to the day is enough." },
  { key: "ft-recovery", categoryKey: "fitness", title: "Prioritize recovery.", enabledByDefault: true, recurrenceType: "daily", description: "Protect sleep and recovery." },
  { key: "ft-meals", categoryKey: "fitness", title: "Eat balanced meals.", enabledByDefault: false, recurrenceType: "daily" },
  { key: "ft-water", categoryKey: "fitness", title: "Stay hydrated.", enabledByDefault: false, recurrenceType: "daily" },
  { key: "ds-priorities", categoryKey: "discipline", title: "Set three priorities.", enabledByDefault: true, recurrenceType: "daily" },
  { key: "ds-important", categoryKey: "discipline", title: "Finish the most important task.", enabledByDefault: true, recurrenceType: "daily" },
  { key: "ds-distract", categoryKey: "discipline", title: "Limit unnecessary distractions.", enabledByDefault: true, recurrenceType: "daily" },
  { key: "ds-progress", categoryKey: "discipline", title: "Make progress on a meaningful personal objective.", enabledByDefault: false, recurrenceType: "daily" },
  { key: "ds-review", categoryKey: "discipline", title: "Review incomplete tasks without unnecessary guilt.", enabledByDefault: false, recurrenceType: "daily" },
  { key: "mp-intention", categoryKey: "peace", title: "Set a morning intention.", enabledByDefault: true, recurrenceType: "daily" },
  { key: "mp-pause", categoryKey: "peace", title: "Pause when feeling overwhelmed.", enabledByDefault: true, recurrenceType: "daily", description: "Take a short intentional pause when useful." },
  { key: "mp-reflect", categoryKey: "peace", title: "Complete an evening reflection.", enabledByDefault: true, recurrenceType: "daily" },
  { key: "mp-rumination", categoryKey: "peace", title: "Avoid unnecessary rumination.", enabledByDefault: false, recurrenceType: "daily" },
  { key: "mp-rest", categoryKey: "peace", title: "Make space for rest.", enabledByDefault: false, recurrenceType: "daily" },
  { key: "mp-boundaries", categoryKey: "peace", title: "Practice healthy emotional boundaries.", enabledByDefault: false, recurrenceType: "daily" },
];

export const INTENTION_OPTIONS = ["Calm", "Confident", "Focused", "Respectful", "Disciplined", "Balanced"] as const;

export const MOTIVATIONAL_MESSAGES = [
  "Your peace doesn't require anyone else's approval.",
  "Consistency is quieter than perfection, and more useful.",
  "A boundary can be kind and still be firm.",
  "Rest is part of the work.",
  "You can improve without being perfect.",
  "Protect the energy you will need later.",
];

export const DEFAULT_MISSION = "Today, your mission is to protect your peace and make meaningful progress.";

export function messageForDate(dateISO: string): string {
  let hash = 0;
  for (const char of dateISO) hash = (hash + char.charCodeAt(0)) % MOTIVATIONAL_MESSAGES.length;
  return MOTIVATIONAL_MESSAGES[hash] ?? "Your peace doesn't require anyone else's approval.";
}

export type Preferences = {
  theme: "dark" | "light" | "system";
  reducedMotion: boolean;
  streakThreshold: number;
  startOfWeek: number;
  motivationalEnabled: boolean;
  dashboardMission: string;
  onboardingComplete: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  emailDelivery: "configured" | "unconfigured";
};

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "dark",
  reducedMotion: false,
  streakThreshold: 70,
  startOfWeek: 1,
  motivationalEnabled: true,
  dashboardMission: DEFAULT_MISSION,
  onboardingComplete: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  emailDelivery: "unconfigured",
};

export function mergePreferences(value: unknown): Preferences {
  const raw = value && typeof value === "object" ? (value as Partial<Preferences>) : {};
  const threshold = Number(raw.streakThreshold ?? 70);
  const start = Number(raw.startOfWeek ?? 1);
  return {
    ...DEFAULT_PREFERENCES,
    ...raw,
    theme: raw.theme === "light" || raw.theme === "system" ? raw.theme : "dark",
    reducedMotion: Boolean(raw.reducedMotion),
    streakThreshold: Number.isFinite(threshold) ? Math.min(100, Math.max(1, Math.round(threshold))) : 70,
    startOfWeek: start >= 1 && start <= 7 ? Math.round(start) : 1,
    motivationalEnabled: raw.motivationalEnabled !== false,
    dashboardMission: typeof raw.dashboardMission === "string" && raw.dashboardMission.trim()
      ? raw.dashboardMission.trim().slice(0, 240)
      : DEFAULT_MISSION,
    onboardingComplete: Boolean(raw.onboardingComplete),
    quietHoursStart: typeof raw.quietHoursStart === "string" ? raw.quietHoursStart : "22:00",
    quietHoursEnd: typeof raw.quietHoursEnd === "string" ? raw.quietHoursEnd : "07:00",
    emailDelivery: raw.emailDelivery === "configured" ? "configured" : "unconfigured",
  };
}
