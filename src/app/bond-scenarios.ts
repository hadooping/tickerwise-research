// Bond market scenario maths. Mirrors price, shift_table, hold_vs_fund and everyday in
// api/bond_scenarios.py (the chat tool), so the card's sliders and Tickerwise's answers agree;
// keep the two in step. Past crises are worked out on the server and arrive ready to chart.

export interface CrisisSeries {
  name: string;
  values: number[];
}

export interface Crisis {
  key: string;
  name: string;
  text: string;
  from: string;
  to: string;
  ten_year_from: number;
  ten_year_to: number;
  dates: string[];
  series: CrisisSeries[];
  end_values: Record<string, number>;
  share_index: string;
}

// The _bond_scenarios event from simulate_bond_scenarios.
export interface BondScenarioData {
  country: "uk" | "us";
  currency: "GBP" | "USD";
  as_of: string;
  name: string;
  source: string;
  curve: Record<string, number>; // years -> yield %
  lengths: Record<string, number>; // Short/Medium/Long -> years
  shift: number;
  focus: "shift" | "crises" | "hold" | "everyday";
  crisis: string | null;
  crises: Crisis[];
  mortgage: { based_on: number; margin: number; balance: number; years: number; name: string };
  annuity_years: number;
  annuity_pot: number;
  savings: number;
  amount: number;
}

/** Price per 1 of face value of a bond paying couponPct a year (in two halves), at yieldPct, with years left. */
export function price(couponPct: number, yieldPct: number, years: number) {
  if (years <= 0) return 1;
  const k = years * 2;
  const r = yieldPct / 200;
  const c = couponPct / 200;
  return r === 0 ? c * k + 1 : (c * (1 - (1 + r) ** -k)) / r + (1 + r) ** -k;
}

export interface ShiftRow {
  bond: string;
  years: number;
  yieldNow: number;
  priceChangePct: number;
  oneYearReturnPct: number;
}

/** For each length: the price change if yields move by `shift` points now, and the return over the
 *  next year (price plus interest) if they stay there. Each bond is newly issued at today's yield. */
export function shiftTable(curve: Record<string, number>, lengths: Record<string, number>, shift: number): ShiftRow[] {
  return Object.entries(lengths).map(([name, years]) => {
    const y = curve[String(years)];
    return {
      bond: `${name} (${years}-year)`,
      years,
      yieldNow: y,
      priceChangePct: (price(y, y + shift, years) - 1) * 100,
      oneYearReturnPct: (price(y, y + shift, years - 1) + y / 100 - 1) * 100,
    };
  });
}

export const END_MOVES = [-2, -1, 0, 1, 2];

/** One bond held until it's repaid against a fund that always holds a bond of the same length.
 *  Yields move by `shift` now and stay, so both earn the same along the way; the difference is the
 *  day you need the money, when the fund is worth whatever yields then make it. */
export function holdVsFund(yieldNow: number, years: number, shift: number, amount: number) {
  const y1 = yieldNow + shift;
  const r = y1 / 200;
  const coupon = yieldNow / 200;
  let saved = 0;
  for (let k = 0; k < years * 2; k++) saved = saved * (1 + r) + coupon;
  const beforeEnd = amount * price(yieldNow, y1, years) * (1 + r) ** (years * 2);
  return {
    rightAfterMove: amount * price(yieldNow, y1, years),
    bondEnd: amount * (1 + saved),
    fundEnd: END_MOVES.map((m) => beforeEnd * price(y1, y1 + m, years)),
  };
}

export function payment(balance: number, ratePct: number, years: number) {
  const r = ratePct / 1200;
  const n = years * 12;
  return r === 0 ? balance / n : (balance * r) / (1 - (1 + r) ** -n);
}

/** Yearly income per 100 for a level income over `years` at yieldPct. */
export function annuityRate(yieldPct: number, years: number) {
  const r = yieldPct / 100;
  return r === 0 ? 100 / years : (100 * r) / (1 - (1 + r) ** -years);
}

/** The yield behind an annuity rate (the inverse of annuityRate). */
export function annuityYield(ratePct: number, years: number) {
  let lo = -5;
  let hi = 30;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (annuityRate(mid, years) < ratePct) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** The starting mortgage and annuity rates the server uses: the yield plus a margin, and a level
 *  income over a typical lifetime at 65 from long yields. */
export function startingRates(d: BondScenarioData) {
  const years = Object.keys(d.curve).map(Number);
  return {
    mortgage: d.curve[String(d.mortgage.based_on)] + d.mortgage.margin,
    annuity: annuityRate(d.curve[String(Math.max(...years))], d.annuity_years),
  };
}
