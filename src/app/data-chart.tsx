"use client";

import React, { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";
import { Expandable } from "./expand-dialog";

// A chart Tickerwise draws from figures it already has (the show_chart tool): grouped bars for
// categories, or lines for steps in time. Same colours and conventions as the growth chart.
export interface FigureData {
  kind: "bar" | "line";
  title: string;
  unit: "GBP" | "USD" | "INR" | "%" | "years" | "number";
  labels: string[];
  series: { name: string; values: (number | null)[] }[];
  note: string;
}

const LOCALES: Record<string, string> = { GBP: "en-GB", USD: "en-US", INR: "en-IN" };

function format(v: number, unit: FigureData["unit"], compact = false) {
  // Large rupee amounts are written in lakh crore and crore (1 crore is 10 million, 1 lakh crore is a million
  // million), as Indian readers say them: "₹3.09 lakh cr" and "₹30,630 cr", not the browser's compact "₹3.1LCr".
  if (unit === "INR" && Math.abs(v) >= 1e12)
    return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(v / 1e12)} lakh cr`;
  if (unit === "INR" && Math.abs(v) >= 1e7)
    return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: Math.abs(v) < 1e9 ? 1 : 0 }).format(v / 1e7)} cr`;
  // Millions and more are always shortened (£8.3bn, not £8,338,000,000), as company figures run to billions.
  compact = compact || Math.abs(v) >= 1e6;
  if (unit === "GBP" || unit === "USD" || unit === "INR")
    return new Intl.NumberFormat(LOCALES[unit], {
      style: "currency",
      currency: unit,
      maximumFractionDigits: compact && Math.abs(v) >= 1000 ? 1 : Math.abs(v) < 10 && v % 1 ? 2 : 0,
      notation: compact ? "compact" : "standard",
    }).format(v);
  const n = new Intl.NumberFormat("en-GB", { maximumFractionDigits: Math.abs(v) < 10 ? 2 : 1, notation: compact ? "compact" : "standard" }).format(v);
  return unit === "%" ? `${n}%` : unit === "years" ? `${n} yrs` : n;
}

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

const color = (k: number) => `var(--series-${k + 1})`;

