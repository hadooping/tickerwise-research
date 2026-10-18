"use client";

import React, { useMemo, useState } from "react";
import styles from "./retirement.module.css";
import { AskButton } from "./ask-gate";
import { Field } from "./retirement-card";
import DataChart, { type FigureData } from "./data-chart";
import { money } from "./retirement";
import {
  annuityRate,
  annuityYield,
  END_MOVES,
  holdVsFund,
  payment,
  shiftTable,
  startingRates,
  type BondScenarioData,
} from "./bond-scenarios";

type Tab = BondScenarioData["focus"];
const TABS: [Tab, string][] = [
  ["shift", "If yields move"],
  ["crises", "Past crises"],
  ["hold", "Hold or fund"],
  ["everyday", "Everyday costs"],
];

const pct = (v: number, digits = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits)}%`;
const pts = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)} point${Math.abs(v) === 1 ? "" : "s"}`;
// Day and month for spells of a few weeks; month and year for longer ones, which keeps labels short.
const dateLabel = (d: string, long: boolean) =>
  new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", long ? { month: "short", year: "2-digit", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" });

function ShiftField({ shift, setShift }: { shift: number; setShift: (v: number) => void }) {
  return (
    <Field
      label="Yields move by"
      hint="percentage points, straight away"
      value={shift}
      min={-3}
      max={3}
      step={0.25}
      suffix="pts"
      onChange={(v) => setShift(Math.max(-5, Math.min(5, Math.round(v * 4) / 4)))}
    />
  );
}

function IfYieldsMove({ d, shift, setShift }: { d: BondScenarioData; shift: number; setShift: (v: number) => void }) {
  const rows = useMemo(() => shiftTable(d.curve, d.lengths, shift), [d, shift]);
  const steps = Array.from({ length: 13 }, (_, i) => -3 + i * 0.5);
  const fig: FigureData = {
    kind: "line",
    title: "Price change if yields move straight away",
    unit: "%",
    labels: steps.map((s) => (s > 0 ? `+${s}` : String(s))),
    series: Object.entries(d.lengths).map(([name, years]) => ({
      name: `${name} (${years}-year)`,
      values: steps.map((s) => Math.round(shiftTable(d.curve, { [name]: years }, s)[0].priceChangePct * 10) / 10),
    })),
    note: "Across: the move in yields, in percentage points. Newly issued government bonds paying today's yield.",
  };
  const long = rows[rows.length - 1];
  const short = rows[0];
  return (
    <div className={styles.layout}>
      <div className={styles.form}>
        <ShiftField shift={shift} setShift={setShift} />
        <p className={styles.hint}>
          Yields now: {rows.map((r) => `${r.years}-year ${r.yieldNow.toFixed(2)}%`).join(", ")} ({d.as_of}).
        </p>
      </div>
      <div className={styles.results}>
        <div className={styles.tiles}>
          {rows.map((r) => (
            <div key={r.bond} className={styles.tile}>
              <span className={styles.tileLabel}>{r.bond}</span>
              <strong>{pct(r.priceChangePct)}</strong>
              <span className={styles.hint}>
                straight away; {pct(r.oneYearReturnPct)} after a year with interest
              </span>
            </div>
          ))}
        </div>
        <p className={styles.close}>
          {shift === 0
            ? "With no move, each bond simply earns its yield."
            : `${shift > 0 ? "Rising" : "Falling"} yields ${shift > 0 ? "cut" : "lift"} bond prices, and the longer the bond, the bigger the effect: the ${long.years}-year moves about ${Math.abs(short.priceChangePct) > 0.05 ? (long.priceChangePct / short.priceChangePct).toFixed(1) : "–"} times as much as the ${short.years}-year. A year's interest cushions small moves, which is why short bonds can still end the year up.`}
        </p>
        <DataChart fig={fig} bare />
      </div>
    </div>
  );
}

