"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./retirement.module.css";
import { AskButton } from "./ask-gate";
import { Field } from "./retirement-card";
import DataChart, { type FigureData } from "./data-chart";
import { Expandable } from "./expand-dialog";
import { shortName } from "./peer-panel";
import {
  impliedRate,
  price as fmt,
  startingAssumptions,
  valuePerShare,
  type Assumptions,
  type Method,
  type Measure,
  type PeContext,
  type PeerMetrics,
  type RatingKey,
  type ValuationData,
} from "./valuation";
import { changeTone, STEPS, stepInfo, stepOf } from "./ratings";

type Tab = "priced" | "value" | "analysts" | "past" | "peers";

// Every measure has a plain label for buttons and tables, its technical name for people who know it,
// and what it means, shown wherever it's chosen.
const METRICS: { key: keyof PeerMetrics; label: string; tech: string; unit: "number" | "%"; meaning: string }[] = [
  { key: "pe", label: "Price ÷ profit", tech: "P/E", unit: "number", meaning: "what buyers pay for each 1 of a year's profit; lower means cheaper for the profit" },
  { key: "forward_pe", label: "Price ÷ next year's profit", tech: "forward P/E", unit: "number", meaning: "the same, using the profit analysts expect next year" },
  { key: "peg", label: "Growth-adjusted", tech: "PEG", unit: "number", meaning: "price ÷ profit, compared with how fast profit is growing; about 1 is in line with growth, well above 1 means paying more for each bit of growth" },
  { key: "ev_ebitda", label: "Business value ÷ profit", tech: "EV/EBITDA", unit: "number", meaning: "the price of the whole business including its debts, compared with a year's profit from its everyday operations (before interest, tax and wear and tear on equipment); fairer than price ÷ profit when companies borrow different amounts" },
  { key: "fcf_yield_pct", label: "Cash yield", tech: "free cash flow yield", unit: "%", meaning: "a year's spare cash, after running and investing in the business, as a % of what the company is worth; higher means cheaper" },
  { key: "dividend_yield_pct", label: "Dividend yield", tech: "dividend yield", unit: "%", meaning: "a year's dividends as a % of the share price" },
  { key: "price_to_sales", label: "Price ÷ sales", tech: "price/sales", unit: "number", meaning: "what buyers pay for each 1 of a year's sales; useful when a company makes a loss or very little profit" },
  { key: "price_to_book", label: "Price ÷ net assets", tech: "price/book", unit: "number", meaning: "what buyers pay compared with what the company owns minus what it owes" },
  { key: "roe_pct", label: "Profit on shareholders' money", tech: "return on equity", unit: "%", meaning: "a year's profit as a % of the money shareholders have in the business; steadily high can be a sign of a lasting advantage" },
];

// What the main slider means for each method, in plain words.
const RATE: Record<Exclude<Method, "none">, { label: string; hint: (years: number) => string; min: number; max: number; axis: string }> = {
  dcf: { label: "Cash flow growth", hint: (y) => `a year, for the next ${y} years (free cash flow: cash left after running and investing in the business)`, min: -10, max: 40, axis: "Cash flow growth" },
  bank: { label: "Return on equity", hint: () => "a year, over the long run (profit as a % of shareholders' money)", min: 0, max: 40, axis: "Return on equity" },
  dividend: { label: "Dividend growth", hint: () => "a year, for ever", min: -5, max: 15, axis: "Dividend growth" },
  sales: { label: "Sales growth", hint: (y) => `a year, for the next ${y} years`, min: -10, max: 60, axis: "Sales growth" },
};

const H_SMALL = 240;
const H_LARGE = 500;
const M = { top: 14, right: 16, bottom: 28, left: 60 };

// Round ticks (1, 2, 5 x 10^n) covering min..max, always including zero.
function ticks(min: number, max: number, count = 4) {
  const lo = Math.min(0, min);
  const hi = Math.max(0, max);
  const raw = (hi - lo) / count || 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((f) => f * mag).find((s) => s >= raw) ?? raw;
  const out = [];
  for (let v = Math.floor(lo / step) * step; v <= hi + step * 0.001; v += step) out.push(Number(v.toPrecision(12)));
  if (out[out.length - 1] < hi) out.push(out[out.length - 1] + step);
  return out;
}

