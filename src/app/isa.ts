// The UK ISA allowance tracker: how much has been paid into ISAs this tax year, what's left, the
// Lifetime ISA bonus, and the days until 5 April. Contributions live in public.isa_contributions.

import { supabase } from "./account";

export type IsaType = "ss" | "cash" | "lisa" | "ifisa";

export const ISA_LABELS: Record<IsaType, string> = {
  ss: "Stocks and Shares ISA",
  cash: "Cash ISA",
  lisa: "Lifetime ISA",
  ifisa: "Innovative Finance ISA",
};

// Limits by tax year, checked against GOV.UK. Update them when the rules change.
interface Limits {
  overall: number;
  cashUnder65: number; // the most a person under 65 can put into cash ISAs
  lisa: number;
  lisaBonus: number;
}
const LIMITS: Record<string, Limits> = {
  "2026-27": { overall: 20000, cashUnder65: 20000, lisa: 4000, lisaBonus: 0.25 },
  // From 6 April 2027 under-65s can pay at most £12,000 a year into cash ISAs (still within £20,000).
  "2027-28": { overall: 20000, cashUnder65: 12000, lisa: 4000, lisaBonus: 0.25 },
};
export const LIMITS_CHECKED = "16 October 2026";

export interface Contribution {
  id: string;
  taxYear: string; // "2026-27"
  type: IsaType;
  amount: number; // negative for a withdrawal from a flexible ISA
  paidOn: string; // "YYYY-MM-DD"
  provider: string | null;
  source: "manual" | "csv";
}

// ---- Tax years: 6 April to 5 April ----

/** The tax year a date falls in, as "2026-27". */
export function taxYearOf(day: string | Date): string {
  const d = typeof day === "string" ? new Date(`${day.slice(0, 10)}T12:00:00Z`) : day;
  const y = d.getUTCFullYear();
  const start = d.getUTCMonth() > 3 || (d.getUTCMonth() === 3 && d.getUTCDate() >= 6) ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export const taxYearLabel = (key: string) => key.replace("-", "/");

/** The last day of a tax year (5 April), at the end of that day UK-ish time. */
export const taxYearEnd = (key: string) => new Date(`${Number(key.slice(0, 4)) + 1}-04-05T23:59:59Z`);

export const limitsFor = (key: string): Limits & { confirmed: boolean } =>
  LIMITS[key] ? { ...LIMITS[key], confirmed: true } : { ...LIMITS["2027-28"], confirmed: false };

// ---- The summary shown in the tracker and sent with questions ----

export interface IsaSummary {
  taxYear: string;
  byType: Record<IsaType, number>;
  total: number;
  left: number;
  overBy: number;
  lisaBonus: number;
  lisaOverBy: number;
  cashOverBy: number; // only meaningful for people under 65
  daysLeft: number;
  limits: Limits & { confirmed: boolean };
}

export function summarise(contributions: Contribution[], taxYear: string, today = new Date()): IsaSummary {
  const limits = limitsFor(taxYear);
  const byType: Record<IsaType, number> = { ss: 0, cash: 0, lisa: 0, ifisa: 0 };
  for (const c of contributions) if (c.taxYear === taxYear) byType[c.type] += c.amount;
  for (const t of Object.keys(byType) as IsaType[]) byType[t] = Math.max(0, byType[t]); // withdrawals can't go below zero
  const total = byType.ss + byType.cash + byType.lisa + byType.ifisa;
  const end = taxYearEnd(taxYear);
  return {
    taxYear,
    byType,
    total,
    left: Math.max(0, limits.overall - total),
    overBy: Math.max(0, total - limits.overall),
    lisaBonus: Math.min(byType.lisa, limits.lisa) * limits.lisaBonus,
    lisaOverBy: Math.max(0, byType.lisa - limits.lisa),
    cashOverBy: Math.max(0, byType.cash - limits.cashUnder65),
    daysLeft: Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86_400_000)),
    limits,
  };
}

