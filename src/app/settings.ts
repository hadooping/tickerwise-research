// Personal settings: appearance, answer style, investment profile, instructions, and memory.
// Kept in this browser for everyone, and in the account (user_settings) when signed in.

import { supabase } from "./account";

export interface MemoryItem {
  id: string;
  text: string;
  savedAt: number;
}

export interface Settings {
  appearance: {
    theme: "system" | "light" | "dark";
    font: "sans" | "serif" | "readable";
    size: "small" | "medium" | "large" | "xl";
    width: "narrow" | "standard" | "wide";
  };
  answers: {
    length: "short" | "standard" | "detailed";
    language: string; // answers are written in this language
  };
  profile: {
    country: "" | "uk" | "us" | "in" | "other";
    age: "" | "18-29" | "30-39" | "40-54" | "55+";
    currency: "" | "GBP" | "USD" | "INR" | "EUR";
    experience: "" | "new" | "some" | "experienced";
    horizon: "" | "short" | "medium" | "long" | "very-long";
    risk: "" | "low" | "medium" | "high";
    goals: string;
    accounts: string;
    avoid: string;
  };
  instructions: string;
  memory: {
    enabled: boolean;
    items: MemoryItem[];
  };
  onboarded: boolean; // finished or skipped the first-visit setup
  portfolioInAnswers: boolean; // send the person's holdings with their questions
  isaMonthly: number; // planned monthly ISA payment, for the allowance projection
  notify: { deadlines: boolean; results: boolean; digest: boolean }; // which notifications to create
  updatedAt: number;
}

export const DEFAULT_SETTINGS: Settings = {
  appearance: { theme: "system", font: "sans", size: "medium", width: "standard" },
  answers: { length: "standard", language: "English" },
  profile: { country: "", age: "", currency: "", experience: "", horizon: "", risk: "", goals: "", accounts: "", avoid: "" },
  instructions: "",
  memory: { enabled: true, items: [] },
  onboarded: false,
  portfolioInAnswers: true,
  isaMonthly: 0,
  notify: { deadlines: true, results: true, digest: true },
  updatedAt: 0,
};

export const LANGUAGES = [
  "English", "Hindi", "Tamil", "Telugu", "Bengali", "Marathi", "Gujarati", "Kannada", "Malayalam", "Punjabi",
  "Urdu", "Spanish", "French", "German", "Italian", "Portuguese", "Arabic", "Chinese (Simplified)", "Japanese",
  "Korean", "Polish",
];

export const MAX_MEMORIES = 50;
const STORAGE_KEY = "tickerwise.settings";

// Fills in anything missing (older saved settings, new fields) from the defaults.
export function withDefaults(saved: Partial<Settings> | null | undefined): Settings {
  const s = saved ?? {};
  return {
    appearance: { ...DEFAULT_SETTINGS.appearance, ...s.appearance },
    answers: { ...DEFAULT_SETTINGS.answers, ...s.answers },
    profile: { ...DEFAULT_SETTINGS.profile, ...s.profile },
    instructions: s.instructions ?? "",
    memory: { ...DEFAULT_SETTINGS.memory, ...s.memory, items: s.memory?.items ?? [] },
    onboarded: s.onboarded ?? false,
    portfolioInAnswers: s.portfolioInAnswers ?? true,
    isaMonthly: s.isaMonthly ?? 0,
    notify: { ...DEFAULT_SETTINGS.notify, ...s.notify },
    updatedAt: s.updatedAt ?? 0,
  };
}

export function loadLocalSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return withDefaults(raw ? JSON.parse(raw) : null);
  } catch {
    return withDefaults(null);
  }
}

export function saveLocalSettings(settings: Settings | null) {
  try {
    if (settings) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Not saved; the current session still works.
  }
}

// Appearance is applied as attributes on <html>; globals.css reads them. The same logic runs
// before the page paints (THEME_SCRIPT in layout.tsx) to avoid a flash of the wrong theme.
export function applyAppearance(a: Settings["appearance"]) {
  const root = document.documentElement;
  root.dataset.theme = a.theme;
  root.dataset.font = a.font;
  root.dataset.size = a.size;
  root.dataset.width = a.width;
}

// ---- Account sync (public.user_settings, one row per person, row-level security) ----

