"use client";

import React, { useMemo, useState } from "react";
import styles from "./retirement.module.css";
import { AskButton } from "./ask-gate";
import { Field } from "./retirement-card";
import DataChart, { type FigureData } from "./data-chart";
import { money, type Country } from "./retirement";
import { breakEven, MORTGAGE_COUNTRIES, mortgageDefaults, run, type MortgageInput } from "./mortgage";

const LABELS: Record<Country, string> = { uk: "UK", in: "India", us: "US" };

const NOTES: Record<Country, React.ReactNode> = {
  uk: (
    <>
      Most UK lenders let you overpay up to 10% of the balance a year without an early repayment charge; check yours. Investing
      is shown in a Stocks and Shares ISA. Paying into a pension instead adds tax relief but locks the money until 57.
    </>
  ),
  in: (
    <>
      Banks can&apos;t charge individuals for prepaying a floating-rate home loan; fixed-rate loans may carry a charge. Under the
      old tax regime, home loan interest on a self-occupied home can reduce tax (up to ₹2 lakh a year), which makes prepaying a
      little less attractive. Investing is shown without tax, as in PPF or EPF.
    </>
  ),
  us: (
    <>
      Mortgage interest only lowers your tax if you itemize deductions; most people take the standard deduction. Investing is
      shown in a Roth IRA or other tax-free account, and a 401(k) match is usually worth taking first.
    </>
  ),
};

const yearsAndMonths = (months: number) => {
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y && `${y} year${y === 1 ? "" : "s"}`, m && `${m} month${m === 1 ? "" : "s"}`].filter(Boolean).join(" ") || "no time";
};

