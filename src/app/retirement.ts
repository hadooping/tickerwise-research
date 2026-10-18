// Retirement planner maths, in today's money. Mirrors api/retirement.py (the chat tool), so the
// card and Tickerwise's answers agree; keep the two in step. Tax figures checked 17 Oct 2026:
// UK 2026/27 (rent at the April 2027 property rates), India FY 2026-27 new regime, US 2026 federal
// (single filer).

export type Country = "uk" | "in" | "us";
export type Currency = "GBP" | "INR" | "USD";

export const CHECKED = "17 Oct 2026";

export const COUNTRIES: Record<
  Country,
  {
    currency: Currency;
    inflation: number;
    growth: [number, number, number];
    withdrawal: number;
    pensionMonthly: number;
    pensionAge: number;
    pot: string;
    pensionName: string;
  }
> = {
  uk: {
    currency: "GBP",
    inflation: 2.5,
    growth: [4, 6, 8],
    withdrawal: 4,
    pensionMonthly: Math.round(((241.3 * 52) / 12) * 100) / 100,
    pensionAge: 67,
    pot: "pension",
    pensionName: "State Pension",
  },
  in: {
    currency: "INR",
    inflation: 6,
    growth: [8, 10, 12],
    withdrawal: 3.5,
    pensionMonthly: 0,
    pensionAge: 58,
    pot: "mutual_funds",
    pensionName: "Pension (EPS or employer)",
  },
  us: {
    currency: "USD",
    inflation: 2.5,
    growth: [4, 6, 8],
    withdrawal: 4,
    pensionMonthly: 2000,
    pensionAge: 67,
    pot: "traditional",
    pensionName: "Social Security",
  },
};

export const POT_TYPES: Record<Country, Record<string, string>> = {
  uk: { pension: "Pension (25% tax-free)", isa: "ISA (tax-free)" },
  in: { mutual_funds: "Mutual funds", nps: "NPS (60% lump sum, 40% annuity)", epf_ppf: "EPF / PPF (tax-free)" },
  us: { traditional: "401(k) / traditional IRA", roth: "Roth IRA / Roth 401(k)" },
};

const NPS_ANNUITY_RATE = 6;
const LAST_AGE = 75;

export interface PlanInput {
  country: Country;
  age: number;
  retire_age: number;
  current_pot: number;
  monthly_saving: number;
  monthly_income: number;
  pot_type?: string | null;
  pension_monthly?: number | null;
  pension_age?: number | null;
  rental_monthly?: number | null;
  inflation_pct?: number | null;
  growth_pct?: [number, number, number] | null;
  withdrawal_pct?: number | null;
  mortgage_monthly?: number | null;
  mortgage_end_age?: number | null;
}

// ---- Tax, per year ----

function bands(income: number, list: [number, number][]) {
  let tax = 0;
  let lower = 0;
  for (const [upper, rate] of list) {
    if (income > lower) tax += (Math.min(income, upper) - lower) * rate;
    lower = upper;
  }
  return tax;
}

/** Tax on income including propertyIncome, which sits on top and pays 2 points more. */
export function ukTax(income: number, propertyIncome = 0) {
  income += propertyIncome;
  const allowance = Math.max(0, 12570 - Math.max(0, income - 100000) / 2);
  const taxable = Math.max(0, income - allowance);
  const tax = bands(taxable, [
    [37700, 0.2],
    [Math.max(37700, 125140 - allowance), 0.4],
    [Infinity, 0.45],
  ]);
  return tax + 0.02 * Math.min(propertyIncome, taxable);
}

export function indiaTax(income: number, standardDeduction = 0) {
  const taxable = Math.max(0, income - standardDeduction);
  let tax = bands(taxable, [
    [400000, 0],
    [800000, 0.05],
    [1200000, 0.1],
    [1600000, 0.15],
    [2000000, 0.2],
    [2400000, 0.25],
    [Infinity, 0.3],
  ]);
  tax = taxable <= 1200000 ? 0 : Math.min(tax, taxable - 1200000);
  return tax * 1.04;
}

export function usTax(ordinary: number, socialSecurity: number, age: number) {
  const provisional = ordinary + socialSecurity / 2;
  let taxableSs = 0;
  if (provisional > 34000)
    taxableSs = Math.min(0.85 * socialSecurity, 0.85 * (provisional - 34000) + Math.min(socialSecurity / 2, 4500));
  else if (provisional > 25000) taxableSs = Math.min(socialSecurity / 2, (provisional - 25000) / 2);
  const taxable = Math.max(0, ordinary + taxableSs - (16100 + (age >= 65 ? 2050 : 0)));
  return bands(taxable, [
    [12400, 0.1],
    [50400, 0.12],
    [105700, 0.22],
    [201775, 0.24],
    [256225, 0.32],
    [640600, 0.35],
    [Infinity, 0.37],
  ]);
}

