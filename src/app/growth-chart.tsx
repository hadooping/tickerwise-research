"use client";

import React, { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

export interface ChartData {
  title: string;
  currency: "GBP" | "USD" | "INR";
  months: string[]; // "YYYY-MM"
  invested: number[];
  series: { name: string; detail: string; values: number[] }[];
}

// Drawing space matches the container's width so text stays at its real size on phones.
const H = 300;
const MIN_W = 300;
const M = { top: 16, right: 20, bottom: 30, left: 58 };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

const LOCALES: Record<string, string> = { GBP: "en-GB", USD: "en-US", INR: "en-IN" };

function money(v: number, currency: string, compact = false) {
  // en-IN writes rupees in lakh and crore (₹12,50,000; compact ₹12.5L).
  return new Intl.NumberFormat(LOCALES[currency] ?? "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: compact && Math.abs(v) >= 1000 ? 1 : 0,
    notation: compact ? "compact" : "standard",
  }).format(v);
}

// Round tick steps (1, 2, 5 x 10^n) so the axis reads 0 / 50K / 100K / 150K.
function ticks(max: number, count = 4) {
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((f) => f * mag).find((s) => s >= raw) ?? raw;
  const out = [];
  for (let v = 0; v <= max + step * 0.001; v += step) out.push(v);
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + step);
  return out;
}

export default function GrowthChart({ chart }: { chart: ChartData }) {
  const { months, invested, series, currency } = chart;
  const [hover, setHover] = useState<number | null>(null);
  const [W, setW] = useState(720);
  const svgRef = useRef<SVGSVGElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setW(Math.max(MIN_W, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const n = months.length;
  const yTicks = ticks(Math.max(...invested, ...series.flatMap((s) => s.values)));
  const yMax = yTicks[yTicks.length - 1];
  const x = (i: number) => M.left + (n === 1 ? 0 : (i / (n - 1)) * (W - M.left - M.right));
  const y = (v: number) => M.top + (1 - v / yMax) * (H - M.top - M.bottom);
  const path = (values: number[]) => values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");

  // Years on long charts (every other year when narrow); every few months on short ones.
  const narrow = W < 520;
  const xTicks = months
    .map((m, i) => ({ m, i }))
    .filter(({ m, i }) =>
      n > 24 ? m.endsWith("-01") && (!narrow || Number(m.slice(0, 4)) % 2 === 0) : i % (narrow ? 6 : 3) === 0
    );

  const indexAt = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const px = ((clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - M.left) / (W - M.left - M.right)) * (n - 1));
    return Math.min(n - 1, Math.max(0, i));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const keys: Record<string, (i: number) => number> = {
      ArrowLeft: (i) => i - 1,
      ArrowRight: (i) => i + 1,
      Home: () => 0,
      End: () => n - 1,
    };
    if (!keys[e.key]) return;
    e.preventDefault();
    setHover((h) => Math.min(n - 1, Math.max(0, keys[e.key](h ?? n - 1))));
  };

  const last = n - 1;
  const paid = invested[last];
  const hoverRows =
    hover === null
      ? []
      : [
          ...series.map((s, k) => ({ key: k, name: s.name, value: s.values[hover] })),
          { key: -1, name: "Paid in", value: invested[hover] },
        ].sort((a, b) => b.value - a.value);
  const tooltipLeft = hover === null ? 0 : (x(hover) / W) * 100;

  return (
    <figure className={styles.chart}>
      <figcaption className={styles.chartTitle}>{chart.title}</figcaption>

      <div className={styles.chartBody}>
        <div className={styles.chartPlot} ref={plotRef}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`${chart.title}. ${series
              .map((s) => `${s.name}: ${money(s.values[last], currency)}`)
              .join("; ")}. Paid in: ${money(paid, currency)}. Use the arrow keys to read values by month.`}
            tabIndex={0}
            onPointerMove={(e) => setHover(indexAt(e.clientX))}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(last)}
            onBlur={() => setHover(null)}
            onKeyDown={onKeyDown}
          >
            {yTicks.map((t) => (
              <g key={t}>
                <line className={styles.chartGrid} x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} />
                <text className={styles.chartAxis} x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
                  {money(t, currency, true)}
                </text>
              </g>
            ))}
            {xTicks.map(({ m, i }) => (
              <text key={m} className={styles.chartAxis} x={x(i)} y={H - 8} textAnchor="middle">
                {n > 24 ? m.slice(0, 4) : monthLabel(m)}
              </text>
            ))}

            <path className={styles.chartInvested} d={path(invested)} />
            {series.map((s, k) => (
              <path key={s.name} className={styles.chartLine} style={{ stroke: `var(--series-${k + 1})` }} d={path(s.values)} />
            ))}

            {hover !== null && <line className={styles.chartCrosshair} x1={x(hover)} x2={x(hover)} y1={M.top} y2={H - M.bottom} />}

            {/* End dots, or dots at the hovered month; the surface ring keeps them legible where lines cross. */}
            {series.map((s, k) => {
              const i = hover ?? last;
              return (
                <circle
                  key={s.name}
                  className={styles.chartDot}
                  cx={x(i)}
                  cy={y(s.values[i])}
                  r={4}
                  style={{ fill: `var(--series-${k + 1})` }}
                />
              );
            })}
          </svg>

          {hover !== null && (
            <div
              className={styles.chartTooltip}
              style={tooltipLeft > 60 ? { right: `${100 - tooltipLeft + 2}%` } : { left: `${tooltipLeft + 2}%` }}
              role="status"
            >
              <div className={styles.chartTooltipDate}>{monthLabel(months[hover])}</div>
              {hoverRows.map((r) => (
                <div key={r.key} className={styles.chartTooltipRow}>
                  <span
                    className={styles.lineKey}
                    style={{ background: r.key === -1 ? "var(--text-faint)" : `var(--series-${r.key + 1})` }}
                  />
                  <strong>{money(r.value, currency)}</strong>
                  <span>{r.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* The legend doubles as the readable table of results: each line's final value as text. */}
        <ul className={styles.chartLegend}>
          {series.map((s, k) => {
            const end = s.values[last];
            const gain = ((end / paid - 1) * 100).toFixed(0);
            return (
              <li key={s.name}>
                <span className={styles.lineKey} style={{ background: `var(--series-${k + 1})` }} />
                <span className={styles.legendName}>
                  {s.name}
                  <span className={styles.legendDetail}>{s.detail}</span>
                </span>
                <span className={styles.legendValue}>
                  {money(end, currency)}
                  <span className={styles.legendDetail}>
                    {Number(gain) >= 0 ? "+" : ""}
                    {gain}%
                  </span>
                </span>
              </li>
            );
          })}
          <li>
            <span className={styles.lineKey} style={{ background: "var(--text-faint)" }} />
            <span className={styles.legendName}>Paid in</span>
            <span className={styles.legendValue}>{money(paid, currency)}</span>
          </li>
        </ul>
      </div>
      <p className={styles.chartNote}>
        Past results with dividends reinvested, before platform fees and tax. Not a forecast.
      </p>
    </figure>
  );
}
