"use client";

import styles from "./page.module.css";

export interface TrendingData {
  days: number;
  region: string | null; // "the UK", "the US", "India"; null for visitors elsewhere
  // Each list has the visitor's region first (local), then worldwide favourites.
  companies: {
    symbol: string;
    name: string;
    price: number | null;
    currency: string | null;
    change_pct: number | null;
    count: number;
    local: boolean;
  }[];
  questions: { text: string; count: number; local: boolean }[]; // local ones (asked near the visitor) first
}

const LOCALES: Record<string, string> = { USD: "en-US", INR: "en-IN" };

function money(v: number | null, currency: string | null) {
  if (v === null || !currency) return "";
  try {
    return new Intl.NumberFormat(LOCALES[currency] ?? "en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: v >= 1000 ? 0 : 2,
    }).format(v);
  } catch {
    return `${v} ${currency}`;
  }
}

// Drops exchange suffixes for display: SHEL.L -> SHEL, ^FTSE stays as it is.
const ticker = (symbol: string) => symbol.replace(/\.(L|NS|BO)$/, "");

/** "Frequently searched": the companies and suggested questions people looked at this week. */
export default function Trending({
  data,
  onCompany,
  onQuestion,
  disabled,
}: {
  data: TrendingData;
  onCompany: (name: string, symbol: string) => void;
  onQuestion: (text: string) => void;
  disabled: boolean;
}) {
  return (
    <aside className={styles.trending} aria-label="Frequently searched">
      <div className={styles.trendingHead}>
        <h2>Frequently searched</h2>
        <span>
          {data.days === 7 ? "This week" : `Last ${data.days} days`}
          {data.region && data.companies.some((c) => c.local) ? ` in ${data.region}` : ""}
        </span>
      </div>

      {data.companies.length > 0 && (
        <ol className={styles.trendingCompanies}>
          {data.companies.map((c, i) => {
            const up = (c.change_pct ?? 0) >= 0;
            return (
              <li key={c.symbol}>
                <button onClick={() => onCompany(c.name, c.symbol)} disabled={disabled}>
                  <span className={styles.trendingRank}>{i + 1}</span>
                  <span className={styles.trendingName}>
                    {c.name}
                    <span>{ticker(c.symbol)}</span>
                  </span>
                  <span className={styles.trendingPrice}>
                    {money(c.price, c.currency)}
                    {c.change_pct !== null && (
                      <span className={up ? styles.up : styles.down}>
                        {up ? "▲" : "▼"} {Math.abs(c.change_pct).toFixed(1)}%
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {data.questions.length > 0 && (
        <>
          <h3 className={styles.trendingSub}>
            {data.region && data.questions.some((q) => q.local) ? `Popular in ${data.region}` : "Popular questions"}
          </h3>
          <ul className={styles.trendingQuestions}>
            {data.questions.map((q) => (
              <li key={q.text}>
                <button onClick={() => onQuestion(q.text)} disabled={disabled}>
                  {q.text}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