function Legend({ series }: { series: FigureData["series"] }) {
  if (series.length < 2) return null; // a single series is named by the title
  return (
    <ul className={styles.figureLegend}>
      {series.map((s, k) => (
        <li key={s.name}>
          <span className={styles.lineKey} style={{ background: color(k) }} />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

/** Grouped horizontal bars: one group per label, one bar per series, value at the bar's end. */
function Bars({ fig }: { fig: FigureData }) {
  const values = fig.series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const t = ticks(Math.min(...values), Math.max(...values));
  const lo = t[0];
  const span = t[t.length - 1] - lo || 1;
  const pos = (v: number) => ((v - lo) / span) * 100;
  const zero = pos(0);
  return (
    <div className={styles.bars}>
      {fig.labels.map((label, i) => (
        <div key={label + i} className={styles.barGroup}>
          <div className={styles.barLabel}>{label}</div>
          <div className={styles.barTrack}>
            {fig.series.map((s, k) => {
              const v = s.values[i];
              if (v === null || v === undefined) return <div key={s.name} className={styles.barRow} />;
              const left = Math.min(zero, pos(v));
              const width = Math.max(Math.abs(pos(v) - zero), 0.4);
              return (
                <div key={s.name} className={styles.barRow} title={`${s.name}: ${format(v, fig.unit)}`}>
                  <span className={styles.bar} style={{ left: `${left}%`, width: `${width}%`, background: color(k) }} />
                  <span className={styles.barValue} style={v < 0 ? { right: `${100 - left + 1}%` } : { left: `${left + width + 1}%` }}>
                    {format(v, fig.unit)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

const H_SMALL = 280;
const H_LARGE = 520;
const M = { top: 16, right: 20, bottom: 30, left: 64 };

/** Lines across the labels, with a crosshair and tooltip on hover or arrow keys. */
function Lines({ fig, large = false }: { fig: FigureData; large?: boolean }) {
  const H = large ? H_LARGE : H_SMALL;
  const [W, setW] = useState(720);
  const [hover, setHover] = useState<number | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    // Measure now as well as on every resize, so a chart that first draws in a dialog has its real width.
    setW(Math.max(300, Math.round(el.getBoundingClientRect().width)));
    const observer = new ResizeObserver(([entry]) => setW(Math.max(300, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const n = fig.labels.length;
  const values = fig.series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const t = ticks(Math.min(...values), Math.max(...values));
  const lo = t[0];
  const hi = t[t.length - 1];
  const x = (i: number) => M.left + (n === 1 ? (W - M.left - M.right) / 2 : (i / (n - 1)) * (W - M.left - M.right));
  const y = (v: number) => M.top + (1 - (v - lo) / (hi - lo || 1)) * (H - M.top - M.bottom);
  const path = (vals: (number | null)[]) => {
    let d = "";
    let pen = false;
    vals.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  // As many x labels as fit side by side at about 6.5px a character (11px axis text).
  const longest = Math.max(...fig.labels.map((l) => l.length));
  const fit = Math.max(2, Math.floor((W - M.left - M.right) / (longest * 6.5 + 16)));
  const every = Math.ceil(n / Math.min(fit, W < 520 ? 5 : 10));
  const indexAt = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const px = ((clientX - rect.left) / rect.width) * W;
    return Math.min(n - 1, Math.max(0, Math.round(((px - M.left) / (W - M.left - M.right)) * (n - 1))));
  };
  const left = hover === null ? 0 : (x(hover) / W) * 100;

  return (
    <div className={styles.chartPlot} ref={plotRef}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${fig.title}. Use the arrow keys to read values.`}
        tabIndex={0}
        onPointerMove={(e) => setHover(indexAt(e.clientX))}
        onPointerLeave={() => setHover(null)}
        onFocus={() => setHover(n - 1)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          setHover((h) => Math.min(n - 1, Math.max(0, (h ?? n - 1) + (e.key === "ArrowLeft" ? -1 : 1))));
        }}
      >
        {t.map((v) => (
          <g key={v}>
            <line className={styles.chartGrid} x1={M.left} x2={W - M.right} y1={y(v)} y2={y(v)} />
            <text className={styles.chartAxis} x={M.left - 8} y={y(v)} dy="0.32em" textAnchor="end">
              {format(v, fig.unit, true)}
            </text>
          </g>
        ))}
        {fig.labels.map((label, i) =>
          (i % every === 0 && n - 1 - i >= every) || i === n - 1 ? (
            <text key={label + i} className={styles.chartAxis} x={x(i)} y={H - 8} textAnchor="middle">
              {label}
            </text>
          ) : null
        )}
        {fig.series.map((s, k) => (
          <path key={s.name} className={styles.chartLine} style={{ stroke: color(k) }} d={path(s.values)} />
        ))}
        {hover !== null && <line className={styles.chartCrosshair} x1={x(hover)} x2={x(hover)} y1={M.top} y2={H - M.bottom} />}
        {fig.series.map((s, k) => {
          const i = hover ?? n - 1;
          const v = s.values[i];
          return v === null || v === undefined ? null : (
            <circle key={s.name} className={styles.chartDot} cx={x(i)} cy={y(v)} r={4} style={{ fill: color(k) }} />
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className={styles.chartTooltip}
          style={left > 60 ? { right: `${100 - left + 2}%` } : { left: `${left + 2}%` }}
          role="status"
        >
          <div className={styles.chartTooltipDate}>{fig.labels[hover]}</div>
          {fig.series.map((s, k) =>
            s.values[hover] === null ? null : (
              <div key={s.name} className={styles.chartTooltipRow}>
                <span className={styles.lineKey} style={{ background: color(k) }} />
                <strong>{format(s.values[hover] as number, fig.unit)}</strong>
                <span>{s.name}</span>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

/** bare drops the chart's own border, for a chart inside a card; large draws it taller, in the
 *  expanded view, which every chart can open with its ⤢ button. */
export default function DataChart({
  fig,
  bare = false,
  large = false,
  expandable = true,
}: {
  fig: FigureData;
  bare?: boolean;
  large?: boolean;
  expandable?: boolean; // false inside a panel that has its own ⤢ button
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <figure className={`${styles.chart} ${styles.figure} ${bare ? styles.figureBare : ""}`}>
      <figcaption className={styles.figureHead}>
        <span className={styles.chartTitle}>{fig.title}</span>
        <span className={styles.figureActions}>
          <button className={styles.figureToggle} onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
            {asTable ? "Show chart" : "Show as table"}
          </button>
          {!large && expandable && <Expandable title={fig.title} render={() => <DataChart fig={fig} bare large />} />}
        </span>
      </figcaption>
      {asTable ? (
        <div className={styles.figureTableWrap}>
          <table className={styles.figureTable}>
            <thead>
              <tr>
                <th scope="col" />
                {fig.series.map((s) => (
                  <th key={s.name} scope="col">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fig.labels.map((label, i) => (
                <tr key={label + i}>
                  <th scope="row">{label}</th>
                  {fig.series.map((s) => (
                    <td key={s.name}>{s.values[i] === null ? "–" : format(s.values[i] as number, fig.unit)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <Legend series={fig.series} />
          {fig.kind === "bar" ? <Bars fig={fig} /> : <Lines fig={fig} large={large} />}
        </>
      )}
      <p className={styles.chartNote}>{fig.note}</p>
    </figure>
  );
}
