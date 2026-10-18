"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./retirement.module.css";
import { AskButton } from "./ask-gate";
import { Expandable } from "./expand-dialog";
import { CHECKED, COUNTRIES, POT_TYPES, defaultsFor, money, plan, type Country, type PlanInput, type Plan } from "./retirement";

const COUNTRY_LABELS: Record<Country, string> = { uk: "UK", in: "India", us: "US" };
const SCENARIOS = [
  { key: "cautious", label: "Cautious" },
  { key: "middle", label: "Middle" },
  { key: "hopeful", label: "Hopeful" },
] as const;

const GUIDANCE: Record<Country, React.ReactNode> = {
  uk: (
    <>
      Free, impartial help: <a href="https://www.moneyhelper.org.uk/en/pensions-and-retirement/pension-wise" target="_blank" rel="noreferrer">Pension Wise</a> (50 and over) and{" "}
      <a href="https://www.gov.uk/check-state-pension" target="_blank" rel="noreferrer">check your State Pension forecast</a>.
    </>
  ),
  in: (
    <>
      For personal advice, a <a href="https://www.sebi.gov.in/sebiweb/other/OtherAction.do?doRecognisedFpi=yes&intmId=13" target="_blank" rel="noreferrer">SEBI-registered investment adviser</a>. NPS rules: <a href="https://www.pfrda.org.in" target="_blank" rel="noreferrer">PFRDA</a>.
    </>
  ),
  us: (
    <>
      Your Social Security estimate: <a href="https://www.ssa.gov/myaccount/" target="_blank" rel="noreferrer">my Social Security</a>. For personal advice, a fee-only fiduciary adviser.
    </>
  ),
};

const PENSION_STARTS: Record<Country, string> = { uk: "the State Pension", in: "your pension", us: "Social Security" };

const NOTES: Record<Country, string> = {
  uk: "Tax: 2026/27 bands, 25% of a pension tax-free, rent at the property rates from April 2027 (2 points higher). Ignores Scottish rates.",
  in: "Tax: FY 2026-27 new regime with the ₹75,000 standard deduction on pension and 4% cess; rent taxed after a flat 30% deduction; equity fund gains at 12.5% above ₹1.25 lakh a year. NPS annuities are fixed, so their real value falls.",
  us: "Tax: 2026 federal, single filer, up to 85% of Social Security taxed, rent as ordinary income. No state tax.",
};

const RENT_HINTS: Record<Country, string> = {
  uk: "from property you'll own, after costs, before tax",
  in: "from property you'll own, after property tax",
  us: "from property you'll own, after costs, before tax",
};

/** A number with a slider beside it; the slider's range only bounds dragging, not typing. */
export function Field({
  label,
  value,
  onChange,
  min,
  max,
  step,
  prefix,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
  hint?: string;
}) {
  const id = React.useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id}>
        {label}
        {hint && <span className={styles.hint}>{hint}</span>}
      </label>
      <div className={styles.inputs}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={Math.min(max, Math.max(min, value))}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
        />
        <span className={styles.number}>
          {prefix && <span>{prefix}</span>}
          <input
            id={id}
            type="number"
            inputMode="decimal"
            min={0}
            step={step}
            value={Number.isFinite(value) ? value : ""}
            onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          />
          {suffix && <span>{suffix}</span>}
        </span>
      </div>
    </div>
  );
}

const H_SMALL = 240;
const H_LARGE = 500;
const M = { top: 14, right: 16, bottom: 28, left: 56 };

function ticks(max: number, count = 4) {
  const raw = max / count || 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((f) => f * mag).find((s) => s >= raw) ?? raw;
  const out = [];
  for (let v = 0; v <= max + step * 0.001; v += step) out.push(v);
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + step);
  return out;
}

