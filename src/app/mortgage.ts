// Overpay the mortgage or invest. Mirrors api/mortgage.py (the chat tool), so the card and
// Tickerwise's answers agree; keep the two in step. Both ways are compared at the end of the
// mortgage's term, when both are mortgage-free; investments are in a tax-free account.

import type { Country, Currency } from "./retirement";

export const MORTGAGE_COUNTRIES: Record<Country, { currency: Currency; growth: number }> = {
  uk: { currency: "GBP", growth: 6 },
  in: { currency: "INR", growth: 10 },
  us: { currency: "USD", growth: 6 },
};

export interface MortgageInput {
  country: Country;
  balance: number;
  rate_pct: number;
  years_left: number;
  monthly_extra: number;
  lump_sum: number;
  growth_pct?: number | null;
}

export interface Run {
  payment: number;
  interest: number;
  pot: number;
  paidOffMonth: number | null;
  yearly: number[]; // investments minus mortgage, at the start and at the end of each year
}

/** The monthly payment that clears balance over months. */
export function payment(balance: number, ratePct: number, months: number) {
  const r = ratePct / 100 / 12;
  return r === 0 ? balance / months : (balance * r) / (1 - (1 + r) ** -months);
}

/** Month by month over the term: the mortgage, the investments, and the interest paid. */
export function run(inp: MortgageInput, growthPct: number, overpay: boolean): Run {
  const months = inp.years_left * 12;
  const pay = payment(inp.balance, inp.rate_pct, months);
  const r = inp.rate_pct / 100 / 12;
  const g = (1 + growthPct / 100) ** (1 / 12) - 1;
  let balance = inp.balance;
  let pot = 0;
  if (overpay) {
    pot = Math.max(0, inp.lump_sum - balance);
    balance = Math.max(0, balance - inp.lump_sum);
  } else {
    pot = inp.lump_sum;
  }
  let interest = 0;
  let paidOffMonth: number | null = balance <= 0 ? 0 : null;
  const yearly = [pot - balance];
  for (let m = 1; m <= months; m++) {
    pot *= 1 + g;
    let budget = pay + (overpay ? inp.monthly_extra : 0);
    if (balance > 0) {
      const charge = balance * r;
      interest += charge;
      balance += charge;
      const used = Math.min(balance, budget);
      balance -= used;
      budget -= used;
      if (balance <= 1e-6) {
        balance = 0;
        if (paidOffMonth === null) paidOffMonth = m;
      }
    }
    pot += overpay ? budget : inp.monthly_extra;
    if (m % 12 === 0) yearly.push(pot - balance);
  }
  return { payment: pay, interest, pot, paidOffMonth, yearly };
}

/** The yearly growth at which both ways end with the same investments. */
export function breakEven(inp: MortgageInput): number | null {
  const diff = (g: number) => run(inp, g, false).pot - run(inp, g, true).pot;
  let lo = -10;
  let hi = 30;
  if (diff(lo) > 0 || diff(hi) < 0) return null;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (diff(mid) < 0) lo = mid;
    else hi = mid;
  }
  return Math.round(((lo + hi) / 2) * 10) / 10;
}

/** A typical example for each country, until the person enters their own. */
export function mortgageDefaults(country: Country): MortgageInput {
  return {
    uk: { country, balance: 200000, rate_pct: 4.5, years_left: 25, monthly_extra: 200, lump_sum: 0 },
    in: { country, balance: 4000000, rate_pct: 8.5, years_left: 20, monthly_extra: 10000, lump_sum: 0 },
    us: { country, balance: 300000, rate_pct: 6.5, years_left: 28, monthly_extra: 300, lump_sum: 0 },
  }[country];
}