export interface Income {
  gross: number;
  tax: number;
  net: number;
}

export function takeHome(
  country: Country,
  potType: string,
  pot: number,
  withdrawalPct: number,
  pensionYearly: number,
  age: number,
  gainsShare = 0.5,
  rentYearly = 0
): Income {
  let draw = (pot * withdrawalPct) / 100;
  let tax: number;
  if (country === "uk") {
    const taxFree = pot ? Math.min(0.25, 268275 / pot) : 0;
    tax = ukTax(pensionYearly + (potType === "pension" ? draw * (1 - taxFree) : 0), rentYearly);
  } else if (country === "in") {
    if (potType === "nps") {
      const annuity = (pot * 0.4 * NPS_ANNUITY_RATE) / 100;
      draw = (pot * 0.6 * withdrawalPct) / 100 + annuity;
      tax = indiaTax(annuity + pensionYearly + rentYearly * 0.7, Math.min(75000, pensionYearly));
    } else {
      tax = indiaTax(pensionYearly + rentYearly * 0.7, Math.min(75000, pensionYearly));
      if (potType === "mutual_funds") tax += Math.max(0, draw * gainsShare - 125000) * 0.125 * 1.04;
    }
  } else {
    tax = usTax((potType === "traditional" ? draw : 0) + rentYearly, pensionYearly, age);
  }
  const gross = draw + pensionYearly + rentYearly;
  return { gross, tax, net: gross - tax };
}

// ---- Growth ----

export const realRate = (growthPct: number, inflationPct: number) => (1 + growthPct / 100) / (1 + inflationPct / 100) - 1;

/** The pot at the start of each year from now to `years`, in today's money. */
export function project(pot: number, monthly: number, years: number, growthPct: number, inflationPct: number) {
  const r = (1 + realRate(growthPct, inflationPct)) ** (1 / 12) - 1;
  const values = [pot];
  for (let y = 0; y < years; y++) {
    for (let m = 0; m < 12; m++) pot = pot * (1 + r) + monthly;
    values.push(pot);
  }
  return values;
}

function targetPot(
  country: Country,
  potType: string,
  monthlyIncome: number,
  withdrawalPct: number,
  pensionYearly: number,
  age: number,
  gainsShare: number,
  rentYearly: number
) {
  const want = monthlyIncome * 12;
  const net = (pot: number) => takeHome(country, potType, pot, withdrawalPct, pensionYearly, age, gainsShare, rentYearly).net;
  if (net(0) >= want) return 0;
  let low = 0;
  let high = ((want * 100) / withdrawalPct) * 3 + 1;
  while (net(high) < want) high *= 2;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (net(mid) < want) low = mid;
    else high = mid;
  }
  return high;
}

export interface Plan {
  currency: Currency;
  potType: string;
  inflation: number;
  growth: [number, number, number];
  withdrawal: number;
  pensionMonthly: number;
  pensionAge: number;
  retireAge: number;
  target: number;
  targetFuture: number;
  bridge: number;
  mortgage: number; // extra pot for mortgage payments still due after retiring
  ages: number[];
  projections: { cautious: number[]; middle: number[]; hopeful: number[] };
  paidIn: number;
  gap: number;
  monthlyNeeded: number | null;
  ageNeeded: number | null;
  income: { cautious: Income; middle: Income; hopeful: Income };
}