function Chart({ p, large = false }: { p: Plan; large?: boolean }) {
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

  const { ages } = p;
  const n = ages.length;
  if (n < 2) return null;
  const yTicks = ticks(Math.max(p.target, ...p.projections.hopeful));
  const yMax = yTicks[yTicks.length - 1];
  const x = (i: number) => M.left + (i / (n - 1)) * (W - M.left - M.right);
  const y = (v: number) => M.top + (1 - v / yMax) * (H - M.top - M.bottom);
  const path = (values: number[]) => values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const every = n > 30 ? 10 : 5;
  const xTicks = ages.map((a, i) => ({ a, i })).filter(({ a, i }) => a % every === 0 || i === n - 1);
  const i = hover ?? n - 1;
  const pos = (x(i) / W) * 100;

  const indexAt = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const px = ((clientX - rect.left) / rect.width) * W;
    return Math.min(n - 1, Math.max(0, Math.round(((px - M.left) / (W - M.left - M.right)) * (n - 1))));
  };

  return (
    <div className={styles.chart} ref={boxRef}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Pot by age, in today's money. At ${p.retireAge}: cautious ${money(p.projections.cautious[n - 1], p.currency)}, middle ${money(p.projections.middle[n - 1], p.currency)}, hopeful ${money(p.projections.hopeful[n - 1], p.currency)}; target ${money(p.target, p.currency)}.`}
        tabIndex={0}
        onPointerMove={(e) => setHover(indexAt(e.clientX))}
        onPointerLeave={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          setHover((h) => Math.min(n - 1, Math.max(0, (h ?? n - 1) + (e.key === "ArrowLeft" ? -1 : 1))));
        }}
        onBlur={() => setHover(null)}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line className={styles.grid} x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} />
            <text className={styles.axis} x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
              {money(t, p.currency, true)}
            </text>
          </g>
        ))}
        {xTicks.map(({ a, i: k }) => (
          <text key={a} className={styles.axis} x={x(k)} y={H - 8} textAnchor="middle">
            {a}
          </text>
        ))}
        {p.target > 0 && (
          <>
            <line className={styles.target} x1={M.left} x2={W - M.right} y1={y(p.target)} y2={y(p.target)} />
            <text className={styles.targetLabel} x={M.left + 6} y={y(p.target) - 6}>
              Target {money(p.target, p.currency, true)}
            </text>
          </>
        )}
        {SCENARIOS.map((s, k) => (
          <path key={s.key} className={styles.line} style={{ stroke: `var(--series-${k + 1})` }} d={path(p.projections[s.key])} />
        ))}
        {hover !== null && <line className={styles.crosshair} x1={x(i)} x2={x(i)} y1={M.top} y2={H - M.bottom} />}
        {SCENARIOS.map((s, k) => (
          <circle key={s.key} className={styles.dot} cx={x(i)} cy={y(p.projections[s.key][i])} r={4} style={{ fill: `var(--series-${k + 1})` }} />
        ))}
      </svg>
      {hover !== null && (
        <div className={styles.tooltip} style={pos > 60 ? { right: `${100 - pos + 2}%` } : { left: `${pos + 2}%` }} role="status">
          <div className={styles.tooltipHead}>Age {ages[i]}</div>
          {[...SCENARIOS].reverse().map((s) => (
            <div key={s.key} className={styles.tooltipRow}>
              <span className={styles.key} style={{ background: `var(--series-${SCENARIOS.indexOf(s) + 1})` }} />
              <strong>{money(p.projections[s.key][i], p.currency)}</strong> {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChartLegend({ p }: { p: Plan }) {
  return (
    <ul className={styles.legend}>
      {SCENARIOS.map((s, k) => (
        <li key={s.key}>
          <span className={styles.key} style={{ background: `var(--series-${k + 1})` }} />
          {s.label} <span className={styles.hint}>{p.growth[k]}% a year</span>
        </li>
      ))}
      <li>
        <span className={`${styles.key} ${styles.keyTarget}`} />
        Target
      </li>
    </ul>
  );
}

/** Target pot, projected pot at three growth rates, the gap, and monthly take-home after tax. */
export default function RetirementCard({
  initial,
  onAsk,
  disabled = false,
}: {
  initial: PlanInput;
  onAsk?: (question: string) => void;
  disabled?: boolean;
}) {
  const [inp, setInp] = useState<PlanInput>(initial);
  const p = useMemo(() => plan(inp), [inp]);
  const c = COUNTRIES[inp.country];
  const cur = p.currency;
  const sym = { GBP: "£", USD: "$", INR: "₹" }[cur];
  const set = (patch: Partial<PlanInput>) => setInp((s) => ({ ...s, ...patch }));
  const big = cur === "INR" ? 100 : 1; // rupee amounts are roughly 100 times bigger
  const years = p.retireAge - inp.age;

  // Amounts don't convert sensibly between countries, so a switch starts from that country's example.
  const switchCountry = (country: Country) => {
    if (country !== inp.country) setInp({ ...defaultsFor(country, ""), age: inp.age, retire_age: Math.max(inp.age + 1, defaultsFor(country, "").retire_age) });
  };

  const onTrack = p.gap <= 0;
  const range = `${money(p.projections.cautious[years], cur)} to ${money(p.projections.hopeful[years], cur)}`;

  return (
    <section className={styles.card} aria-label="Retirement planner">
      <header className={styles.head}>
        <h3>Retirement planner</h3>
        <div className={styles.segmented} role="group" aria-label="Country">
          {(Object.keys(COUNTRY_LABELS) as Country[]).map((k) => (
            <button key={k} aria-pressed={inp.country === k} onClick={() => switchCountry(k)}>
              {COUNTRY_LABELS[k]}
            </button>
          ))}
        </div>
      </header>

      <div className={styles.layout}>
        <div className={styles.form}>
          <Field label="Your age" value={inp.age} min={18} max={75} step={1} onChange={(v) => set({ age: Math.min(80, Math.max(18, v)) })} />
          <Field label="Retire at" value={inp.retire_age} min={40} max={80} step={1} onChange={(v) => set({ retire_age: Math.min(80, v) })} />
          <Field label="Saved so far" value={inp.current_pot} min={0} max={1000000 * big} step={1000 * big} prefix={sym} onChange={(v) => set({ current_pot: v })} />
          <Field
            label="Saving each month"
            hint="including any employer contribution"
            value={inp.monthly_saving}
            min={0}
            max={5000 * big}
            step={50 * big}
            prefix={sym}
            onChange={(v) => set({ monthly_saving: v })}
          />
          <Field
            label="Monthly take-home wanted"
            hint="in retirement, in today's money"
            value={inp.monthly_income}
            min={500 * big}
            max={15000 * big}
            step={100 * big}
            prefix={sym}
            onChange={(v) => set({ monthly_income: Math.max(1, v) })}
          />
          <Field
            label="Rental income each month"
            hint={RENT_HINTS[inp.country]}
            value={inp.rental_monthly ?? 0}
            min={0}
            max={5000 * big}
            step={50 * big}
            prefix={sym}
            onChange={(v) => set({ rental_monthly: v })}
          />

          <Field
            label="Mortgage payment each month"
            hint="leave at 0 if it'll be paid off by the time you retire"
            value={inp.mortgage_monthly ?? 0}
            min={0}
            max={5000 * big}
            step={50 * big}
            prefix={sym}
            onChange={(v) => set({ mortgage_monthly: v, mortgage_end_age: inp.mortgage_end_age ?? Math.max(inp.age + 1, p.retireAge + 5) })}
          />
          {(inp.mortgage_monthly ?? 0) > 0 && (
            <Field
              label="Mortgage paid off at age"
              value={inp.mortgage_end_age ?? p.retireAge}
              min={inp.age}
              max={90}
              step={1}
              onChange={(v) => set({ mortgage_end_age: Math.min(100, Math.max(inp.age, Math.round(v))) })}
            />
          )}

          <details className={styles.more}>
            <summary>Assumptions</summary>
            <label className={styles.select}>
              Saving in
              <select value={p.potType} onChange={(e) => set({ pot_type: e.target.value })}>
                {Object.entries(POT_TYPES[inp.country]).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label={c.pensionName}
              hint="a month, in today's money"
              value={p.pensionMonthly}
              min={0}
              max={inp.country === "in" ? 100000 : 5000}
              step={inp.country === "in" ? 500 : 10}
              prefix={sym}
              onChange={(v) => set({ pension_monthly: v })}
            />
            <Field label={`${c.pensionName} from age`} value={p.pensionAge} min={50} max={75} step={1} onChange={(v) => set({ pension_age: Math.min(80, Math.max(50, v)) })} />
            <Field label="Inflation" value={p.inflation} min={0} max={10} step={0.5} suffix="%" onChange={(v) => set({ inflation_pct: Math.min(15, v) })} />
            {SCENARIOS.map((s, k) => (
              <Field
                key={s.key}
                label={`${s.label} growth`}
                hint="a year, after fees"
                value={p.growth[k]}
                min={0}
                max={15}
                step={0.5}
                suffix="%"
                onChange={(v) => {
                  const g: [number, number, number] = [...p.growth];
                  g[k] = Math.min(20, v);
                  set({ growth_pct: g });
                }}
              />
            ))}
            <Field
              label="Drawn each year"
              hint="share of the pot"
              value={p.withdrawal}
              min={2}
              max={8}
              step={0.25}
              suffix="%"
              onChange={(v) => set({ withdrawal_pct: Math.min(8, Math.max(2, v)) })}
            />
          </details>
        </div>

        <div className={styles.results}>
          <div className={styles.tiles}>
            <div className={styles.tile}>
              <span className={styles.tileLabel}>You&apos;d need</span>
              <strong>{money(p.target, cur)}</strong>
              <span className={styles.hint}>
                about {money(p.targetFuture, cur)} in {years ? `${years} years'` : "today's"} money
                {p.bridge > 0 && `, incl. ${money(p.bridge, cur)} until ${PENSION_STARTS[inp.country]} starts`}
                {p.mortgage > 0 && `${p.bridge > 0 ? " and" : ", incl."} ${money(p.mortgage, cur)} for the mortgage`}
              </span>
            </div>
            <div className={styles.tile}>
              <span className={styles.tileLabel}>On course for</span>
              <strong>{money(p.projections.middle[years], cur)}</strong>
              <span className={styles.hint}>{range}, depending on growth</span>
            </div>
            <div className={`${styles.tile} ${onTrack ? styles.good : styles.short}`}>
              <span className={styles.tileLabel}>{onTrack ? "✓ On track" : "△ Shortfall"}</span>
              <strong>{onTrack ? money(p.projections.middle[years] - p.target, cur) + " spare" : money(p.gap, cur)}</strong>
              <span className={styles.hint}>at middle growth</span>
            </div>
          </div>

          {p.mortgage > 0 && (
            <p className={styles.close}>
              Your mortgage runs <strong>{(inp.mortgage_end_age ?? 0) - p.retireAge} years</strong> into retirement, adding{" "}
              <strong>{money(p.mortgage, cur)}</strong> to the pot you need. Clearing it by {p.retireAge}, by overpaying or
              from savings, would remove that.
            </p>
          )}

          {!onTrack && (
            <p className={styles.close}>
              To close it:{" "}
              {p.monthlyNeeded !== null && (
                <>
                  save about <strong>{money(p.monthlyNeeded, cur)} a month</strong> (
                  {money(Math.max(0, p.monthlyNeeded - inp.monthly_saving), cur)} more)
                </>
              )}
              {p.monthlyNeeded !== null && " or "}
              {p.ageNeeded ? (
                <>
                  retire at <strong>{p.ageNeeded}</strong>
                </>
              ) : (
                "retiring later alone wouldn't close it by 75"
              )}
              , or aim for a smaller income.
            </p>
          )}

          <div className={styles.chartTools}>
            <Expandable
              title="Pot by age"
              render={() => (
                <section className={styles.card}>
                  <h3>Your pot by age, in today&apos;s money</h3>
                  <Chart p={p} large />
                  <ChartLegend p={p} />
                </section>
              )}
            />
          </div>
          <Chart p={p} />
          <ChartLegend p={p} />

          <table className={styles.table}>
            <caption>
              Monthly income in retirement{p.pensionMonthly > 0 && `, once ${PENSION_STARTS[inp.country]} starts`}{(inp.rental_monthly ?? 0) > 0 && ", including rent"}
            </caption>
            <thead>
              <tr>
                <th scope="col" />
                {SCENARIOS.map((s) => (
                  <th key={s.key} scope="col">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Before tax</th>
                {SCENARIOS.map((s) => (
                  <td key={s.key}>{money(p.income[s.key].gross / 12, cur)}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Tax</th>
                {SCENARIOS.map((s) => (
                  <td key={s.key}>{p.income[s.key].tax >= 6 ? "−" : ""}{money(p.income[s.key].tax / 12, cur)}</td>
                ))}
              </tr>
              <tr className={styles.net}>
                <th scope="row">Take-home</th>
                {SCENARIOS.map((s) => (
                  <td key={s.key}>{money(p.income[s.key].net / 12, cur)}</td>
                ))}
              </tr>
            </tbody>
          </table>

          {onAsk && (
            <AskButton
              onAsk={onAsk}
              disabled={disabled}
              label="Ask Tickerwise about this plan →"
              question={() =>
                `Explain my retirement plan: I'm ${inp.age} in the ${COUNTRY_LABELS[inp.country]}, want to retire at ${p.retireAge} on ${money(inp.monthly_income, cur)} a month after tax, have ${money(inp.current_pot, cur)} saved in ${POT_TYPES[inp.country][p.potType].replace(/ \(.*\)/, "")} and save ${money(inp.monthly_saving, cur)} a month${inp.rental_monthly ? `, and expect ${money(inp.rental_monthly, cur)} a month in rent` : ""}${p.mortgage > 0 ? `. My ${money(inp.mortgage_monthly ?? 0, cur)} a month mortgage runs until I'm ${inp.mortgage_end_age}` : ""}. What are my options?`
              }
            />
          )}
        </div>
      </div>

      <p className={styles.note}>
        In today&apos;s money: growth is shown above inflation and savings rise with prices. {NOTES[inp.country]} Rules checked{" "}
        {CHECKED}. An illustration, not a forecast or advice. {GUIDANCE[inp.country]}
      </p>
    </section>
  );
}

