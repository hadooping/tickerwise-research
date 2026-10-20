"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./retirement.module.css";
import { AskButton } from "./ask-gate";
import { Expandable } from "./expand-dialog";

// The _bonds event from get_bond_yields (api/bonds.py).
export interface BondEvent {
  date: string; // YYYY-MM-DD
  label: string;
  text: string;
}

export interface BondEpisode {
  from: string;
  to: string;
  start: string; // YYYY-MM
  end: string;
  arrived: "rising" | "falling" | null;
  yield_12_months_later: number | null;
  stocks_12_months_later_pct: number | null;
}

export interface BondsData {
  country: "uk" | "us" | "in"; // India: monthly averages of the 10-year only, from 2011
  name: string;
  source: string;
  as_of: string;
  now: number;
  monthly: { dates: string[]; values: number[] }; // YYYY-MM, month-end 10-year yield
  daily: { dates: string[]; values: number[] }; // the last year or so
  events: BondEvent[];
  episodes: BondEpisode[];
  curve: { maturity: string; now: number; month_ago: number | null; year_ago: number | null }[];
  stock_index: string;
  near: number;
}

type Range = "1y" | "5y" | "20y" | "all";
const RANGES: { key: Range; label: string; years: number | null }[] = [
  { key: "1y", label: "1Y", years: 1 },
  { key: "5y", label: "5Y", years: 5 },
  { key: "20y", label: "20Y", years: 20 },
  { key: "all", label: "All", years: null },
];

const H_SMALL = 280;
const H_LARGE = 540;
const M = { top: 16, right: 16, bottom: 28, left: 44 };
const DAY = 86400000;

