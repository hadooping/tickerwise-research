// The person's holdings: stored in their account (public.holdings, row-level security), added by
// hand or imported from a platform CSV or an India CAS statement.

import { supabase } from "./account";

export type AccountType =
  | "isa"
  | "lisa"
  | "sipp"
  | "pension"
  | "gia"
  | "mf"
  | "demat"
  | "401k"
  | "ira"
  | "brokerage"
  | "other";

export const ACCOUNT_LABELS: Record<AccountType, string> = {
  isa: "Stocks and Shares ISA",
  lisa: "Lifetime ISA",
  sipp: "SIPP",
  pension: "Workplace pension",
  gia: "General account",
  mf: "Mutual funds",
  demat: "Demat account",
  "401k": "401(k)",
  ira: "IRA",
  brokerage: "Brokerage account",
  other: "Other",
};

export const ACCOUNTS_BY_COUNTRY: Record<string, AccountType[]> = {
  uk: ["isa", "lisa", "sipp", "pension", "gia", "other"],
  in: ["mf", "demat", "other"],
  us: ["401k", "ira", "brokerage", "other"],
  other: ["gia", "other"],
};

export interface Holding {
  id: string;
  name: string;
  symbol: string | null; // Yahoo Finance symbol; null when it couldn't be matched
  isin: string | null;
  quantity: number;
  avgCost: number | null; // per unit, in currency
  currency: string | null;
  account: AccountType;
  plan: "direct" | "regular" | null; // Indian mutual funds
  source: "manual" | "csv" | "cas";
}

// ---- Storage ----

interface Row {
  id: string;
  name: string;
  symbol: string | null;
  isin: string | null;
  quantity: number;
  avg_cost: number | null;
  currency: string | null;
  account: string;
  plan: "direct" | "regular" | null;
  source: "manual" | "csv" | "cas";
}

const fromRow = (r: Row): Holding => ({
  id: r.id,
  name: r.name,
  symbol: r.symbol,
  isin: r.isin,
  quantity: Number(r.quantity),
  avgCost: r.avg_cost === null ? null : Number(r.avg_cost),
  currency: r.currency,
  account: (r.account in ACCOUNT_LABELS ? r.account : "other") as AccountType,
  plan: r.plan,
  source: r.source,
});

export async function fetchHoldings(): Promise<Holding[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("holdings")
    .select("id, name, symbol, isin, quantity, avg_cost, currency, account, plan, source")
    .order("name");
  if (error) throw error;
  return (data as Row[]).map(fromRow);
}