/** Value per share across a range of the main rate, against today's price. */
function ValueCurve({ d, a, implied, large = false }: { d: ValuationData; a: Assumptions; implied: number | null; large?: boolean }) {
  const H = large ? H_LARGE : H_SMALL;
  const [W, setW] = useState(600);
  const [hover, setHover] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    // Measure now as well as on every resize, so a chart that first draws in a dialog has its real width.
    setW(Math.max(280, Math.round(el.getBoundingClientRect().width)));
    const observer = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const method = d.method as Exclude<Method, "none">;
  const spec = RATE[method];
  const anchors = [a.rate, ...(implied === null ? [] : [implied])];
  let lo = Math.max(spec.min, Math.floor(Math.min(spec.min + 10, ...anchors.map((r) => r - 8))));
  let hi = Math.min(spec.max + 20, Math.ceil(Math.max(spec.min + 25, ...anchors.map((r) => r + 8))));
  if (method === "dividend") hi = Math.min(hi, Math.floor(a.discount - 0.5));
  if (hi <= lo) lo = hi - 10;
  const rates = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  const value = (rate: number) => valuePerShare(d.method, d.base ?? 0, d.extra ?? 0, { ...a, rate });
  const chosen = value(a.rate);
  // Beyond about three times the price, the curve shoots up and squashes everything else.
  const cap = 3 * Math.max(d.price, chosen ?? 0);
  const values = rates.map((r) => {
    const v = value(r);
    return v === null || v > cap ? null : v;
  });
  const shown = values.filter((v): v is number => v !== null);
  if (shown.length < 2) return null;
  const yTicks = ticks(Math.min(...shown), Math.max(d.price, ...shown));
  const yLo = yTicks[0];
  const yHi = yTicks[yTicks.length - 1];
  const x = (rate: number) => M.left + ((rate - lo) / (hi - lo)) * (W - M.left - M.right);
  const y = (v: number) => M.top + (1 - (v - yLo) / (yHi - yLo || 1)) * (H - M.top - M.bottom);
  let path = "";
  let pen = false;
  values.forEach((v, i) => {
    if (v === null) {
      pen = false;
      return;
    }
    path += `${pen ? "L" : "M"}${x(rates[i]).toFixed(1)},${y(v).toFixed(1)}`;
    pen = true;
  });
  const step = hi - lo > 40 ? 10 : 5;
  const xTicks = rates.filter((r) => r % step === 0);
  const h = hover === null ? null : rates[hover];
  const hv = h === null ? null : value(h);
  const pos = h === null ? 0 : (x(h) / W) * 100;

  const indexAt = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const px = ((clientX - rect.left) / rect.width) * W;
    return Math.min(rates.length - 1, Math.max(0, Math.round(((px - M.left) / (W - M.left - M.right)) * (hi - lo))));
  };

  return (
    <div className={styles.chart} ref={boxRef}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Value per share by ${spec.axis.toLowerCase()} a year, from ${lo}% to ${hi}%, against today's price of ${fmt(d.price, d.currency)}.${implied === null ? "" : ` The two meet at ${implied}%.`} Use the arrow keys to read values.`}
        tabIndex={0}
        onPointerMove={(e) => setHover(indexAt(e.clientX))}
        onPointerLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          setHover((i) => Math.min(rates.length - 1, Math.max(0, (i ?? Math.round(a.rate - lo)) + (e.key === "ArrowLeft" ? -1 : 1))));
        }}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line className={styles.grid} x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} />
            <text className={styles.axis} x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
              {fmt(t, d.currency, true)}
            </text>
          </g>
        ))}
        {xTicks.map((r) => (
          <text key={r} className={styles.axis} x={x(r)} y={H - 8} textAnchor="middle">
            {r}%
          </text>
        ))}
        <line className={styles.target} x1={M.left} x2={W - M.right} y1={y(d.price)} y2={y(d.price)} />
        <text className={styles.targetLabel} x={M.left + 6} y={y(d.price) - 6}>
          Today&apos;s price {fmt(d.price, d.currency)}
        </text>
        <path className={styles.line} style={{ stroke: "var(--series-1)" }} d={path} />
        {implied !== null && implied >= lo && implied <= hi && (
          <>
            <line className={styles.crosshair} x1={x(implied)} x2={x(implied)} y1={y(d.price)} y2={H - M.bottom} strokeDasharray="3 3" />
            <circle className={styles.dot} cx={x(implied)} cy={y(d.price)} r={5} style={{ fill: "var(--text)" }} />
          </>
        )}
        {chosen !== null && chosen <= cap && a.rate >= lo && a.rate <= hi && (
          <circle className={styles.dot} cx={x(a.rate)} cy={y(chosen)} r={5} style={{ fill: "var(--series-2)" }} />
        )}
        {h !== null && <line className={styles.crosshair} x1={x(h)} x2={x(h)} y1={M.top} y2={H - M.bottom} />}
      </svg>
      {h !== null && hv !== null && (
        <div className={styles.tooltip} style={pos > 60 ? { right: `${100 - pos + 2}%` } : { left: `${pos + 2}%` }} role="status">
          <div className={styles.tooltipHead}>
            {spec.axis} {h}% a year
          </div>
          <div className={styles.tooltipRow}>
            <span className={styles.key} style={{ background: "var(--series-1)" }} />
            <strong>{fmt(hv, d.currency)}</strong> a share, {hv >= d.price ? "above" : "below"} today&apos;s price
          </div>
        </div>
      )}
      <ul className={styles.legend}>
        <li>
          <span className={styles.key} style={{ background: "var(--series-1)" }} />
          Value a share
        </li>
        <li>
          <span className={`${styles.key} ${styles.keyTarget}`} />
          Today&apos;s price
        </li>
        {implied !== null && (
          <li>
            <span className={styles.key} style={{ background: "var(--text)", height: 8, width: 8, borderRadius: 4 }} />
            Priced in: {implied}%
          </li>
        )}
        <li>
          <span className={styles.key} style={{ background: "var(--series-2)", height: 8, width: 8, borderRadius: 4 }} />
          Your assumption: {a.rate}%
        </li>
      </ul>
    </div>
  );
}

/** The discount rate and where its starting value comes from, in plain words. */
function DiscountField({ d, a, set }: { d: ValuationData; a: Assumptions; set: (p: Partial<Assumptions>) => void }) {
  const disc = d.discount;
  return (
    <>
      <Field
        label="Discount rate"
        hint="the yearly return investors want for the risk; a higher rate means a lower value today"
        value={a.discount}
        min={5}
        max={18}
        step={0.1}
        suffix="%"
        onChange={(v) => set({ discount: Math.max(1, Math.min(30, Math.round(v * 10) / 10)) })}
      />
      {disc && (
        <div className={styles.hint}>
          <p>
            Starts at {disc.rate}%: what people buying the shares expect to make a year on their money, from dividends and
            the share price rising. That&apos;s the {disc.bond}% a safe government bond pays, plus{" "}
            {(disc.rate - disc.bond).toFixed(1)}% extra for the risk that the shares fall.
          </p>
          <details>
            <summary>How it&apos;s worked out</summary>
            {disc.bond_name} {disc.bond}% ({disc.bond_note}) + beta {disc.beta} × {disc.premium}%. Beta measures how much this
            share&apos;s price swings compared with the whole stock market (1 = the same, {disc.beta} ={" "}
            {disc.beta > 1.05 ? "more" : disc.beta < 0.95 ? "less" : "about the same"}); {disc.premium}% is the extra return
            investors usually want for owning shares rather than government bonds (the equity risk premium).
          </details>
        </div>
      )}
    </>
  );
}