function PastCrises({ d }: { d: BondScenarioData }) {
  const [key, setKey] = useState(d.crisis && d.crises.some((c) => c.key === d.crisis) ? d.crisis : d.crises[d.crises.length - 1]?.key);
  const c = d.crises.find((x) => x.key === key) ?? d.crises[0];
  if (!c) return <p className={styles.close}>No past crises are available for this market.</p>;
  const fig: FigureData = {
    kind: "line",
    title: `${money(d.amount, d.currency)} through the ${c.name}`,
    unit: d.currency,
    labels: c.dates.map((x) => dateLabel(x, Date.parse(c.dates[c.dates.length - 1]) - Date.parse(c.dates[0]) > 90 * 86400000)),
    series: c.series,
    note: `Bonds are modelled from actual ${d.country === "uk" ? "gilt" : "Treasury"} yields as funds holding bonds of each length (checked against real funds in 2022); shares are the ${c.share_index} without dividends; the mix is 60% shares and 40% medium bonds, rebalanced monthly.`,
  };
  return (
    <>
      <div className={styles.segmented} role="group" aria-label="Crisis" style={{ flexWrap: "wrap" }}>
        {d.crises.map((x) => (
          <button key={x.key} aria-pressed={x.key === c.key} onClick={() => setKey(x.key)}>
            {x.name}
          </button>
        ))}
      </div>
      <p className={styles.close}>
        <strong>
          {c.from} to {c.to}.
        </strong>{" "}
        {c.text} The 10-year yield went from {c.ten_year_from}% to {c.ten_year_to}%.
      </p>
      <DataChart fig={fig} bare />
      <table className={styles.table}>
        <caption>What {money(d.amount, d.currency)} became</caption>
        <tbody>
          {c.series.map((s) => {
            const end = c.end_values[s.name];
            return (
              <tr key={s.name}>
                <th scope="row">{s.name}</th>
                <td>{money(end, d.currency)}</td>
                <td>{pct((end / d.amount - 1) * 100)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

function HoldOrFund({ d, shift, setShift }: { d: BondScenarioData; shift: number; setShift: (v: number) => void }) {
  const [years, setYears] = useState(10);
  const lengths = Object.keys(d.curve).map(Number).sort((a, b) => a - b);
  // Today's yield for this length, read between the published ones.
  const y = useMemo(() => {
    const below = [...lengths].reverse().find((l) => l <= years) ?? lengths[0];
    const above = lengths.find((l) => l >= years) ?? lengths[lengths.length - 1];
    if (below === above) return d.curve[String(below)];
    const w = (years - below) / (above - below);
    return d.curve[String(below)] * (1 - w) + d.curve[String(above)] * w;
  }, [d.curve, lengths, years]);
  const h = useMemo(() => holdVsFund(y, years, shift, d.amount), [y, years, shift, d.amount]);
  const fig: FigureData = {
    kind: "bar",
    title: `Worth after ${years} years, if yields then`,
    unit: d.currency,
    labels: END_MOVES.map((m) => (m === 0 ? "stay put" : `${m > 0 ? "rise" : "fall"} ${Math.abs(m)} pt${Math.abs(m) === 1 ? "" : "s"}`)),
    series: [
      { name: "Bond held to the end", values: END_MOVES.map(() => Math.round(h.bondEnd)) },
      { name: "Bond fund", values: h.fundEnd.map(Math.round) },
    ],
    note: "Interest reinvested at the new yield in both. A fund keeps buying new bonds, so it never reaches an end date.",
  };
  return (
    <div className={styles.layout}>
      <div className={styles.form}>
        <ShiftField shift={shift} setShift={setShift} />
        <Field label="Bond length" hint="years until it's repaid" value={years} min={2} max={30} step={1} onChange={(v) => setYears(Math.max(1, Math.min(30, Math.round(v))))} />
      </div>
      <div className={styles.results}>
        <div className={styles.tiles}>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>Right after the move</span>
            <strong>{money(h.rightAfterMove, d.currency)}</strong>
            <span className={styles.hint}>both, from {money(d.amount, d.currency)} at {y.toFixed(2)}%</span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>Bond held to the end</span>
            <strong>{money(h.bondEnd, d.currency)}</strong>
            <span className={styles.hint}>after {years} years, whatever yields do then</span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>Bond fund after {years} years</span>
            <strong>
              {money(Math.min(...h.fundEnd), d.currency)} to {money(Math.max(...h.fundEnd), d.currency)}
            </strong>
            <span className={styles.hint}>depending on yields that day</span>
          </div>
        </div>
        <p className={styles.close}>
          Both fall the same amount when yields move, and both earn the same interest afterwards. The difference is the end:
          a single bond pays back its full value on a known date, so a fall in its price only matters if you sell early. A
          fund has no end date, so what you get depends on yields on the day you sell.
        </p>
        <DataChart fig={fig} bare />
      </div>
    </div>
  );
}

function EverydayCosts({ d, shift, setShift }: { d: BondScenarioData; shift: number; setShift: (v: number) => void }) {
  const start = useMemo(() => startingRates(d), [d]);
  const [balance, setBalance] = useState(d.mortgage.balance);
  const [rate, setRate] = useState(Math.round(start.mortgage * 20) / 20);
  const [pot, setPot] = useState(d.annuity_pot);
  const [annuity, setAnnuity] = useState(Math.round(start.annuity * 20) / 20);
  const cur = d.currency;
  const sym = cur === "GBP" ? "£" : "$";
  const payNow = payment(balance, rate, d.mortgage.years);
  const payAfter = payment(balance, Math.max(0, rate + shift), d.mortgage.years);
  const annuityAfter = annuityRate(annuityYield(annuity, d.annuity_years) + shift, d.annuity_years);
  const savings = (d.savings * shift) / 100;
  return (
    <div className={styles.layout}>
      <div className={styles.form}>
        <ShiftField shift={shift} setShift={setShift} />
        <Field label="Mortgage" hint={`to borrow, over ${d.mortgage.years} years`} value={balance} min={50000} max={1000000} step={5000} prefix={sym} onChange={(v) => setBalance(Math.max(1000, v))} />
        <Field label={`${d.mortgage.name} rate now`} value={rate} min={1} max={12} step={0.05} suffix="%" onChange={(v) => setRate(Math.max(0, Math.min(25, v)))} />
        <Field label="Pension pot for an annuity" hint="bought at 65" value={pot} min={10000} max={1000000} step={5000} prefix={sym} onChange={(v) => setPot(Math.max(1000, v))} />
        <Field label="Annuity rate now" hint="income a year per 100" value={annuity} min={3} max={12} step={0.05} suffix="%" onChange={(v) => setAnnuity(Math.max(1, Math.min(20, v)))} />
      </div>
      <div className={styles.results}>
        <div className={styles.tiles}>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>Mortgage payment</span>
            <strong>
              {money(payAfter - payNow, cur)} a month
            </strong>
            <span className={styles.hint}>
              {money(payNow, cur)} → {money(payAfter, cur)} at {Math.max(0, rate + shift).toFixed(2)}%
            </span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>Annuity income</span>
            <strong>{money(((annuityAfter - annuity) * pot) / 100, cur)} a year</strong>
            <span className={styles.hint}>
              {money((annuity * pot) / 100, cur)} → {money((annuityAfter * pot) / 100, cur)}
            </span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>Fixed-rate savings</span>
            <strong>{money(savings, cur)} a year</strong>
            <span className={styles.hint}>on {money(d.savings, cur)}, if rates move with yields</span>
          </div>
        </div>
        <p className={styles.close}>
          A {pts(shift)} move in {d.country === "uk" ? "gilt" : "Treasury"} yields {shift >= 0 ? "makes borrowing more expensive and pays savers more" : "makes borrowing cheaper and pays savers less"}.
          Fixed mortgage rates follow the {d.mortgage.based_on}-year yield fairly closely, though lenders also add or trim
          their margins; easy-access savings follow the central bank&apos;s rate more than bond yields.
        </p>
        <p className={styles.note}>
          Rough guides, not quotes: the mortgage rate is assumed to move one-for-one with the yield, and the annuity is a level
          income at 65 priced off long-term yields. Get real quotes before deciding anything.
        </p>
      </div>
    </div>
  );
}

/** Bond market scenarios: what if yields move, past crises, holding a bond against a fund, and the
 *  knock-on to mortgages, annuities and savings. */
export default function BondScenariosCard({ data, onAsk, disabled = false }: { data: BondScenarioData; onAsk?: (q: string) => void; disabled?: boolean }) {
  const [tab, setTab] = useState<Tab>(data.focus ?? "shift");
  const [shift, setShift] = useState(data.shift ?? 1);
  const bond = data.country === "uk" ? "gilt" : "Treasury";
  return (
    <section className={styles.card} aria-label={`${data.name}: scenarios`}>
      <header className={styles.head}>
        <h3>Bond scenarios: {data.country === "uk" ? "UK gilts" : "US Treasuries"}</h3>
        <div className={styles.cardTabs} role="tablist">
          {TABS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </div>
      </header>

      {tab === "shift" && <IfYieldsMove d={data} shift={shift} setShift={setShift} />}
      {tab === "crises" && <PastCrises d={data} />}
      {tab === "hold" && <HoldOrFund d={data} shift={shift} setShift={setShift} />}
      {tab === "everyday" && <EverydayCosts d={data} shift={shift} setShift={setShift} />}

      {onAsk && (
        <AskButton
          onAsk={onAsk}
          disabled={disabled}
          label="Ask Tickerwise about this →"
          question={() =>
            `If ${bond} yields ${shift >= 0 ? "rose" : "fell"} by ${Math.abs(shift)} points, what would it mean for bond funds, mortgages and pensions?`
          }
        />
      )}

      <p className={styles.note}>
        Yields: {data.source}, {data.as_of}. Scenarios are illustrations: real bonds and funds differ in length, fees and
        credit risk, and the past doesn&apos;t predict the future. Research, not advice.
      </p>
    </section>
  );
}