export async function saveHoldings(userId: string, holdings: Holding[]) {
  if (!supabase || !holdings.length) return;
  const rows = holdings.map((h) => ({
    user_id: userId,
    id: h.id,
    name: h.name,
    symbol: h.symbol,
    isin: h.isin,
    quantity: h.quantity,
    avg_cost: h.avgCost,
    currency: h.currency,
    account: h.account,
    plan: h.plan,
    source: h.source,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from("holdings").upsert(rows, { onConflict: "user_id,id" });
  if (error) throw error;
}

export async function deleteHoldings(ids: string[] | "all") {
  if (!supabase) return;
  const query = supabase.from("holdings").delete();
  const { error } = ids === "all" ? await query.neq("id", "") : await query.in("id", ids);
  if (error) throw error;
}

// Imports update a holding they've seen before (same account and fund) instead of adding a copy.
export const importId = (source: string, account: string, key: string) =>
  `${source}:${account}:${key.toLowerCase().replace(/\s+/g, " ").slice(0, 120)}`;

// ---- CSV ----

/** Rows of a CSV file (comma, semicolon, or tab separated; quoted fields may contain newlines). */
export function parseCsv(text: string): string[][] {
  text = text.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0];
  const delimiter = [",", ";", "\t"].reduce((best, d) =>
    firstLine.split(d).length > firstLine.split(best).length ? d : best
  );
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(field.trim());
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export type Field = "name" | "ticker" | "isin" | "quantity" | "unitCost" | "totalCost" | "currency" | "account";
export type Mapping = Record<Field, number>; // column index, or -1 for none

export const FIELD_LABELS: Record<Field, string> = {
  name: "Name",
  ticker: "Ticker or code",
  isin: "ISIN",
  quantity: "Quantity (shares or units)",
  unitCost: "Average cost per share",
  totalCost: "Total cost (book cost)",
  currency: "Currency",
  account: "Account (ISA, SIPP...)",
};

const GUESSES: Record<Field, RegExp> = {
  name: /^(name|instrument|security|description|stock|holding|investment|fund( name)?|asset|investment name)$|name/i,
  ticker: /ticker|symbol|^code$|epic|tidm/i,
  isin: /isin/i,
  quantity: /quantity|units|shares|^holding$|qty|balance/i,
  unitCost: /avg|average|cost per|price paid|purchase price|book cost per/i,
  totalCost: /book cost|total cost|^cost$|amount invested|invested|cost \(/i,
  currency: /currency|ccy/i,
  account: /account|wrapper|product/i,
};

/** A first guess at which column holds what, from the header names. */
export function guessMapping(headers: string[]): Mapping {
  const used = new Set<number>();
  const pick = (field: Field) => {
    const i = headers.findIndex((h, idx) => !used.has(idx) && GUESSES[field].test(h));
    if (i >= 0) used.add(i);
    return i;
  };
  // Specific fields first, so "ISIN" isn't taken as a name and "Book cost per unit" isn't a total.
  const isin = pick("isin");
  const ticker = pick("ticker");
  const unitCost = pick("unitCost");
  const quantity = pick("quantity");
  const totalCost = pick("totalCost");
  const currency = pick("currency");
  const account = pick("account");
  const name = pick("name");
  return { name, ticker, isin, quantity, unitCost, totalCost, currency, account };
}

const number = (s: string | undefined) => {
  if (!s) return null;
  const n = Number(s.replace(/[£$€₹,\s]/g, "").replace(/^\((.*)\)$/, "-$1"));
  return Number.isFinite(n) ? n : null;
};

function accountFrom(text: string | undefined, fallback: AccountType): AccountType {
  const t = (text ?? "").toLowerCase();
  if (/lifetime|lisa/.test(t)) return "lisa";
  if (/\bisa\b/.test(t)) return "isa";
  if (/sipp/.test(t)) return "sipp";
  if (/pension/.test(t)) return "pension";
  if (/gia|general|trading|invest/.test(t)) return "gia";
  return fallback;
}

export interface Draft {
  name: string;
  ticker: string;
  isin: string;
  quantity: number;
  avgCost: number | null;
  currency: string;
  account: AccountType;
}

/** Holdings from a holdings CSV using the chosen columns. Pence are converted to pounds. */
export function holdingsFromCsv(rows: string[][], m: Mapping, account: AccountType, currency: string): Draft[] {
  const out: Draft[] = [];
  for (const r of rows.slice(1)) {
    const quantity = number(r[m.quantity]);
    const name = (m.name >= 0 ? r[m.name] : "") || (m.ticker >= 0 ? r[m.ticker] : "");
    if (!name || !quantity || quantity <= 0) continue;
    let cur = (m.currency >= 0 && r[m.currency]) || currency;
    let unit = number(r[m.unitCost]);
    if (unit === null && m.totalCost >= 0) {
      const total = number(r[m.totalCost]);
      unit = total !== null ? total / quantity : null;
    }
    if (unit !== null && /^(GBX|GBp|p)$/.test(cur)) {
      unit /= 100;
      cur = "GBP";
    }
    out.push({
      name,
      ticker: m.ticker >= 0 ? r[m.ticker] ?? "" : "",
      isin: m.isin >= 0 ? r[m.isin] ?? "" : "",
      quantity,
      avgCost: unit,
      currency: cur.toUpperCase() === "GBX" ? "GBP" : cur.toUpperCase(),
      account: m.account >= 0 ? accountFrom(r[m.account], account) : account,
    });
  }
  return out;
}

/** Is this a Trading 212 history export (one row per trade, deposit, or dividend)? */
export const isTrading212 = (headers: string[]) =>
  headers.includes("Action") && headers.includes("No. of shares") && headers.includes("Price / share");

/** Trading 212 trades added up into holdings, with the average cost of shares still held. */
export function holdingsFromTrading212(rows: string[][], account: AccountType): Draft[] {
  const h = rows[0];
  const col = (name: string) => h.indexOf(name);
  const [action, isin, ticker, name, shares, price, priceCur] = [
    col("Action"),
    col("ISIN"),
    col("Ticker"),
    col("Name"),
    col("No. of shares"),
    col("Price / share"),
    col("Currency (Price / share)"),
  ];
  const book = new Map<string, Draft>();
  for (const r of rows.slice(1)) {
    const kind = (r[action] ?? "").toLowerCase();
    const buy = kind.includes("buy");
    const sell = kind.includes("sell");
    if (!buy && !sell) continue; // deposits, dividends, interest
    const qty = number(r[shares]);
    let unit = number(r[price]);
    if (!qty || unit === null) continue;
    let cur = r[priceCur] ?? "";
    if (/^(GBX|GBp)$/.test(cur)) {
      unit /= 100;
      cur = "GBP";
    }
    const key = r[isin] || r[ticker];
    const held = book.get(key) ?? {
      name: r[name] || r[ticker],
      ticker: r[ticker] ?? "",
      isin: r[isin] ?? "",
      quantity: 0,
      avgCost: 0,
      currency: cur,
      account,
    };
    if (buy) {
      const total = held.quantity + qty;
      held.avgCost = ((held.avgCost ?? 0) * held.quantity + unit * qty) / total;
      held.quantity = total;
    } else {
      held.quantity = Math.max(0, held.quantity - qty); // selling keeps the average cost of the rest
    }
    book.set(key, held);
  }
  return [...book.values()].filter((d) => d.quantity > 1e-9);
}

// ---- Direct vs regular (India) ----

export interface DirectSavings {
  funds: {
    isin: string;
    name?: string;
    regular_plan?: string;
    direct_plan?: string;
    value_inr?: number;
    years_compared?: number;
    regular_growth_pct?: number;
    direct_growth_pct?: number;
    gap_pct_per_year?: number;
    cost_this_year_inr?: number;
    cost_over_10_years_inr?: number;
    note?: string;
    error?: string;
  }[];
  total_value_inr: number;
  total_cost_this_year_inr: number;
  total_cost_over_10_years_inr: number;
  notes: string;
  error?: string;
}

/** Regular-plan mutual funds that can be compared with their direct twins. */
export const regularPlans = (holdings: Holding[]) => holdings.filter((h) => h.plan === "regular" && h.isin);

// ---- What the model is told ----

const money = (v: number, currency: string | null) => `${currency === "INR" ? "₹" : currency === "USD" ? "$" : currency === "GBP" ? "£" : ""}${v.toLocaleString("en-GB", { maximumFractionDigits: 2 })}${currency && !["INR", "USD", "GBP"].includes(currency) ? ` ${currency}` : ""}`;

/** The portfolio lines for <about_me>, grouped by account. */
export function portfolioForModel(holdings: Holding[]): string {
  if (!holdings.length) return "";
  const lines = holdings.map((h) => {
    const parts = [
      `${h.name}${h.symbol ? ` [${h.symbol}]` : " [symbol not matched]"}`,
      `${+h.quantity.toFixed(4)} ${h.account === "mf" ? "units" : "shares"}`,
      h.avgCost !== null ? `average cost ${money(h.avgCost, h.currency)}` : "",
      ACCOUNT_LABELS[h.account],
      h.plan ? `${h.plan} plan` : "",
      h.plan && h.isin ? `ISIN ${h.isin}` : "",
    ];
    return `- ${parts.filter(Boolean).join(", ")}`;
  });
  return `Their portfolio (from their account; use analyze_portfolio with these symbols and quantities when they ask about it):\n${lines.join("\n")}`;
}
