// Inheritance tax estimate maths. Mirrors api/inheritance.py (the chat tool), so the card and
// Tickerwise's answers agree; keep the two in step. Rules checked 17 Oct 2026: UK bands frozen
// to April 2031, unused pensions counted from 6 April 2027; US 2026 federal exclusion.

export type EstateCountry = "uk" | "us" | "in";

export const CHECKED = "17 Oct 2026";
const UK_NRB = 325000;
const UK_RNRB = 175000;
const UK_TAPER_FROM = 2000000;
const UK_RATE = 0.4;
const UK_CHARITY_RATE = 0.36;
const US_EXCLUSION = 15000000;
const US_RATE = 0.4;
const TAPER = [1, 1, 1, 0.8, 0.6, 0.4, 0.2];

export interface Gift {
  amount: number;
  years_ago: number;
}

export interface EstateInput {
  country: EstateCountry;
  home: number;
  home_to_descendants: boolean;
  savings: number;
  pensions: number;
  other: number;
  debts: number;
  couple: boolean;
  charity_pct: number;
  gifts: Gift[];
}

export interface EstateResult {
  estate: number;
  allowance: number; // nil-rate band (UK) or exclusion (US)
  allowanceUsedByGifts: number;
  residenceBand: number; // UK only
  charity: number;
  taxable: number;
  ratePct: number;
  tax: number;
  taxOnGifts: number;
  toHeirs: number;
}

const netOf = (inp: EstateInput, pensions: boolean) =>
  Math.max(0, inp.home + inp.savings + inp.other + (pensions ? inp.pensions : 0) - inp.debts);

function uk(inp: EstateInput, pensionsCount: boolean): EstateResult {
  const k = inp.couple ? 2 : 1;
  const net = netOf(inp, pensionsCount);
  let nrbLeft = UK_NRB * k;
  let taxOnGifts = 0;
  for (const g of [...inp.gifts].sort((a, b) => b.years_ago - a.years_ago)) {
    const covered = Math.min(nrbLeft, g.amount);
    nrbLeft -= covered;
    taxOnGifts += (g.amount - covered) * UK_RATE * TAPER[Math.floor(g.years_ago)];
  }
  let rnrb = 0;
  if (inp.home_to_descendants && inp.home) {
    rnrb = Math.max(0, UK_RNRB * k - Math.max(0, net - UK_TAPER_FROM) / 2);
    rnrb = Math.min(rnrb, inp.home);
  }
  const charity = (net * inp.charity_pct) / 100;
  const baseline = Math.max(0, net - nrbLeft);
  const rate = baseline && charity >= 0.1 * baseline ? UK_CHARITY_RATE : UK_RATE;
  const taxable = Math.max(0, net - charity - nrbLeft - rnrb);
  const tax = taxable * rate;
  return {
    estate: net,
    allowance: UK_NRB * k,
    allowanceUsedByGifts: UK_NRB * k - nrbLeft,
    residenceBand: rnrb,
    charity,
    taxable,
    ratePct: Math.round(rate * 100),
    tax,
    taxOnGifts,
    toHeirs: net - charity - tax,
  };
}

function us(inp: EstateInput): EstateResult {
  const exclusion = US_EXCLUSION * (inp.couple ? 2 : 1);
  const used = Math.min(exclusion, inp.gifts.reduce((s, g) => s + g.amount, 0));
  const net = netOf(inp, true);
  const charity = (net * inp.charity_pct) / 100;
  const taxable = Math.max(0, net - charity - (exclusion - used));
  const tax = taxable * US_RATE;
  return {
    estate: net,
    allowance: exclusion,
    allowanceUsedByGifts: used,
    residenceBand: 0,
    charity,
    taxable,
    ratePct: US_RATE * 100,
    tax,
    taxOnGifts: 0,
    toHeirs: net - charity - tax,
  };
}

/** `now` is the estimate under the rules that apply to the person's death; `before` (UK, with
 *  pensions) is the same estate under the rules before unused pensions count, in April 2027. */
export function estimate(inp: EstateInput): { now: EstateResult; before: EstateResult | null } {
  if (inp.country === "uk") return { now: uk(inp, true), before: inp.pensions ? uk(inp, false) : null };
  if (inp.country === "us") return { now: us(inp), before: null };
  const net = netOf(inp, true);
  return {
    now: { estate: net, allowance: 0, allowanceUsedByGifts: 0, residenceBand: 0, charity: 0, taxable: 0, ratePct: 0, tax: 0, taxOnGifts: 0, toHeirs: net },
    before: null,
  };
}

/** A typical example to start from, per country. */
export function estateDefaults(country: EstateCountry): EstateInput {
  const base = { home_to_descendants: true, couple: false, charity_pct: 0, gifts: [] as Gift[], other: 0 };
  if (country === "us") return { country, ...base, home: 600000, savings: 900000, pensions: 700000, debts: 100000 };
  if (country === "in") return { country, ...base, home: 15000000, savings: 8000000, pensions: 3000000, debts: 0 };
  return { country, ...base, home: 450000, savings: 200000, pensions: 250000, debts: 50000 };
}