/** Sliders for the method's own assumptions. */
function AssumptionFields({ d, a, set }: { d: ValuationData; a: Assumptions; set: (p: Partial<Assumptions>) => void }) {
  const method = d.method as Exclude<Method, "none">;
  const spec = RATE[method];
  return (
    <>
      <Field
        label={spec.label}
        hint={spec.hint(a.years)}
        value={a.rate}
        min={spec.min}
        max={spec.max}
        step={0.5}
        suffix="%"
        onChange={(v) => set({ rate: Math.max(-50, Math.min(100, v)) })}
      />
      <DiscountField d={d} a={a} set={set} />
      {(method === "dcf" || method === "bank") && (
        <Field
          label={method === "bank" ? "Long-run growth" : "Growth after that"}
          hint="a year, for ever; about inflation plus a little"
          value={a.terminal}
          min={0}
          max={7}
          step={0.5}
          suffix="%"
          onChange={(v) => set({ terminal: Math.max(-2, Math.min(10, v)) })}
        />
      )}
      {method === "dcf" && (
        <Field label="Years of faster growth" value={a.years} min={3} max={20} step={1} onChange={(v) => set({ years: Math.round(Math.max(1, Math.min(30, v))) })} />
      )}
      {method === "sales" && (
        <>
          <Field label="Profit margin once mature" hint="profit as a % of sales" value={a.margin} min={1} max={40} step={1} suffix="%" onChange={(v) => set({ margin: Math.max(0, Math.min(80, v)) })} />
          <Field label="P/E then" hint="price ÷ a year's profit, once it's mature" value={a.exitPe} min={5} max={40} step={1} onChange={(v) => set({ exitPe: Math.max(1, Math.min(100, v)) })} />
        </>
      )}
    </>
  );
}

// "11p for every £1", "11 cents for every $1", "11 paise for every ₹1": a percentage as money.
const unitOf = (currency: string) => ({ GBP: "£1", USD: "$1", INR: "₹1" })[currency] ?? `1 ${currency}`;
const perUnit = (pct: number, currency: string) =>
  currency === "GBP" ? `${pct}p` : currency === "USD" ? `${pct} cents` : currency === "INR" ? `${pct} paise` : `${pct}%`;

function pricedInSentence(d: ValuationData, a: Assumptions, implied: number | null) {
  if (implied === null) return "No rate between −50% and 100% a year explains today's price at these assumptions.";
  switch (d.method) {
    case "bank":
      return `Today's price assumes the bank will make about ${perUnit(implied, d.currency)} of profit a year for every ${unitOf(d.currency)} of shareholders' money in it, over the long run (return on equity of ${implied}%). Investors want about ${perUnit(a.discount, d.currency)}, so the further profit runs above that, the more the shares are worth compared with what the bank owns.`;
    case "dividend":
      return `Today's price assumes the dividend grows about ${implied}% a year for ever.`;
    case "sales":
      return `Today's price assumes sales grow about ${implied}% a year for ${a.years} years, then earn a ${a.margin}% profit margin valued at ${a.exitPe} times profit.`;
    default:
      return `Today's price assumes free cash flow grows about ${implied}% a year for ${a.years} years, then ${a.terminal}% a year.`;
  }
}

function PricedIn({ d }: { d: ValuationData }) {
  const start = startingAssumptions(d, d.implied_pct ?? d.actual_pct ?? 5);
  const [a, setA] = useState<Assumptions>(start);
  const set = (patch: Partial<Assumptions>) => setA((s) => ({ ...s, ...patch }));
  const base = d.base ?? 0;
  const extra = d.extra ?? 0;
  const value = useMemo(() => valuePerShare(d.method, base, extra, a), [d.method, base, extra, a]);
  const implied = useMemo(() => {
    const { rate: _rate, ...rest } = a;
    void _rate;
    return impliedRate(d.method, base, extra, d.price, rest);
  }, [d.method, base, extra, d.price, a]);
  const diff = value === null ? null : Math.round((value / d.price - 1) * 100);
  const actual = d.actual_pct === null || d.actual_pct === undefined ? null : Math.round(d.actual_pct * 10) / 10;

  return (
    <div className={styles.layout}>
      <div className={styles.form}>
        <AssumptionFields d={d} a={a} set={set} />
        {implied !== null && implied !== a.rate && (
          <button className={styles.linkish} onClick={() => set({ rate: implied })}>
            Use what&apos;s priced in ({implied}%)
          </button>
        )}
      </div>

      <div className={styles.results}>
        <div className={styles.tiles}>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>Today&apos;s price</span>
            <strong>{fmt(d.price, d.currency)}</strong>
            <span className={styles.hint}>as of {d.as_of}</span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>At your assumptions</span>
            <strong>{value === null ? "–" : fmt(value, d.currency)}</strong>
            <span className={styles.hint}>
              {value === null
                ? "the discount rate must be above the growth rate"
                : diff === 0
                  ? "about today's price"
                  : `${Math.abs(diff ?? 0)}% ${(diff ?? 0) > 0 ? "above" : "below"} today's price`}
            </span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>Priced in</span>
            <strong>{implied === null ? "–" : `${implied}%`}</strong>
            <span className={styles.hint}>{RATE[d.method as Exclude<Method, "none">].label.toLowerCase()} a year needed</span>
          </div>
        </div>

        <p className={styles.close}>
          {pricedInSentence(d, a, implied)} {actual !== null && d.actual_label && `For comparison, its ${d.actual_label} was ${actual}%.`}
        </p>

        <div className={styles.chartTools}>
          <Expandable
            title="Value against assumptions"
            render={() => (
              <section className={styles.card}>
                <h3>{d.name}: value a share at your assumptions</h3>
                <ValueCurve d={d} a={a} implied={implied} large />
              </section>
            )}
          />
        </div>
        <ValueCurve d={d} a={a} implied={implied} />
      </div>
    </div>
  );
}

const STATUS = { good: { icon: "✓", word: "strong" }, ok: { icon: "~", word: "middling" }, weak: { icon: "✗", word: "weak" } };

