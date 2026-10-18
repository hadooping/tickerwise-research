// Share valuation maths. Mirrors value_per_share and implied_rate in api/valuation.py (the chat
// tool), so the card's sliders and Tickerwise's answers agree; keep the two in step.

export type Method = "dcf" | "bank" | "dividend" | "sales" | "none";

export interface PeerMetrics {
  symbol: string;
  name: string;
  currency: string;
  price: number | null;
  pe: number | null;
  forward_pe: number | null;
  peg: number | null;
  ev_ebitda: number | null;
  fcf_yield_pct: number | null;
  dividend_yield_pct: number | null;
  price_to_book: number | null;
  price_to_sales?: number | null;
  roe_pct: number | null;
}

export interface PeHistory {
  measure?: Measure; // threads saved before other yardsticks are P/E
  dates: string[];
  pe: (number | null)[];
  median: number;
  low: number;
  high: number;
}

export interface Discount {
  rate: number;
  bond: number;
  bond_name: string;
  bond_note: string; // "as of …" or "assumed"
  beta: number;
  beta_raw: number | null;
  premium: number;
  terminal: number;
}

export interface QualityItem {
  key: string;
  label: string;
  value: string;
  status: "good" | "ok" | "weak";
  meaning: string;
}

export interface Dividends {
  years: number[];
  companies: { symbol: string; name: string; currency: string; dps: (number | null)[]; yield: (number | null)[]; specials?: number[] }[];
}

export type RatingKey = "strongBuy" | "buy" | "hold" | "sell" | "strongSell";

export interface Analysts {
  url: string;
  ratings?: Record<RatingKey, number>;
  ratings_month_ago?: Record<RatingKey, number> | null;
  targets?: { low: number | null; median: number | null; mean: number | null; high: number | null };
  changes?: { date: string; firm: string; rating: string | null; from_rating: string | null; action: string; target: number | null; prior_target: number | null }[];
  consensus?: string | null;
  average_now?: number | null; // 1 (strong sell) to 5 (strong buy)
  average_month_ago?: number | null;
  shift?: string | null; // "more positive", "less positive (slightly)", "unchanged"
  totals?: { buy: number; hold: number; sell: number; total: number };
  average_label?: string | null;
  median_vs_price_pct?: number | null;
}

// The yardstick that suits the company: price ÷ profit, ÷ net assets or ÷ sales.
export type Measure = "pe" | "pb" | "ps" | "none";

// The company's yardstick beside its own usual, its competitors' median, and its home stock market,
// with any extra view its industry needs. Threads saved before other yardsticks carry pe instead of value.
export interface PeContext {
  measure?: Measure;
  company?: number;
  extra?: { label: string; sub: string; value: number }[];
  own_usual?: number | null;
  own_since?: string | null;
  peers_median?: number | null;
  peers?: { name: string; value?: number; pe?: number }[];
  market?: { name: string; value?: number; pe?: number; via: string } | null;
  caution?: string | null;
}

// Another company's analyst views, for comparing side by side.
export interface PeerAnalysts {
  symbol: string;
  name: string;
  currency: string;
  price: number;
  ratings?: Record<RatingKey, number>;
  average_now?: number | null;
  average_label?: string | null;
  targets?: Analysts["targets"];
  median_vs_price_pct?: number | null;
  shift?: string | null;
  url?: string;
}

// The _valuation event from value_company.
export interface ValuationData {
  as_of: string;
  symbol: string;
  name: string;
  currency: string;
  price: number;
  method: Method;
  kind?: string;
  why?: string | null;
  reason?: string | null;
  base?: number | null; // dcf: free cash flow a share; bank: book value a share; dividend: a year's dividend; sales: sales a share
  extra?: number | null; // dcf and sales: net cash a share
  implied_pct?: number | null;
  actual_pct?: number | null;
  actual_label?: string | null;
  discount?: Discount | null;
  years?: number | null;
  margin_pct?: number;
  exit_pe?: number;
  quality?: QualityItem[];
  estimate?: { rate_pct: number; value: number } | null;
  earnings_yield_pct?: number | null;
  pe_history: PeHistory | null;
  pe_context?: PeContext | null;
  peers: PeerMetrics[];
  dividends?: Dividends | null;
  analysts?: Analysts | null;
  peer_analysts?: PeerAnalysts[];
  view?: "priced" | "value" | "analysts" | "past" | "peers" | null; // the tab to open on
  // Saved threads from before the discount rate was risk-based carry these instead.
  discount_pct?: number | null;
  terminal_pct?: number | null;
}

export interface Assumptions {
  rate: number; // growth (dcf, dividend, sales) or return on equity (bank), % a year
  discount: number;
  terminal: number;
  years: number;
  margin: number; // sales only: profit margin once mature, %
  exitPe: number; // sales only: P/E it's valued at then
}

/** Value per share at these assumptions, or null when the maths has no answer (the discount rate
 *  must be above long-run growth, or for dividends above dividend growth). */
export function valuePerShare(method: Method, base: number, extra: number, a: Assumptions): number | null {
  const r = a.discount / 100;
  const tg = a.terminal / 100;
  const g = a.rate / 100;
  if (method === "bank") return r <= tg ? null : (base * (g - tg)) / (r - tg);
  if (method === "dividend") return r <= g ? null : (base * (1 + g)) / (r - g);
  if (method === "sales") return (base * (1 + g) ** a.years * (a.margin / 100) * a.exitPe) / (1 + r) ** a.years + extra;
  if (r <= tg) return null;
  let value = 0;
  let cash = base;
  for (let t = 1; t <= a.years; t++) {
    cash *= 1 + g;
    value += cash / (1 + r) ** t;
  }
  value += (cash * (1 + tg)) / (r - tg) / (1 + r) ** a.years;
  return value + extra;
}

/** The rate at which the value equals the price, searched from -50% to 100% (or, for dividends, up
 *  to the discount rate). */
export function impliedRate(method: Method, base: number, extra: number, price: number, a: Omit<Assumptions, "rate">): number | null {
  const f = (rate: number) => (valuePerShare(method, base, extra, { ...a, rate }) ?? 0) - price;
  let lo = -50;
  let hi = method === "dividend" ? a.discount - 0.01 : 100;
  if (f(lo) > 0 || f(hi) < 0) return null;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < 0) lo = mid;
    else hi = mid;
  }
  return Math.round(((lo + hi) / 2) * 10) / 10;
}

/** The starting assumptions from the tool, including older saved threads. */
export function startingAssumptions(d: ValuationData, rate: number): Assumptions {
  return {
    rate,
    discount: d.discount?.rate ?? d.discount_pct ?? 9,
    terminal: d.discount?.terminal ?? d.terminal_pct ?? 2.5,
    years: d.years ?? 10,
    margin: d.margin_pct ?? 10,
    exitPe: d.exit_pe ?? 18,
  };
}

/** A share price in its own currency, with pence-level precision ("$343.46", "₹1,211.20"). */
export function price(v: number, currency: string, compact = false) {
  const locale = { GBP: "en-GB", USD: "en-US", INR: "en-IN" }[currency] ?? "en-GB";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: compact || Math.abs(v) >= 1000 ? 0 : 2,
      minimumFractionDigits: compact || Math.abs(v) >= 1000 ? 0 : 2,
    }).format(v);
  } catch {
    return `${currency} ${v.toFixed(2)}`;
  }
}