export async function fetchAccountSettings(): Promise<Settings | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("user_settings").select("settings").maybeSingle();
  if (error) throw error;
  return data ? withDefaults(data.settings as Partial<Settings>) : null;
}

export async function saveAccountSettings(userId: string, settings: Settings) {
  if (!supabase) return;
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: userId, settings, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}

// ---- What the model is told about the person ----

const LABELS = {
  country: { uk: "the UK", us: "the US", in: "India", other: "another country" },
  experience: {
    new: "new to investing: explain ideas in everyday words with real numbers, and leave out formulas and technical names unless they ask",
    some: "has some investing experience: use a technical term only with a plain explanation",
    experienced: "an experienced investor: technical terms are fine, keep explanations brief",
  },
  horizon: {
    short: "under 2 years",
    medium: "2 to 5 years",
    long: "5 to 10 years",
    "very-long": "more than 10 years",
  },
  risk: {
    low: "prefers steadier investments and would find big falls hard",
    medium: "can accept some ups and downs",
    high: "comfortable with large swings for higher potential growth",
  },
  length: {
    short: "Keep answers short: the direct answer and the few most important points.",
    standard: "",
    detailed: "Give detailed answers with more background and figures.",
  },
} as const;

/** The <about_me> text sent with each question, or "" when there is nothing to say. */
export function aboutMe(s: Settings): string {
  const p = s.profile;
  const lines: string[] = [];
  if (p.country) lines.push(`Lives in ${LABELS.country[p.country]}.`);
  if (p.age) lines.push(`Age: ${p.age}.`);
  if (p.currency) lines.push(`Thinks in ${p.currency}.`);
  if (p.experience) lines.push(`Experience: ${LABELS.experience[p.experience]}.`);
  if (p.horizon) lines.push(`Investing time horizon: ${LABELS.horizon[p.horizon]}.`);
  if (p.risk) lines.push(`Risk: ${LABELS.risk[p.risk]}.`);
  if (p.goals.trim()) lines.push(`Goals: ${p.goals.trim()}`);
  if (p.accounts.trim()) lines.push(`Accounts they use: ${p.accounts.trim()}`);
  if (p.avoid.trim()) lines.push(`Wants to avoid: ${p.avoid.trim()}`);

  const style: string[] = [LABELS.length[s.answers.length]];
  if (s.answers.language && s.answers.language !== "English") style.push(`Write the answer in ${s.answers.language}.`);

  const parts: string[] = [];
  if (lines.length) parts.push(`Profile:\n${lines.map((l) => `- ${l}`).join("\n")}`);
  if (style.some(Boolean)) parts.push(`Answer style:\n${style.filter(Boolean).map((l) => `- ${l}`).join("\n")}`);
  if (s.instructions.trim()) parts.push(`Their instructions:\n${s.instructions.trim()}`);
  if (s.memory.enabled && s.memory.items.length) {
    parts.push(`Things they've told you before (memory):\n${s.memory.items.map((m) => `- ${m.text}`).join("\n")}`);
  }
  return parts.join("\n\n");
}

// ---- Export ----

interface ExportTurn {
  question: string;
  answer: string;
  sources: { url: string; title: string }[];
}
interface ExportThread {
  title: string;
  updatedAt: number;
  pinned?: boolean;
  turns: ExportTurn[];
}

function download(name: string, type: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export function exportJson(threads: ExportThread[], settings: Settings, email: string | null, holdings: unknown[] = []) {
  const data = { exportedAt: new Date().toISOString(), account: email, settings, holdings, threads };
  download(`tickerwise-export-${stamp()}.json`, "application/json", JSON.stringify(data, null, 2));
}

export function exportMarkdown(threads: ExportThread[], answerText: (answer: string) => string) {
  const parts = [`# Tickerwise chats\n\nExported ${new Date().toLocaleString()}.`];
  for (const th of threads) {
    parts.push(`\n---\n\n## ${th.title}\n\n_${new Date(th.updatedAt).toLocaleString()}_`);
    for (const t of th.turns) {
      parts.push(`\n### ${t.question}\n\n${answerText(t.answer)}`);
      if (t.sources.length) parts.push(`\nSources:\n${t.sources.map((s, i) => `${i + 1}. [${s.title}](${s.url})`).join("\n")}`);
    }
  }
  download(`tickerwise-chats-${stamp()}.md`, "text/markdown", parts.join("\n"));
}