function ValueInvesting({ d }: { d: ValuationData }) {
  const startRate = d.estimate?.rate_pct ?? d.actual_pct ?? d.implied_pct ?? 5;
  const [a, setA] = useState<Assumptions>(startingAssumptions(d, Math.round(startRate * 2) / 2));
  const [margin, setMargin] = useState(25);
  const set = (patch: Partial<Assumptions>) => setA((s) => ({ ...s, ...patch }));
  const value = useMemo(() => valuePerShare(d.method, d.base ?? 0, d.extra ?? 0, a), [d, a]);
  const buyBelow = value === null ? null : value * (1 - margin / 100);
  const gap = value === null ? null : Math.round((d.price / value - 1) * 100);
  const ey = d.earnings_yield_pct;
  const bond = d.discount?.bond;

  return (
    <>
      <ul className={styles.concepts}>
        <li>
          <strong>Intrinsic value</strong> (what a business is worth from the cash it will make in future, whatever the share
          price says today).
        </li>
        <li>
          <strong>Margin of safety</strong> (paying well below that value, so a mistake in your estimate doesn&apos;t cost you;
          Benjamin Graham, who taught Warren Buffett, made it the centre of value investing).
        </li>
        <li>
          <strong>Moat</strong> (a lasting advantage, such as a strong brand or low costs, that keeps competitors from eating
          into profits; a steady, high return on equity is one sign of it).
        </li>
      </ul>

      <div className={styles.layout}>
        <div className={styles.form}>
          {d.method !== "none" && <AssumptionFields d={d} a={a} set={set} />}
          <Field
            label="Margin of safety"
            hint="how far below your estimate you'd want the price"
            value={margin}
            min={0}
            max={50}
            step={5}
            suffix="%"
            onChange={(v) => setMargin(Math.max(0, Math.min(90, Math.round(v))))}
          />
          {d.estimate && d.actual_label && (
            <p className={styles.hint}>
              Starts from its own record: {d.actual_label}, {d.estimate.rate_pct}%. Change it to your own view.
            </p>
          )}
        </div>

        <div className={styles.results}>
          {d.method === "none" ? (
            <p className={styles.close}>{d.reason ?? "This company can't be valued from its figures."} The checklist below still applies.</p>
          ) : (
            <>
              <div className={styles.tiles}>
                <div className={styles.tile}>
                  <span className={styles.tileLabel}>Estimated value</span>
                  <strong>{value === null ? "–" : fmt(value, d.currency)}</strong>
                  <span className={styles.hint}>a share, at these assumptions (intrinsic value)</span>
                </div>
                <div className={styles.tile}>
                  <span className={styles.tileLabel}>With a {margin}% margin of safety</span>
                  <strong>{buyBelow === null ? "–" : fmt(buyBelow, d.currency)}</strong>
                  <span className={styles.hint}>or less</span>
                </div>
                <div className={styles.tile}>
                  <span className={styles.tileLabel}>Today&apos;s price</span>
                  <strong>{fmt(d.price, d.currency)}</strong>
                  <span className={styles.hint}>
                    {gap === null ? "" : gap === 0 ? "about the estimate" : `${Math.abs(gap)}% ${gap > 0 ? "above" : "below"} the estimate`}
                  </span>
                </div>
              </div>
              <p className={styles.close}>
                {value === null
                  ? "These assumptions don't give a value: the discount rate must be above the growth rate."
                  : buyBelow !== null && d.price <= buyBelow
                    ? `At these assumptions, today's price is inside a ${margin}% margin of safety.`
                    : `At these assumptions, the price would need to be ${fmt(buyBelow ?? 0, d.currency)} or less for a ${margin}% margin of safety.`}{" "}
                The estimate is only as good as the assumptions: small changes move it a lot.
              </p>
            </>
          )}

          {ey != null && bond != null && (
            <p className={styles.close}>
              <strong>Earnings yield</strong> (a year&apos;s profit as a % of the price, the P/E turned upside down): {ey}%, against
              the {d.discount?.bond_name} of {bond}%.{" "}
              {ey < bond
                ? "The share earns less on its price today than a government bond pays, so investors are counting on profits growing."
                : "The share earns more on its price today than a government bond pays, which leaves some room if growth disappoints."}
            </p>
          )}

          {d.quality && d.quality.length > 0 && (
            <table className={styles.table}>
              <caption>Quality checklist (what value investors look for)</caption>
              <tbody>
                {d.quality.map((q) => (
                  <tr key={q.key}>
                    <th scope="row">
                      <span className={`${styles.qualityIcon} ${styles[`quality_${q.status}`]}`} aria-label={STATUS[q.status].word}>
                        {STATUS[q.status].icon}
                      </span>{" "}
                      {q.label}
                    </th>
                    <td className={styles.qualityCell}>
                      <strong>{q.value}</strong>
                      <span className={styles.hint}>{q.meaning}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

// "Buy (3.9 out of 5)": the analysts' average view, from 1 (strong sell) to 5 (strong buy).
function averageScore(r: Record<RatingKey, number> | null | undefined) {
  if (!r) return null;
  const total = STEPS.reduce((n, s) => n + r[s.key], 0);
  return total ? STEPS.reduce((n, s) => n + r[s.key] * s.score, 0) / total : null;
}
const scoreLabel = (score: number) =>
  score >= 4.5 ? "Strong buy" : score >= 3.5 ? "Buy" : score >= 2.5 ? "Hold" : score >= 1.5 ? "Sell" : "Strong sell";

/** A red-to-green slider from strong sell to strong buy, with the average view now and a month ago. */
function ConsensusGauge({ now, before }: { now: number; before: number | null }) {
  const at = (score: number) => `${((score - 1) / 4) * 100}%`;
  return (
    <div className={styles.gauge} role="img" aria-label={`Average view: ${scoreLabel(now)}, ${now.toFixed(2)} out of 5${before !== null ? `; a month ago ${before.toFixed(2)}` : ""}.`}>
      <div className={styles.gaugeBar} style={{ background: `linear-gradient(to right, ${[...STEPS].reverse().map((s) => s.color).join(", ")})` }}>
        {before !== null && Math.abs(before - now) >= 0.05 && <span className={styles.gaugeGhost} style={{ left: at(before) }} title={`A month ago: ${before.toFixed(1)}`} />}
        <span className={styles.gaugeMarker} style={{ left: at(now) }}>
          <span>
            {scoreLabel(now)} · {now.toFixed(2)}
          </span>
        </span>
      </div>
      <div className={styles.gaugeScale}>
        {[...STEPS].reverse().map((s) => (
          <span key={s.key}>{s.label}</span>
        ))}
      </div>
    </div>
  );
}

/** One coloured column per rating, with last month's count as a faint outline behind it. */
function RatingColumns({ now, before }: { now: Record<RatingKey, number>; before: Record<RatingKey, number> | null | undefined }) {
  const max = Math.max(1, ...STEPS.map((s) => Math.max(now[s.key], before?.[s.key] ?? 0)));
  return (
    <div className={styles.ratingCols} role="img" aria-label={STEPS.map((s) => `${s.label}: ${now[s.key]}${before ? ` (a month ago ${before[s.key]})` : ""}`).join("; ")}>
      {STEPS.map((s) => (
        <div key={s.key} className={styles.ratingCol}>
          <div className={styles.ratingTrack}>
            {before && <span className={styles.ratingGhost} style={{ height: `${(before[s.key] / max) * 100}%` }} />}
            <span className={styles.ratingBar} style={{ height: `${(now[s.key] / max) * 100}%`, background: s.color }} />
            {/* The count sits above whichever is taller, this month's bar or last month's outline. */}
            <span className={styles.ratingCount} style={{ bottom: `calc(${(Math.max(now[s.key], before?.[s.key] ?? 0) / max) * 100}% + 2px)` }}>
              {now[s.key]}
            </span>
          </div>
          <span className={styles.ratingLabel}>{s.label}</span>
          {before && (() => {
            const delta = now[s.key] - before[s.key];
            const tone = changeTone(s.key, delta);
            return (
              <span
                className={`${styles.ratingDelta} ${styles[`rating_${tone}`]}`}
                title={delta ? `${Math.abs(delta)} ${delta > 0 ? "more" : "fewer"} than a month ago` : "Same as a month ago"}
              >
                {delta > 0 ? `▲ ${delta}` : delta < 0 ? `▼ ${-delta}` : "–"}
              </span>
            );
          })()}
        </div>
      ))}
    </div>
  );
}

/** The range of price targets on a slider, with labelled low, median and high, and today's price. */
function TargetSlider({ d, t }: { d: ValuationData; t: NonNullable<NonNullable<ValuationData["analysts"]>["targets"]> }) {
  const low = t.low ?? d.price;
  const high = t.high ?? d.price;
  const median = t.median ?? t.mean ?? d.price;
  const lo = Math.min(low, d.price);
  const hi = Math.max(high, d.price);
  const at = (v: number) => `${((v - lo) / (hi - lo || 1)) * 100}%`;
  const up = median >= d.price;
  return (
    <div className={styles.targetSlider} role="img" aria-label={`Price targets from ${fmt(low, d.currency)} to ${fmt(high, d.currency)}, median ${fmt(median, d.currency)}; today's price ${fmt(d.price, d.currency)}.`}>
      <div className={styles.targetLabelsTop}>
        <span style={{ left: at(low) }}>Low {fmt(low, d.currency)}</span>
        <span style={{ left: at(median) }} className={up ? styles.targetUp : styles.targetDown}>
          Median {fmt(median, d.currency)}
        </span>
        <span style={{ left: at(high) }}>High {fmt(high, d.currency)}</span>
      </div>
      <div className={styles.targetTrack}>
        <span className={styles.targetSpan} style={{ left: at(low), right: `calc(100% - ${at(high)})` }} />
        <span className={styles.targetTick} style={{ left: at(low) }} />
        <span className={styles.targetTick} style={{ left: at(high) }} />
        <span className={styles.targetMid} style={{ left: at(median), background: up ? "var(--up)" : "var(--error)" }} />
        <span className={styles.targetToday} style={{ left: at(d.price) }} />
      </div>
      <div className={styles.targetLabelsBottom}>
        <span style={{ left: at(d.price) }}>Today {fmt(d.price, d.currency)}</span>
      </div>
    </div>
  );
}

function RatingPill({ rating }: { rating: string | null }) {
  if (!rating) return null;
  const step = stepOf(rating);
  const info = step ? stepInfo(step) : null;
  return (
    <span className={styles.pill} style={info ? { background: info.color } : undefined} title={info ? `${info.label}-type rating` : undefined}>
      {rating}
    </span>
  );
}

/** Each company's analyst views side by side: a bar from strong buy to strong sell, the average
 *  view, and how far the median 12-month target is above or below today's price. */
function PeerAnalystsChart({ d }: { d: ValuationData }) {
  const rows = [
    { symbol: d.symbol, name: d.name, ratings: d.analysts?.ratings, label: d.analysts?.average_label, gap: d.analysts?.median_vs_price_pct, main: true },
    ...(d.peer_analysts ?? []).map((p) => ({ symbol: p.symbol, name: p.name, ratings: p.ratings, label: p.average_label, gap: p.median_vs_price_pct, main: false })),
  ].filter((r) => r.ratings);
  return (
    <div className={styles.analystBlock}>
      <h4>Compared with peers</h4>
      <div className={styles.peerAnalysts}>
        {rows.map((r) => {
          const total = STEPS.reduce((n, s) => n + r.ratings![s.key], 0) || 1;
          return (
            <div key={r.symbol} className={`${styles.peerAnalystRow} ${r.main ? styles.peerAnalystMain : ""}`}>
              <span className={styles.peerAnalystName} title={r.name}>
                {r.name}
                <span className={styles.hint}>
                  {total} analyst{total === 1 ? "" : "s"}
                  {r.label ? ` · on average, ${r.label}` : ""}
                </span>
              </span>
              <span className={styles.peerAnalystBar} role="img" aria-label={STEPS.map((s) => `${s.label} ${r.ratings![s.key]}`).join(", ")}>
                {STEPS.map((s) =>
                  r.ratings![s.key] ? (
                    <span key={s.key} style={{ flexGrow: r.ratings![s.key], background: s.color }} title={`${s.label}: ${r.ratings![s.key]}`}>
                      {r.ratings![s.key] / total >= 0.12 ? r.ratings![s.key] : ""}
                    </span>
                  ) : null
                )}
              </span>
              <span className={r.gap == null ? styles.hint : r.gap >= 0 ? styles.targetUp : styles.targetDown}>
                {r.gap == null ? "no targets" : `${r.gap >= 0 ? "▲" : "▼"} ${Math.abs(r.gap)}%`}
              </span>
            </div>
          );
        })}
      </div>
      <p className={styles.hint}>
        Bars run from strong buy (dark green) to strong sell (red). The right-hand figure is how far the median 12-month target is
        above or below each share&apos;s price today.
      </p>
    </div>
  );
}

/** What analysts at banks and brokers say, as pictures: their average view on a red-to-green
 *  slider, how many give each rating (against last month), where their price targets sit against
 *  today's price, and recent changes by firm. Their views, not Tickerwise's. */
/** Analysts' views at a glance, on every other tab: the ratings as one coloured bar, the median target
 *  against today's price, and a way into the full view. */
function AnalystStrip({ d, onOpen }: { d: ValuationData; onOpen: () => void }) {
  const a = d.analysts;
  const r = a?.ratings;
  const total = r ? STEPS.reduce((n, s) => n + r[s.key], 0) : 0;
  if (!a || !r || total === 0) return null;
  const buy = r.strongBuy + r.buy;
  const sell = r.sell + r.strongSell;
  const median = a.targets?.median ?? a.targets?.mean ?? null;
  const gap = median === null ? null : Math.round((median / d.price - 1) * 100);
  return (
    <div className={styles.analystStrip}>
      <span className={styles.stripLabel}>Analysts</span>
      <span
        className={styles.stripBar}
        role="img"
        aria-label={STEPS.map((s) => `${s.label}: ${r[s.key]}`).join(", ")}
        title={STEPS.filter((s) => r[s.key]).map((s) => `${s.label} ${r[s.key]}`).join(" · ")}
      >
        {STEPS.filter((s) => r[s.key]).map((s) => (
          <span key={s.key} style={{ width: `${(r[s.key] / total) * 100}%`, background: s.color }} />
        ))}
      </span>
      <span className={styles.stripText}>
        {buy} buy · {r.hold} hold · {sell} sell
        {a.shift && a.shift !== "unchanged" && (
          <span className={a.shift.startsWith("more") ? styles.stripUp : styles.stripDown}>
            {" "}
            ({a.shift.startsWith("more") ? "▲" : "▼"} {a.shift.includes("slightly") ? "slightly " : ""}
            {a.shift.startsWith("more") ? "more" : "less"} positive than last month)
          </span>
        )}
        {median !== null && gap !== null && (
          <>
            {" "}
            · middle target {fmt(median, d.currency)}{" "}
            <span className={gap >= 0 ? styles.stripUp : styles.stripDown}>
              ({gap >= 0 ? "▲" : "▼"} {Math.abs(gap)}% vs today)
            </span>
          </>
        )}
      </span>
      <button className={styles.stripLink} onClick={onOpen}>
        See what analysts say →
      </button>
    </div>
  );
}

function AnalystViews({ d }: { d: ValuationData }) {
  const a = d.analysts!;
  const total = a.ratings ? STEPS.reduce((n, s) => n + a.ratings![s.key], 0) : 0;
  const now = averageScore(a.ratings);
  const before = averageScore(a.ratings_month_ago);
  const t = a.targets;
  const median = t?.median ?? t?.mean ?? null;
  const gap = median === null ? null : Math.round((median / d.price - 1) * 100);

  return (
    <>
      <p className={styles.methodNote}>
        Opinions of analysts at banks and brokers (people paid to research companies), not Tickerwise&apos;s view. Analysts lean
        towards &ldquo;buy&rdquo;, their targets are often wrong, and some work for firms that do business with the companies they
        cover.
      </p>

      {a.ratings && total > 0 && now !== null && (
        <div className={styles.analystBlock}>
          <h4>
            {total} analyst{total === 1 ? "" : "s"}: on average, {scoreLabel(now).toLowerCase()}
            {a.shift && a.shift !== "unchanged" && (
              <span className={a.shift.startsWith("more") ? styles.targetUp : styles.targetDown}>
                {" "}
                · {a.shift.includes("slightly") ? "slightly " : ""}
                {a.shift.startsWith("more") ? "more" : "less"} positive than a month ago
              </span>
            )}
            {a.shift === "unchanged" && <span className={styles.hint}> · about the same as a month ago</span>}
          </h4>
          <ConsensusGauge now={now} before={before} />
          <RatingColumns now={a.ratings} before={a.ratings_month_ago} />
          {a.ratings_month_ago && (
            <p className={styles.hint}>
              Faint outlines and the arrows show the change since last month: green when it makes the overall view more positive
              (more buys, fewer sells), red when less.
            </p>
          )}
        </div>
      )}

      {t && median !== null && (
        <div className={styles.analystBlock}>
          <h4>
            Price targets in 12 months:{" "}
            <span className={(gap ?? 0) >= 0 ? styles.targetUp : styles.targetDown}>
              median {(gap ?? 0) >= 0 ? "▲" : "▼"} {Math.abs(gap ?? 0)}% {(gap ?? 0) >= 0 ? "above" : "below"} today
            </span>
          </h4>
          <TargetSlider d={d} t={t} />
          <p className={styles.hint}>Where each analyst expects the share price to be in about a year. The wider the bar, the less they agree.</p>
        </div>
      )}

      {d.peer_analysts && d.peer_analysts.length > 0 && <PeerAnalystsChart d={d} />}

      {a.changes && a.changes.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className={styles.table}>
            <caption>Recent changes by firm</caption>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: "left" }}>
                  Date
                </th>
                <th scope="col" style={{ textAlign: "left" }}>
                  Firm
                </th>
                <th scope="col" style={{ textAlign: "left" }}>
                  Rating
                </th>
                <th scope="col">Target</th>
              </tr>
            </thead>
            <tbody>
              {a.changes.map((c, i) => {
                const raised = c.target && c.prior_target && c.target > c.prior_target;
                const lowered = c.target && c.prior_target && c.target < c.prior_target;
                const moved = c.from_rating && c.rating && c.from_rating !== c.rating;
                return (
                  <tr key={i}>
                    <th scope="row">{c.date}</th>
                    <td className={styles.qualityCell}>
                      <strong>{c.firm}</strong>
                      <span className={styles.hint}>{c.action}</span>
                    </td>
                    <td className={styles.qualityCell}>
                      {moved && (
                        <>
                          <RatingPill rating={c.from_rating} /> →{" "}
                        </>
                      )}
                      <RatingPill rating={c.rating} />
                    </td>
                    <td className={styles.targetCell}>
                      {c.target ? (
                        <span className={raised ? styles.targetUp : lowered ? styles.targetDown : undefined}>
                          {raised ? "▲ " : lowered ? "▼ " : ""}
                          {fmt(c.target, d.currency)}
                        </span>
                      ) : (
                        "–"
                      )}
                      {(raised || lowered) && c.prior_target && <span className={styles.hint}>from {fmt(c.prior_target, d.currency)}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className={styles.note}>
        Source:{" "}
        <a href={a.url} target="_blank" rel="noopener noreferrer">
          Yahoo Finance analyst ratings for {d.symbol}
        </a>
        , {d.as_of}. Each firm&apos;s own wording (such as Overweight or Outperform) is coloured as the nearest of buy, hold
        or sell. Named rating changes are mostly available for US shares.
      </p>
    </>
  );
}

function Peers({ d }: { d: ValuationData }) {
  const available = METRICS.filter((m) => d.peers.filter((p) => p[m.key] !== null && p[m.key] !== undefined).length >= 2);
  const [key, setKey] = useState(available[0]?.key);
  const metric = available.find((m) => m.key === key) ?? available[0];
  if (!metric) return <p className={styles.close}>Not enough figures are available to compare these companies.</p>;
  const fig: FigureData = {
    kind: "bar",
    title: metric.label,
    unit: metric.unit,
    labels: d.peers.map((p) => p.name),
    series: [{ name: metric.label, values: d.peers.map((p) => (p[metric.key] as number | null) ?? null) }],
    note: `${metric.label} (${metric.tech}): ${metric.meaning}. A dash means it isn't meaningful (a loss, or debts bigger than assets) or isn't available. Yahoo Finance, ${d.as_of}.`,
  };
  const show = (v: number | null | undefined, unit: string) => (v === null || v === undefined ? "–" : unit === "%" ? `${v.toFixed(1)}%` : v.toFixed(1));

  return (
    <>
      <div className={styles.segmented} role="group" aria-label="Measure" style={{ flexWrap: "wrap" }}>
        {available.map((m) => (
          <button key={m.key} aria-pressed={m.key === metric.key} onClick={() => setKey(m.key)}>
            {m.label}
          </button>
        ))}
      </div>
      <p className={styles.close}>
        <strong>{metric.label}</strong> ({metric.tech}): {metric.meaning}.
      </p>
      <DataChart fig={fig} bare />
      <div style={{ overflowX: "auto" }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" />
              {d.peers.map((p) => (
                <th key={p.symbol} scope="col">
                  {p.symbol}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {available.map((m) => (
              <tr key={m.key} className={m.key === metric.key ? styles.net : undefined}>
                <th scope="row">{m.label}</th>
                {d.peers.map((p) => (
                  <td key={p.symbol}>{show(p[m.key] as number | null, m.unit)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// Each yardstick in plain words: what the price is compared with, and its technical name.
const MEASURE: Record<Exclude<Measure, "none">, { label: string; per: string; of: string; tech: string }> = {
  pe: { label: "Price ÷ profit", per: "of profit", of: "yearly profit", tech: "P/E" },
  pb: { label: "Price ÷ net assets", per: "of net assets", of: "net assets (what it owns minus what it owes)", tech: "price/book" },
  ps: { label: "Price ÷ sales", per: "of sales", of: "yearly sales", tech: "price/sales" },
};

// "More" or "less" only when the gap is worth mentioning.
function compare(v: number, other: number) {
  return v > other * 1.1 ? "more than" : v < other * 0.9 ? "less than" : "about the same as";
}

/** The company's yardstick as bars beside its own usual, its competitors and its home market, in money terms. */
function PeLadder({ d, c }: { d: ValuationData; c: PeContext }) {
  const measure = c.measure ?? "pe";
  if (measure === "none" || c.company === undefined) return c.caution ? <p className={styles.close}>{c.caution}</p> : null;
  const m = MEASURE[measure];
  const name = shortName(d.name);
  const one = fmt(1, d.currency, true);
  // Whole units for bigger figures; pence or cents matter below 10 (a price ÷ net assets of 0.74).
  const money = (v: number) => (v < 10 ? fmt(v, d.currency) : fmt(v, d.currency, true));
  const market = c.market && { name: c.market.name, value: (c.market.value ?? c.market.pe)! };
  const peers = (c.peers ?? []).map((p) => shortName(p.name));
  const rows = [
    { label: name, sub: "now", value: c.company, main: true },
    ...(c.extra ?? []).map((e) => ({ label: e.label, sub: e.sub, value: e.value, main: true })),
    c.own_usual != null && { label: "Its own usual", sub: c.own_since ? `middle value since ${c.own_since}` : "middle value", value: c.own_usual, main: false },
    c.peers_median != null && { label: "Its competitors", sub: peers.join(", "), value: c.peers_median, main: false },
    market && { label: `${market.name} as a whole`, sub: "its home stock market", value: market.value, main: false },
  ].filter(Boolean) as { label: string; sub: string; value: number; main: boolean }[];
  const top = Math.max(...rows.map((r) => r.value)) * 1.08;

  const parts = [
    c.own_usual != null && `${compare(c.company, c.own_usual)} its own usual (${money(c.own_usual)})`,
    c.peers_median != null && `${compare(c.company, c.peers_median)} its competitors (${money(c.peers_median)})`,
    market && `${compare(c.company, market.value)} the ${market.name} as a whole (${money(market.value)})`,
  ].filter(Boolean) as string[];
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
  const home = { GBP: "FTSE 100", INR: "Nifty 50", USD: "S&P 500" }[d.currency];

  return (
    <>
      <p className={styles.close}>
        Buyers pay <strong>{money(c.company)}</strong> for each {one} of {name}&apos;s {m.of} ({m.tech}){list ? `: ${list}.` : "."}
      </p>
      {c.caution && <p className={styles.methodNote}>{c.caution}</p>}
      <div className={styles.ladder} role="list" aria-label={`${m.label} in context`}>
        {rows.map((r) => (
          <div key={r.label} role="listitem" className={r.main ? styles.ladderMain : undefined}>
            <span className={styles.ladderLabel}>
              {r.label}
              <small>{r.sub}</small>
            </span>
            <span className={styles.ladderTrack}>
              <span className={styles.ladderBar} style={{ width: `${(r.value / top) * 100}%` }} />
            </span>
            <span className={styles.ladderValue}>
              {money(r.value)} <small>per {one}</small>
            </span>
          </div>
        ))}
      </div>
      <p className={styles.close}>
        {!market && home && measure !== "pe" && `There's no reliable figure for the ${home} as a whole on this measure, so it's compared with its own past and its competitors. `}
        Paying more isn&apos;t automatically worse, or less automatically better. Buyers pay more when they expect profits to
        grow faster, or to be steadier, or the company owes less; sometimes it&apos;s just optimism. Normal levels also differ by
        industry: banks usually sit lower than software companies.
        {measure === "pe" && " The growth-adjusted figure (PEG, under “Against peers”) weighs the price against how fast profit is growing."}
      </p>
    </>
  );
}

function Past({ d }: { d: ValuationData }) {
  const h = d.pe_history;
  if (!h) return d.pe_context ? <PeLadder d={d} c={d.pe_context} /> : null;
  const m = MEASURE[h.measure && h.measure !== "none" ? h.measure : "pe"];
  const market = d.pe_context?.market;
  const marketValue = market && (market.value ?? market.pe);
  const now = h.pe[h.pe.length - 1];
  const fig: FigureData = {
    kind: "line",
    title: `${shortName(d.name)}: ${m.label.toLowerCase()} over time`,
    unit: "number",
    labels: h.dates,
    series: [
      { name: m.tech, values: h.pe },
      { name: `Median ${h.median}`, values: h.pe.map(() => h.median) },
      ...(market && marketValue ? [{ name: `${market.name} now ${marketValue}`, values: h.pe.map(() => marketValue) }] : []),
    ],
    note: `${m.label} (${m.tech}), month by month from ${h.dates[0]}, using each year's figures once published; "Now" uses the latest. Gaps are years with a loss. Yahoo Finance.`,
  };
  return (
    <>
      {d.pe_context && <PeLadder d={d} c={d.pe_context} />}
      <h4 className={styles.subhead}>Over time</h4>
      <p className={styles.close}>
        {now === null
          ? `Over this period ${m.label.toLowerCase()} (${m.tech}) ranged from ${h.low} to ${h.high}, with a median of ${h.median}.`
          : `${m.label} (${m.tech}) is ${now} now, against a range of ${h.low} to ${h.high} and a median (middle value) of ${h.median} since ${h.dates[0]}: ${
              now > h.median * 1.1 ? "higher than usual" : now < h.median * 0.9 ? "lower than usual" : "close to usual"
            } for this company. It can change because the price moved or because the company's figures did.`}
      </p>
      <DataChart fig={fig} bare />
    </>
  );
}

/** A share's valuation: what the price assumes, a value investor's view, its price in context,
 *  and its multiples against peers. */
export default function ValuationCard({ data, onAsk, disabled = false }: { data: ValuationData; onAsk?: (q: string) => void; disabled?: boolean }) {
  const tabs = (
    [
      ["priced", "What's priced in"],
      ["value", "Value investing"],
      ["analysts", "What analysts say"],
      ["past", "Price in context"],
      ["peers", "Against peers"],
    ] as [Tab, string][]
  ).filter(([k]) => (k === "past" ? data.pe_history || data.pe_context : k === "peers" ? data.peers.length > 1 : k === "analysts" ? data.analysts : true));
  const [tab, setTab] = useState<Tab>(() => (data.view && tabs.some(([k]) => k === data.view) ? data.view : "priced"));

  return (
    <section className={styles.card} aria-label={`Valuation of ${data.name}`}>
      <header className={styles.head}>
        <h3>Valuation: {data.name}</h3>
        <div className={styles.cardTabs} role="tablist">
          {tabs.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </div>
      </header>

      {tab !== "analysts" && tabs.some(([k]) => k === "analysts") && <AnalystStrip d={data} onOpen={() => setTab("analysts")} />}

      {data.why && (
        <p className={styles.methodNote}>
          <strong>How this company is valued:</strong> {data.why}
        </p>
      )}

      {tab === "priced" &&
        (data.method === "none" ? (
          <p className={styles.close}>{data.reason ?? "This company can't be valued from its figures."} The other tabs still compare it.</p>
        ) : (
          <PricedIn d={data} />
        ))}
      {tab === "value" && <ValueInvesting d={data} />}
      {tab === "analysts" && data.analysts && <AnalystViews d={data} />}
      {tab === "past" && data.pe_history && <Past d={data} />}
      {tab === "peers" && <Peers d={data} />}

      {onAsk && (
        <AskButton
          onAsk={onAsk}
          disabled={disabled}
          label="Ask Tickerwise about this →"
          question={() =>
            `What would ${data.name} need to deliver to justify its share price, and how would a value investor look at it?`
          }
        />
      )}

      <p className={styles.note}>
        Small changes to the assumptions move the value a lot, which is the point: it shows what the price takes for granted,
        and what you&apos;d have to believe. The estimate is an illustration from the company&apos;s own record, not a forecast
        or a target. Data from Yahoo Finance, {data.as_of}. Research, not advice.
      </p>
    </section>
  );
}
