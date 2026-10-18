"use client";

import React, { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";
import { Expandable } from "./expand-dialog";

export interface PeerCompany {
  symbol: string;
  name: string;
  exchange: string | null;
  currency: string | null;
  price: number | null;
  change_pct: number | null;
  year_change_pct: number | null;
  five_year_change_pct: number | null;
  market_cap: number | null;
  market_cap_currency: string | null;
  pe: number | null;
}

interface Closes {
  dates: string[]; // "YYYY-MM-DD", shared by every company
  series: (number | null)[][]; // one row per company, same order as companies
}

export interface PeerData {
  title: string;
  as_of: string;
  companies: PeerCompany[];
  daily: Closes; // the last year
  weekly: Closes; // five years
}

const RANGES = [
  { key: "1M", days: 31, data: "daily" },
  { key: "6M", days: 183, data: "daily" },
  { key: "1Y", days: 366, data: "daily" },
  { key: "5Y", days: null, data: "weekly" },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

const H_SMALL = 200;
const H_LARGE = 440;
const MIN_W = 240;
const M = { top: 10, right: 10, bottom: 24, left: 52 };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// English formatting everywhere ("€1,090", "€50.9B"); rupees in lakh and crore.
const LOCALES: Record<string, string> = { USD: "en-US", INR: "en-IN" };

function money(v: number | null, currency: string | null, compact = false) {
  if (v === null || !currency) return "–";
  try {
    return new Intl.NumberFormat(LOCALES[currency] ?? "en-GB", {
      style: "currency",
      currency,
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: compact ? 1 : v >= 1000 ? 0 : 2,
    }).format(v);
  } catch {
    return `${v.toLocaleString()} ${currency}`;
  }
}

// "Maruti Suzuki India Limited" → "Maruti Suzuki India" ("Ord" is how Yahoo names investment trusts' shares); the full name stays in the row's tooltip.
const SUFFIX = /,?\s+(?:Limited|Ltd\.?|[Pp]lc|PLC|Ord|Inc\.?|Incorporated|Corporation|Corp\.?|Co\.,?|N\.V\.|S\.A\.|AG|SE)$/;
export function shortName(name: string) {
  let out = name.trim();
  for (let i = 0; i < 3 && SUFFIX.test(out); i++) out = out.replace(SUFFIX, "");
  return out || name;
}

function symbolOf(currency: string) {
  try {
    return new Intl.NumberFormat(LOCALES[currency] ?? "en-GB", { style: "currency", currency }).formatToParts(0).find((p) => p.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

// A company's market value in words people know: "₹3.6 lakh crore", "$229bn", "£44bn".
function worth(v: number, currency: string) {
  const s = symbolOf(currency);
  if (currency === "INR") return v >= 1e12 ? `${s}${(v / 1e12).toFixed(1)} lakh crore` : v >= 1e7 ? `${s}${Math.round(v / 1e7).toLocaleString("en-IN")} crore` : money(v, currency);
  return v >= 1e12 ? `${s}${(v / 1e12).toFixed(1)}tn` : v >= 1e9 ? `${s}${(v / 1e9).toFixed(v >= 1e11 ? 0 : 1)}bn` : v >= 1e6 ? `${s}${Math.round(v / 1e6)}m` : money(v, currency);
}

const pct = (v: number | null, digits = 1) => (v === null ? "–" : `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`);

function dateLabel(iso: string, range: RangeKey) {
  const [y, m, d] = iso.split("-");
  const month = MONTHS[Number(m) - 1];
  if (range === "5Y") return y;
  if (range === "1M") return `${Number(d)} ${month}`;
  return `${month} ’${y.slice(2)}`;
}

// The plotted range (the data and zero, plus a little room) and round % gridlines inside it.
function scale(lo: number, hi: number, count = 4) {
  const pad = Math.max((hi - lo) * 0.06, 0.5);
  const [min, max] = [lo - pad, hi + pad];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((f) => f * mag).find((s) => s >= raw) ?? raw;
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) ticks.push(Math.round(v * 100) / 100);
  return { min, max, ticks };
}

const axisPct = (t: number) => `${t > 0 ? "+" : ""}${Math.abs(t) >= 1000 ? `${t / 1000}k` : t}%`;

// % change from the first price in the range; companies without a price there start when theirs does.
function rebased(data: PeerData, range: (typeof RANGES)[number]) {
  const closes = data[range.data];
  let start = 0;
  if (range.days !== null) {
    const last = new Date(closes.dates[closes.dates.length - 1]).getTime();
    const from = last - range.days * 86_400_000;
    start = Math.max(0, closes.dates.findIndex((d) => new Date(d).getTime() >= from));
  }
  const dates = closes.dates.slice(start);
  const series = closes.series.map((row) => {
    const slice = row.slice(start);
    const base = slice.find((v) => v !== null && v > 0) ?? null;
    return slice.map((v) => (v === null || base === null ? null : (v / base - 1) * 100));
  });
  return { dates, series };
}

export default function PeerPanel({
  data,
  watched,
  onWatch,
  large = false,
}: {
  data: PeerData;
  watched?: Set<string>; // symbols on the person's watchlist
  onWatch?: (company: { symbol: string; name: string }, on: boolean) => void; // shown when signed in
  large?: boolean; // drawn taller, in the expanded view
}) {
  const H = large ? H_LARGE : H_SMALL;
  const [range, setRange] = useState<RangeKey>("1Y");
  const [hover, setHover] = useState<number | null>(null);
  const [W, setW] = useState(320);
  const svgRef = useRef<SVGSVGElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    // Measure now as well as on every resize, so a chart that first draws in a dialog has its real width.
    setW(Math.max(MIN_W, Math.round(el.getBoundingClientRect().width)));
    const observer = new ResizeObserver(([entry]) => setW(Math.max(MIN_W, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const spec = RANGES.find((r) => r.key === range)!;
  const { dates, series } = rebased(data, spec);
  const n = dates.length;
  const last = n - 1;
  const values = series.flat().filter((v): v is number => v !== null);
  const { min: yMin, max: yMax, ticks: yTicks } = scale(Math.min(0, ...values), Math.max(0, ...values));
  const x = (i: number) => M.left + (n <= 1 ? 0 : (i / (n - 1)) * (W - M.left - M.right));
  const y = (v: number) => M.top + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - M.top - M.bottom);
  const path = (row: (number | null)[]) => {
    let d = "";
    let pen = false;
    row.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  const endOf = (row: (number | null)[]) => [...row].reverse().find((v) => v !== null) ?? null;
  const xTicks = n > 1 ? [0, 1, 2, 3].map((k) => Math.round((k / 3) * last)) : [0];

  const indexAt = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const px = ((clientX - rect.left) / rect.width) * W;
    return Math.min(last, Math.max(0, Math.round(((px - M.left) / (W - M.left - M.right)) * last)));
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step: Record<string, (i: number) => number> = {
      ArrowLeft: (i) => i - 1,
      ArrowRight: (i) => i + 1,
      Home: () => 0,
      End: () => last,
    };
    if (!step[e.key]) return;
    e.preventDefault();
    setHover((h) => Math.min(last, Math.max(0, step[e.key](h ?? last))));
  };

  const at = hover ?? last;
  const rows = data.companies
    .map((c, k) => ({ k, name: shortName(c.name), value: series[k][at] }))
    .filter((r) => r.value !== null)
    .sort((a, b) => (b.value as number) - (a.value as number));
  const tooltipLeft = hover === null ? 0 : (x(hover) / W) * 100;

  return (
    <section className={styles.peers} aria-label={data.title}>
      <div className={styles.peersHead}>
        <h3 className={styles.peersTitle}>{data.title}</h3>
        <div className={styles.peersRanges} role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <button
              key={r.key}
              className={r.key === range ? styles.peersRangeOn : ""}
              aria-pressed={r.key === range}
              onClick={() => {
                setRange(r.key);
                setHover(null);
              }}
            >
              {r.key}
            </button>
          ))}
        </div>
        {!large && (
          <Expandable
            title={data.title}
            render={() => <PeerPanel data={data} watched={watched} onWatch={onWatch} large />}
          />
        )}
      </div>

      <div className={styles.chartPlot} ref={plotRef}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Share price change over ${range}: ${data.companies
            .map((c, k) => `${c.name} ${pct(endOf(series[k]))}`)
            .join("; ")}. Use the arrow keys to read values by date.`}
          tabIndex={0}
          onPointerMove={(e) => setHover(indexAt(e.clientX))}
          onPointerLeave={() => setHover(null)}
          onFocus={() => setHover(last)}
          onBlur={() => setHover(null)}
          onKeyDown={onKeyDown}
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line
                className={t === 0 ? styles.peersZero : styles.chartGrid}
                x1={M.left}
                x2={W - M.right}
                y1={y(t)}
                y2={y(t)}
              />
              <text className={styles.chartAxis} x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end">
                {axisPct(t)}
              </text>
            </g>
          ))}
          {xTicks.map((i, k) => (
            <text
              key={i}
              className={styles.chartAxis}
              x={x(i)}
              y={H - 6}
              textAnchor={k === 0 ? "start" : k === xTicks.length - 1 ? "end" : "middle"}
            >
              {dateLabel(dates[i], range)}
            </text>
          ))}

          {/* Peers first, the company asked about last so it draws on top. */}
          {[...series.keys()].reverse().map((k) => (
            <path
              key={data.companies[k].symbol}
              className={styles.chartLine}
              style={{ stroke: `var(--series-${k + 1})`, strokeWidth: k === 0 ? 2.5 : 1.75 }}
              d={path(series[k])}
            />
          ))}

          {hover !== null && <line className={styles.chartCrosshair} x1={x(hover)} x2={x(hover)} y1={M.top} y2={H - M.bottom} />}
          {series.map((row, k) =>
            row[at] === null ? null : (
              <circle
                key={data.companies[k].symbol}
                className={styles.chartDot}
                cx={x(at)}
                cy={y(row[at] as number)}
                r={3.5}
                style={{ fill: `var(--series-${k + 1})` }}
              />
            )
          )}
        </svg>

        {hover !== null && (
          <div
            className={styles.chartTooltip}
            // The panel is narrow, so the box sits on the side away from the pointer.
            style={tooltipLeft > 50 ? { left: 0 } : { right: 0 }}
            role="status"
          >
            <div className={styles.chartTooltipDate}>{dateLabel(dates[hover], "1M")} {dates[hover].slice(0, 4)}</div>
            {rows.map((r) => (
              <div key={r.k} className={styles.chartTooltipRow}>
                <span className={styles.lineKey} style={{ background: `var(--series-${r.k + 1})` }} />
                <strong>{pct(r.value)}</strong>
                <span>{r.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Each row doubles as the chart's legend and a readable summary. */}
      <ul className={styles.peersList}>
        {data.companies.map((c, k) => (
          <li key={c.symbol} className={`${k === 0 ? styles.peersMain : ""} ${onWatch ? styles.peersWatchable : ""}`}>
            <span className={styles.lineKey} style={{ background: `var(--series-${k + 1})` }} />
            <span className={styles.peersName} title={c.name}>
              {shortName(c.name)}
              <span className={styles.legendDetail}>
                {c.symbol}
                {c.market_cap !== null && c.market_cap_currency ? ` · worth ${worth(c.market_cap, c.market_cap_currency)}` : ""}
              </span>
              {c.pe !== null && c.currency && (
                <span className={styles.legendDetail} title="P/E: the share price ÷ a year's profit per share">
                  {symbolOf(c.currency)}
                  {c.pe.toFixed(0)} for each {symbolOf(c.currency)}1 of yearly profit
                </span>
              )}
            </span>
            <span className={styles.peersFigures}>
              {money(c.price, c.currency)}
              <span className={(c.change_pct ?? 0) >= 0 ? styles.up : styles.down}>
                {(c.change_pct ?? 0) >= 0 ? "▲" : "▼"} {pct(c.change_pct)} today
              </span>
            </span>
            <span className={styles.peersRange}>
              {pct(endOf(series[k]), 0)}
              <span className={styles.legendDetail}>{range}</span>
            </span>
            {onWatch && (
              <button
                className={`${styles.watchStar} ${watched?.has(c.symbol) ? styles.watchStarOn : ""}`}
                aria-pressed={Boolean(watched?.has(c.symbol))}
                aria-label={watched?.has(c.symbol) ? `Stop watching ${c.name}` : `Watch ${c.name}`}
                title={watched?.has(c.symbol) ? "On your watchlist" : "Add to watchlist"}
                onClick={() => onWatch({ symbol: c.symbol, name: c.name }, !watched?.has(c.symbol))}
              >
                {watched?.has(c.symbol) ? "★" : "☆"}
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className={styles.chartNote}>
        Price change in each share&apos;s own currency, excluding dividends. &ldquo;For each 1 of yearly profit&rdquo; is what buyers
        pay for a share compared with the profit behind it (the P/E): lower means cheaper for the profit. As of {data.as_of}; may
        be delayed.
      </p>
    </section>
  );
}