/** Monthly payments still to come this tax year, if paid on the 1st of each month. */
export function paymentsLeft(taxYear: string, today = new Date()): number {
  const end = taxYearEnd(taxYear);
  let count = 0;
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
  while (d <= end) {
    count++;
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return count;
}

export const pounds = (v: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: v % 1 ? 2 : 0 }).format(v);

/** The ISA line for <about_me>, or "" when nothing has been recorded. */
export function isaForModel(s: IsaSummary): string {
  if (!s.total) return "";
  const parts = (Object.keys(s.byType) as IsaType[]).filter((t) => s.byType[t]).map((t) => `${ISA_LABELS[t]} ${pounds(s.byType[t])}`);
  return (
    `ISA payments this tax year (${taxYearLabel(s.taxYear)}, until 5 April): ${pounds(s.total)} (${parts.join(", ")}); ` +
    `${pounds(s.left)} of the ${pounds(s.limits.overall)} allowance left; ${s.daysLeft} days to go.` +
    (s.byType.lisa ? ` Lifetime ISA bonus due: ${pounds(s.lisaBonus)}.` : "") +
    (s.overBy ? ` Over the allowance by ${pounds(s.overBy)}.` : "")
  );
}

// ---- Storage ----

interface Row {
  id: string;
  tax_year: string;
  isa_type: IsaType;
  amount: number;
  paid_on: string;
  provider: string | null;
  source: "manual" | "csv";
}

export async function fetchContributions(): Promise<Contribution[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("isa_contributions")
    .select("id, tax_year, isa_type, amount, paid_on, provider, source")
    .order("paid_on", { ascending: false });
  if (error) throw error;
  return (data as Row[]).map((r) => ({
    id: r.id,
    taxYear: r.tax_year,
    type: r.isa_type,
    amount: Number(r.amount),
    paidOn: r.paid_on,
    provider: r.provider,
    source: r.source,
  }));
}

export async function saveContributions(userId: string, list: Contribution[]) {
  if (!supabase || !list.length) return;
  const { error } = await supabase.from("isa_contributions").upsert(
    list.map((c) => ({
      user_id: userId,
      id: c.id,
      tax_year: c.taxYear,
      isa_type: c.type,
      amount: c.amount,
      paid_on: c.paidOn,
      provider: c.provider,
      source: c.source,
    })),
    { onConflict: "user_id,id" }
  );
  if (error) throw error;
}

export async function deleteContributions(ids: string[]) {
  if (!supabase || !ids.length) return;
  const { error } = await supabase.from("isa_contributions").delete().in("id", ids);
  if (error) throw error;
}

// ---- Trading 212 ----

/** Deposits (and withdrawals, as negatives) from a Trading 212 history export of an ISA. Its ISA
 *  is flexible, so money taken out can be paid back in the same tax year without using allowance. */
export function contributionsFromTrading212(rows: string[][], type: IsaType): Contribution[] {
  const h = rows[0];
  const [action, time, total, currency, id] = ["Action", "Time", "Total", "Currency (Total)", "ID"].map((n) => h.indexOf(n));
  const out: Contribution[] = [];
  for (const r of rows.slice(1)) {
    const kind = (r[action] ?? "").toLowerCase();
    const sign = kind === "deposit" ? 1 : kind === "withdrawal" ? -1 : 0;
    const amount = Number((r[total] ?? "").replace(/[£,\s-]/g, ""));
    const day = (r[time] ?? "").slice(0, 10);
    if (!sign || !amount || !/^\d{4}-\d{2}-\d{2}$/.test(day) || (currency >= 0 && r[currency] && r[currency] !== "GBP")) continue;
    out.push({
      id: `csv:t212:${r[id] || `${day}:${kind}:${amount}`}`,
      taxYear: taxYearOf(day),
      type,
      amount: sign * amount,
      paidOn: day,
      provider: "Trading 212",
      source: "csv",
    });
  }
  return out;
}