export function plan(inp: PlanInput): Plan {
  const c = COUNTRIES[inp.country];
  const potType = inp.pot_type && inp.pot_type in POT_TYPES[inp.country] ? inp.pot_type : c.pot;
  const inflation = inp.inflation_pct ?? c.inflation;
  const growth = inp.growth_pct ?? c.growth;
  const withdrawal = inp.withdrawal_pct || c.withdrawal;
  const pensionMonthly = inp.pension_monthly ?? c.pensionMonthly;
  const pensionAge = inp.pension_age || c.pensionAge;
  const pensionYearly = pensionMonthly * 12;
  const rentYearly = (inp.rental_monthly ?? 0) * 12;
  const retireAge = Math.max(inp.retire_age, inp.age);
  const years = retireAge - inp.age;

  const run = (g: number) => project(inp.current_pot, inp.monthly_saving, years, g, inflation);
  const projections = { cautious: run(growth[0]), middle: run(growth[1]), hopeful: run(growth[2]) };
  const paidIn = inp.current_pot + inp.monthly_saving * 12 * years;
  const middlePot = projections.middle[years];
  const gainsShare = middlePot ? Math.max(0, 1 - paidIn / middlePot) : 0;

  // Mortgage payments still due after retiring at atAge, in today's money: the payment is fixed, so
  // inflation shrinks it a little each year. Paid from the pot, on top of the income wanted.
  const mortgageLeft = (atAge: number) => {
    let total = 0;
    for (let a = atAge; a < (inp.mortgage_end_age ?? 0); a++)
      total += ((inp.mortgage_monthly ?? 0) * 12) / (1 + inflation / 100) ** (a - inp.age);
    return total;
  };

  const need = (atAge: number) => {
    const base = targetPot(
      inp.country,
      potType,
      inp.monthly_income,
      withdrawal,
      pensionYearly,
      Math.max(atAge, pensionAge),
      gainsShare,
      rentYearly
    );
    // Until the pension starts, the pot and rent alone fall short by this much a year.
    const before = takeHome(inp.country, potType, base, withdrawal, 0, atAge, gainsShare, rentYearly).net;
    return {
      base,
      bridge: Math.max(0, pensionAge - atAge) * Math.max(0, inp.monthly_income * 12 - before),
      mortgage: mortgageLeft(atAge),
    };
  };
  const { base, bridge, mortgage } = need(retireAge);
  const target = base + bridge + mortgage;
  const gap = Math.max(0, target - middlePot);

  let monthlyNeeded: number | null = null;
  if (gap && years) {
    const r = (1 + realRate(growth[1], inflation)) ** (1 / 12) - 1;
    const n = years * 12;
    const grown = inp.current_pot * (1 + r) ** n;
    const factor = r ? ((1 + r) ** n - 1) / r : n;
    monthlyNeeded = Math.max(0, (target - grown) / factor);
  }
  let ageNeeded: number | null = gap ? null : retireAge;
  if (gap) {
    for (let a = retireAge + 1; a <= Math.max(LAST_AGE, retireAge); a++) {
      const n = need(a);
      if (project(inp.current_pot, inp.monthly_saving, a - inp.age, growth[1], inflation)[a - inp.age] >= n.base + n.bridge + n.mortgage) {
        ageNeeded = a;
        break;
      }
    }
  }

  const income = (pot: number) =>
    takeHome(inp.country, potType, pot, withdrawal, pensionYearly, Math.max(retireAge, pensionAge), gainsShare, rentYearly);
  return {
    currency: c.currency,
    potType,
    inflation,
    growth,
    withdrawal,
    pensionMonthly,
    pensionAge,
    retireAge,
    target,
    targetFuture: target * (1 + inflation / 100) ** years,
    bridge,
    mortgage,
    ages: Array.from({ length: years + 1 }, (_, i) => inp.age + i),
    projections,
    paidIn,
    gap,
    monthlyNeeded,
    ageNeeded,
    income: {
      cautious: income(projections.cautious[years]),
      middle: income(middlePot),
      hopeful: income(projections.hopeful[years]),
    },
  };
}

const LOCALES: Record<Currency, string> = { GBP: "en-GB", USD: "en-US", INR: "en-IN" };

export function money(v: number, currency: Currency, compact = false) {
  return new Intl.NumberFormat(LOCALES[currency], {
    style: "currency",
    currency,
    maximumFractionDigits: compact && Math.abs(v) >= 1000 ? 1 : 0,
    notation: compact ? "compact" : "standard",
  }).format(v);
}

/** A starting point from the person's profile: their country and the middle of their age range. */
export function defaultsFor(country: Country, ageRange: string): PlanInput {
  const age = { "18-29": 25, "30-39": 35, "40-54": 45, "55+": 57 }[ageRange] ?? 35;
  const examples: Record<Country, { pot: number; saving: number; income: number }> = {
    uk: { pot: 30000, saving: 400, income: 2500 },
    in: { pot: 500000, saving: 15000, income: 75000 },
    us: { pot: 60000, saving: 800, income: 5000 },
  };
  const e = examples[country];
  return {
    country,
    age,
    retire_age: Math.max(age + 1, country === "in" ? 60 : 67),
    current_pot: e.pot,
    monthly_saving: e.saving,
    monthly_income: e.income,
  };
}