const toTime = (d: string) => (d.length === 7 ? Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, 15) : Date.parse(d + "T00:00:00Z"));
const monthYear = (t: number) => new Date(t).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const pts = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)} pts`;

function ticks(min: number, max: number) {
  const raw = (max - min) / 4 || 1;
  const step = [0.25, 0.5, 1, 2, 5].find((s) => s >= raw) ?? 5;
  const out = [];
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.001; v += step) out.push(Number(v.toFixed(2)));
  if (out[out.length - 1] < max) out.push(Number((out[out.length - 1] + step).toFixed(2)));
  return out;
}

/** The 10-year yield over time, today's level as a dashed line, past spells at that level shaded,
 *  and numbered world events on the line. */
function History({
  d,
  range,
  active,
  setActive,
  large = false,
}: {
  d: BondsData;
  range: Range;
  active: number | null;
  setActive: (i: number | null) => void;
  large?: boolean;
}) {
  const H = large ? H_LARGE : H_SMALL;
  const [W, setW] = useState(640);
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

  const series = range === "1y" ? d.daily : d.monthly;
  const end = toTime(series.dates[series.dates.length - 1]);
  const years = RANGES.find((r) => r.key === range)!.years;
  const start = years ? end - years * 365.25 * DAY : toTime(series.dates[0]);
  const points = series.dates.map((date, i) => ({ t: toTime(date), v: series.values[i] })).filter((p) => p.t >= start);
  const lo = Math.max(0, Math.min(d.now, ...points.map((p) => p.v)) - 0.25);
  const hi = Math.max(d.now, ...points.map((p) => p.v)) + 0.25;
  const yTicks = ticks(lo, hi);
  const yLo = yTicks[0];
  const yHi = yTicks[yTicks.length - 1];
  const x0 = points[0]?.t ?? start;
  const x = (t: number) => M.left + ((t - x0) / (end - x0 || 1)) * (W - M.left - M.right);
  const y = (v: number) => M.top + (1 - (v - yLo) / (yHi - yLo || 1)) * (H - M.top - M.bottom);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join("");

  // The yield nearest an event's date, so its marker sits on the line.
  const at = (t: number) => {
    let best = points[0];
    for (const p of points) if (Math.abs(p.t - t) < Math.abs(best.t - t)) best = p;
    return best;
  };
  const events = d.events.map((e, i) => ({ ...e, n: i + 1, t: toTime(e.date) })).filter((e) => e.t >= x0 && e.t <= end);
  const bands = range === "1y" ? [] : d.episodes.map((e) => ({ a: Math.max(x0, toTime(e.start)), b: toTime(e.end) + 30 * DAY })).filter((b) => b.b > x0);

  const yearsSpan = (end - x0) / (365.25 * DAY);
  const stepYears = yearsSpan <= 1.5 ? 0 : yearsSpan <= 6 ? 1 : yearsSpan <= 25 ? 5 : 10;
  const xTicks: number[] = [];
  if (stepYears === 0) {
    const s = new Date(x0);
    for (let m = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 1)).getTime(); m <= end; ) {
      xTicks.push(m);
      const n = new Date(m);
      m = Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 3, 1);
    }
  } else {
    for (let yr = Math.ceil(new Date(x0).getUTCFullYear() / stepYears) * stepYears; Date.UTC(yr, 0, 1) <= end; yr += stepYears)
      if (Date.UTC(yr, 0, 1) >= x0) xTicks.push(Date.UTC(yr, 0, 1));
  }

  const indexAt = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !points.length) return null;
    const t = x0 + (((clientX - rect.left) / rect.width) * W - M.left) / (W - M.left - M.right) * (end - x0);
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(p.t - t) < Math.abs(points[best].t - t)) best = i;
    });
    return best;
  };
  const h = hover === null ? null : points[hover];
  const pos = h ? (x(h.t) / W) * 100 : 0;
  const nearEvent = h ? events.find((e) => Math.abs(e.t - h.t) < (range === "1y" ? 4 : 45) * DAY) : undefined;

  return (
    <div className={styles.chart} ref={boxRef}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${d.name}: the 10-year yield from ${monthYear(x0)} to ${monthYear(end)}, now ${d.now}%. Events are listed below the chart. Use the arrow keys to read values.`}
        tabIndex={0}
        onPointerMove={(e) => setHover(indexAt(e.clientX))}
        onPointerLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          setHover((i) => Math.min(points.length - 1, Math.max(0, (i ?? points.length - 1) + (e.key === "ArrowLeft" ? -1 : 1))));
        }}
      >
        {bands.map((b, i) => (
          <rect key={i} className={styles.band} x={x(b.a)} width={Math.max(2, x(b.b) - x(b.a))} y={M.top} height={H - M.top - M.bottom} />
        ))}
        {yTicks.map((t) => (
          <g key={t}>
            <line className={styles.grid} x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} />
            <text className={styles.axis} x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
              {t}%
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} className={styles.axis} x={x(t)} y={H - 8} textAnchor="middle">
            {stepYears === 0 ? new Date(t).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }) : new Date(t).getUTCFullYear()}
          </text>
        ))}
        <line className={styles.target} x1={M.left} x2={W - M.right} y1={y(d.now)} y2={y(d.now)} />
        <text className={styles.targetLabel} x={M.left + 6} y={y(d.now) - 6}>
          Today {d.now}%
        </text>
        <path className={styles.line} style={{ stroke: "var(--series-1)" }} d={path} />
        {events.map((e) => {
          const p = at(e.t);
          const on = active === e.n;
          return (
            <g
              key={e.n}
              className={styles.eventMark}
              onPointerEnter={() => setActive(e.n)}
              onPointerLeave={() => setActive(null)}
              aria-hidden="true"
            >
              <circle cx={x(p.t)} cy={y(p.v)} r={on ? 10 : 8} style={{ fill: on ? "var(--series-2)" : "var(--bg)" }} />
              <text x={x(p.t)} y={y(p.v)} dy="0.35em" textAnchor="middle" style={{ fill: on ? "var(--bg)" : "var(--series-2)" }}>
                {e.n}
              </text>
            </g>
          );
        })}
        {h && <line className={styles.crosshair} x1={x(h.t)} x2={x(h.t)} y1={M.top} y2={H - M.bottom} />}
        {h && <circle className={styles.dot} cx={x(h.t)} cy={y(h.v)} r={4} style={{ fill: "var(--series-1)" }} />}
      </svg>
      {h && (
        <div className={styles.tooltip} style={pos > 60 ? { right: `${100 - pos + 2}%` } : { left: `${pos + 2}%` }} role="status">
          <div className={styles.tooltipHead}>{range === "1y" ? new Date(h.t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : monthYear(h.t)}</div>
          <div className={styles.tooltipRow}>
            <strong>{h.v.toFixed(2)}%</strong> 10-year yield
          </div>
          {nearEvent && (
            <div className={styles.tooltipRow}>
              {nearEvent.n}. {nearEvent.label}
            </div>
          )}
        </div>
      )}
      <ul className={styles.legend}>
        <li>
          <span className={styles.key} style={{ background: "var(--series-1)" }} />
          10-year yield
        </li>
        <li>
          <span className={`${styles.key} ${styles.keyTarget}`} />
          Today&apos;s level
        </li>
        {bands.length > 0 && (
          <li>
            <span className={styles.key} style={{ background: "var(--band)", height: 10 }} />
            Past times near today&apos;s level
          </li>
        )}
      </ul>
      {events.length > 0 && (
        <ol className={styles.events}>
          {events.map((e) => (
            <li
              key={e.n}
              value={e.n}
              className={active === e.n ? styles.eventOn : undefined}
              onPointerEnter={() => setActive(e.n)}
              onPointerLeave={() => setActive(null)}
            >
              <strong>
                {monthYear(e.t)}: {e.label}.
              </strong>{" "}
              {e.text}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** The long-run chart on its own, larger, with its own range buttons: for the expanded view. */
function LargeHistory({ d, start }: { d: BondsData; start: Range }) {
  const [range, setRange] = useState<Range>(start);
  const [active, setActive] = useState<number | null>(null);
  return (
    <section className={styles.card} aria-label={`${d.name}, larger`}>
      <header className={styles.head}>
        <h3>{d.name}: 10-year yield since {d.monthly.dates[0].slice(0, 4)}</h3>
        <div className={styles.segmented} role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <button key={r.key} aria-pressed={range === r.key} onClick={() => setRange(r.key)}>
              {r.label}
            </button>
          ))}
        </div>
      </header>
      <History d={d} range={range} active={active} setActive={setActive} large />
    </section>
  );
}

/** Government bond yields: now, over the long run with the world events behind the big moves,
 *  and what followed past times yields were at today's level. */
export default function BondCard({ data, onAsk, disabled = false }: { data: BondsData; onAsk?: (q: string) => void; disabled?: boolean }) {
  const [range, setRange] = useState<Range>("all");
  const [active, setActive] = useState<number | null>(null);
  const d = data;
  const ten = d.curve.find((c) => c.maturity === "10 years");
  const yearChange = ten && ten.year_ago !== null ? ten.now - ten.year_ago : null;
  const record = useMemo(() => {
    let i = 0;
    d.monthly.values.forEach((v, k) => {
      if (v > d.monthly.values[i]) i = k;
    });
    return { v: d.monthly.values[i], t: toTime(d.monthly.dates[i]) };
  }, [d.monthly]);
  const short = d.curve[0];
  const long = d.curve[d.curve.length - 1];
  const inverted = short && long && short.now > long.now;
  const bond = d.country === "uk" ? "gilt" : d.country === "in" ? "G-sec" : "Treasury";

  return (
    <section className={styles.card} aria-label={d.name}>
      <header className={styles.head}>
        <h3>{d.name}</h3>
        <div className={styles.headActions}>
          <div className={styles.segmented} role="group" aria-label="Time range">
            {RANGES.map((r) => (
              <button key={r.key} aria-pressed={range === r.key} onClick={() => setRange(r.key)}>
                {r.label}
              </button>
            ))}
          </div>
          <Expandable title={`${d.name} chart`} render={() => <LargeHistory d={d} start={range} />} />
        </div>
      </header>

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>10-year yield</span>
          <strong>{d.now}%</strong>
          <span className={styles.hint}>as of {d.as_of}</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Over the past year</span>
          <strong>{yearChange === null ? "–" : pts(yearChange)}</strong>
          <span className={styles.hint}>{ten && ten.year_ago !== null ? `from ${ten.year_ago}%` : ""}</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Long-run high</span>
          <strong>{record.v}%</strong>
          <span className={styles.hint}>in {monthYear(record.t)}, month-end</span>
        </div>
      </div>

      <p className={styles.close}>
        When yields rise, the prices of existing bonds fall, and borrowing gets more expensive: for the government, for companies,
        and for homebuyers, because fixed mortgage rates follow {bond} yields. Savers and people buying annuities get better
        rates.
      </p>

      <History d={d} range={range} active={active} setActive={setActive} />

      {d.episodes.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className={styles.table}>
            <caption>
              Past times the 10-year was near {d.now}% (within {d.near} points), and the 12 months after
            </caption>
            <thead>
              <tr>
                <th scope="col" />
                <th scope="col">Got there by</th>
                <th scope="col">10-year a year later</th>
                <th scope="col">{d.stock_index} a year later</th>
              </tr>
            </thead>
            <tbody>
              {[...d.episodes].reverse().map((e) => (
                <tr key={e.start}>
                  <th scope="row">{e.from === e.to ? e.from : `${e.from} – ${e.to}`}</th>
                  <td>{e.arrived ?? "–"}</td>
                  <td>{e.yield_12_months_later === null ? "–" : `${e.yield_12_months_later}%`}</td>
                  <td>
                    {e.stocks_12_months_later_pct === null
                      ? "–"
                      : `${e.stocks_12_months_later_pct > 0 ? "+" : ""}${e.stocks_12_months_later_pct}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* A curve needs more than one maturity; India's data has only the 10-year. */}
      {d.curve.length > 1 && (
        <table className={styles.table}>
          <caption>The yield curve: what the government pays to borrow for different lengths of time</caption>
          <thead>
            <tr>
              <th scope="col" />
              <th scope="col">Now</th>
              <th scope="col">A month ago</th>
              <th scope="col">A year ago</th>
            </tr>
          </thead>
          <tbody>
            {d.curve.map((c) => (
              <tr key={c.maturity}>
                <th scope="row">{c.maturity}</th>
                <td>{c.now}%</td>
                <td>{c.month_ago === null ? "–" : `${c.month_ago}%`}</td>
                <td>{c.year_ago === null ? "–" : `${c.year_ago}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {d.curve.length > 1 && inverted && (
        <p className={styles.close}>
          Short-term yields are above long-term ones (an &ldquo;inverted&rdquo; curve). In the past this has often come before a
          slowdown, though not always.
        </p>
      )}

      {onAsk && (
        <AskButton
          onAsk={onAsk}
          disabled={disabled}
          label="Ask Tickerwise about this →"
          question={() =>
            `Why are ${d.country === "uk" ? "UK gilt" : d.country === "in" ? "Indian G-sec" : "US Treasury"} yields at ${d.now}% now, and what does it mean for mortgages, savings and bond funds?`
          }
        />
      )}

      <p className={styles.note}>
        Source: {d.source}. {d.events.length > 0 ? "Events marked up to 2023. " : ""}Past times are history, not a forecast: what followed depended on what
        else was happening. {d.stock_index} changes are prices only, without dividends. Research, not advice.
      </p>
    </section>
  );
}