/** Overpaying the mortgage against investing the same money, compared at the end of the term. */
export default function MortgageCard({
  initial,
  onAsk,
  disabled = false,
}: {
  initial: MortgageInput;
  onAsk?: (question: string) => void;
  disabled?: boolean;
}) {
  const [inp, setInp] = useState<MortgageInput>({ ...mortgageDefaults(initial.country), ...initial });
  const set = (patch: Partial<MortgageInput>) => setInp((s) => ({ ...s, ...patch }));
  const cur = MORTGAGE_COUNTRIES[inp.country].currency;
  const sym = { GBP: "£", USD: "$", INR: "₹" }[cur];
  const big = cur === "INR" ? 20 : 1; // rupee mortgages are roughly 20 times bigger
  const growth = inp.growth_pct ?? MORTGAGE_COUNTRIES[inp.country].growth;
  const m = (v: number) => money(v, cur);

  const { over, invest, even } = useMemo(
    () => ({ over: run(inp, growth, true), invest: run(inp, growth, false), even: breakEven(inp) }),
    [inp, growth]
  );
  const sooner = inp.years_left * 12 - (over.paidOffMonth ?? inp.years_left * 12);
  const saved = invest.interest - over.interest;
  const ahead = invest.pot - over.pot;
  const nothing = !inp.monthly_extra && !inp.lump_sum;

  const year = new Date().getFullYear();
  // Investments minus mortgage under each way, as the gap between them: above zero, investing is ahead.
  const fig: FigureData = {
    kind: "line",
    title: "How far investing is ahead of overpaying",
    unit: cur,
    labels: over.yearly.map((_, i) => String(year + i)),
    series: [{ name: "Investing ahead by", values: invest.yearly.map((v, i) => Math.round(v - over.yearly[i])) }],
    note: `Each year: investments minus mortgage if you invest, less the same if you overpay. Below zero, overpaying is ahead. At ${growth}% a year growth after fees; overpaying keeps the payment the same, and once the mortgage is gone the payment and the extra are invested.`,
  };

  return (
    <section className={styles.card} aria-label="Overpay the mortgage or invest">
      <header className={styles.head}>
        <h3>Overpay the mortgage or invest?</h3>
        <div className={styles.segmented} role="group" aria-label="Country">
          {(Object.keys(LABELS) as Country[]).map((k) => (
            <button key={k} aria-pressed={inp.country === k} onClick={() => k !== inp.country && setInp(mortgageDefaults(k))}>
              {LABELS[k]}
            </button>
          ))}
        </div>
      </header>

      <div className={styles.layout}>
        <div className={styles.form}>
          <Field label="Mortgage left" value={inp.balance} min={10000 * big} max={1000000 * big} step={5000 * big} prefix={sym} onChange={(v) => set({ balance: Math.max(1, v) })} />
          <Field label="Interest rate" value={inp.rate_pct} min={0} max={12} step={0.05} suffix="%" onChange={(v) => set({ rate_pct: Math.min(25, Math.max(0, v)) })} />
          <Field label="Years left" value={inp.years_left} min={1} max={40} step={1} onChange={(v) => set({ years_left: Math.min(40, Math.max(1, Math.round(v))) })} />
          <Field
            label="Extra each month"
            hint="to overpay or to invest"
            value={inp.monthly_extra}
            min={0}
            max={2000 * big}
            step={25 * big}
            prefix={sym}
            onChange={(v) => set({ monthly_extra: Math.max(0, v) })}
          />
          <Field label="One-off amount" hint="to overpay or to invest now" value={inp.lump_sum} min={0} max={200000 * big} step={1000 * big} prefix={sym} onChange={(v) => set({ lump_sum: Math.max(0, v) })} />
          <Field label="Investment growth" hint="a year, after fees; not guaranteed" value={growth} min={0} max={15} step={0.5} suffix="%" onChange={(v) => set({ growth_pct: Math.min(20, Math.max(-5, v)) })} />
        </div>

        <div className={styles.results}>
          {nothing ? (
            <p className={styles.close}>Add an extra monthly amount or a one-off amount to compare the two.</p>
          ) : (
            <>
              <div className={styles.tiles}>
                <div className={styles.tile}>
                  <span className={styles.tileLabel}>Overpaying</span>
                  <strong>{yearsAndMonths(sooner)} sooner</strong>
                  <span className={styles.hint}>mortgage-free, saving {m(saved)} in interest</span>
                </div>
                <div className={styles.tile}>
                  <span className={styles.tileLabel}>Investing instead</span>
                  <strong>
                    {m(Math.abs(ahead))} {ahead >= 0 ? "ahead" : "behind"}
                  </strong>
                  <span className={styles.hint}>by the end of the term, at {growth}% growth</span>
                </div>
                <div className={styles.tile}>
                  <span className={styles.tileLabel}>Break-even growth</span>
                  <strong>{even === null ? "–" : `${even}% a year`}</strong>
                  <span className={styles.hint}>investing comes out ahead above this</span>
                </div>
              </div>

              <p className={styles.close}>
                Overpaying earns your mortgage rate, {inp.rate_pct}%, for certain. Investing only comes out ahead if growth beats
                about {even ?? inp.rate_pct}% a year on average, and it can fall along the way. The bigger the gap between the two,
                the clearer the choice; when they&apos;re close, the certainty of overpaying counts for more.
              </p>

              <DataChart fig={fig} bare />

              <table className={styles.table}>
                <caption>By the end of the term ({year + inp.years_left})</caption>
                <thead>
                  <tr>
                    <th scope="col" />
                    <th scope="col">Overpay first</th>
                    <th scope="col">Invest instead</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Mortgage-free after</th>
                    <td>{yearsAndMonths(over.paidOffMonth ?? inp.years_left * 12)}</td>
                    <td>{yearsAndMonths(inp.years_left * 12)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Interest paid</th>
                    <td>{m(over.interest)}</td>
                    <td>{m(invest.interest)}</td>
                  </tr>
                  <tr className={styles.net}>
                    <th scope="row">Investments</th>
                    <td>{m(over.pot)}</td>
                    <td>{m(invest.pot)}</td>
                  </tr>
                </tbody>
              </table>

              <p className={styles.close}>
                <strong>Before deciding:</strong> keep an emergency fund first, because money paid into a mortgage is hard to get
                back. Pay off more expensive debts such as credit cards before either. And being mortgage-free sooner has a value of its own
                that the numbers don&apos;t show.
              </p>
            </>
          )}

          {onAsk && (
            <AskButton
              onAsk={onAsk}
              disabled={disabled || nothing}
              label="Ask Tickerwise about this →"
              question={() =>
                `Compare overpaying my mortgage with investing: I owe ${m(inp.balance)} at ${inp.rate_pct}% with ${inp.years_left} years left, and could put ${inp.monthly_extra ? `${m(inp.monthly_extra)} a month` : ""}${inp.monthly_extra && inp.lump_sum ? " and " : ""}${inp.lump_sum ? `${m(inp.lump_sum)} now` : ""} towards one or the other. What are the trade-offs?`
              }
            />
          )}
        </div>
      </div>

      <p className={styles.note}>
        {NOTES[inp.country]} Investments grow at a steady rate here; real returns go up and down. An illustration, not advice.
      </p>
    </section>
  );
}
