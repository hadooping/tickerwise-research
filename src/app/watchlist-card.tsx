"use client";

import styles from "./page.module.css";
import type { WatchItem } from "./notifications";

export interface WatchQuote {
  symbol: string;
  price: number | null;
  currency: string | null;
  change_pct: number | null;
}

const LOCALES: Record<string, string> = { USD: "en-US", INR: "en-IN" };
const money = (v: number | null, currency: string | null) => {
  if (v === null || !currency) return "";
  try {
    return new Intl.NumberFormat(LOCALES[currency] ?? "en-GB", { style: "currency", currency, maximumFractionDigits: v >= 1000 ? 0 : 2 }).format(v);
  } catch {
    return `${v} ${currency}`;
  }
};

/** The companies and funds someone watches, with today's price; tap one to ask about it. */
export default function WatchlistCard({
  items,
  quotes,
  onAsk,
  onRemove,
}: {
  items: WatchItem[];
  quotes: Record<string, WatchQuote>;
  onAsk: (item: WatchItem) => void;
  onRemove: (symbol: string) => void;
}) {
  return (
    <aside className={styles.trending} aria-label="Your watchlist">
      <div className={styles.trendingHead}>
        <h2>Your watchlist</h2>
        <span>Today</span>
      </div>
      <ul className={styles.watchList}>
        {items.map((item) => {
          const q = quotes[item.symbol];
          const up = (q?.change_pct ?? 0) >= 0;
          return (
            <li key={item.symbol}>
              <button className={styles.watchMain} onClick={() => onAsk(item)}>
                <span className={styles.trendingName}>
                  {item.name}
                  <span>{item.symbol.replace(/\.(L|NS|BO)$/, "")}</span>
                </span>
                <span className={styles.trendingPrice}>
                  {q ? money(q.price, q.currency) : "…"}
                  {q?.change_pct != null && (
                    <span className={up ? styles.up : styles.down}>
                      {up ? "▲" : "▼"} {Math.abs(q.change_pct).toFixed(1)}%
                    </span>
                  )}
                </span>
              </button>
              <button className={styles.watchRemove} onClick={() => onRemove(item.symbol)} aria-label={`Stop watching ${item.name}`}>
                ✕
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
