"use client";

import { useState } from "react";
import styles from "./page.module.css";
import DataChart, { type FigureData } from "./data-chart";
import { Expandable } from "./expand-dialog";
import { shortName } from "./peer-panel";
import type { Dividends } from "./valuation";

/** Ten years of dividends for a company and its peers, beside the answer: dividend yield (a year's
 *  dividends as a % of the share price), which compares across currencies, or the company's own
 *  dividend per share. */
export default function DividendPanel({ data, name, large = false }: { data: Dividends; name: string; large?: boolean }) {
  const [view, setView] = useState<"yield" | "dps">("yield");
  const main = data.companies[0];
  const specials = data.companies.flatMap((c) => (c.specials ?? []).map((y) => `${c.name} ${y}`));
  const labels = data.years.map(String);
  const unit = (main.currency === "GBP" || main.currency === "USD" || main.currency === "INR" ? main.currency : "number") as FigureData["unit"];
  const fig: FigureData =
    view === "yield"
      ? {
          kind: "line",
          title: "Dividend yield each year",
          unit: "%",
          labels,
          series: data.companies.map((c) => ({ name: shortName(c.name), values: c.yield })),
          note: `Dividend yield: the dividends paid in a calendar year as a % of that year's average share price. Gaps are years with no dividend${specials.length ? `, or an unusually large year left out: a one-off special dividend, or a change in the company's shares (${specials.join(", ")})` : ""}. Yahoo Finance.`,
        }
      : {
          kind: "bar",
          title: `${shortName(name)}: dividend per share`,
          unit,
          labels,
          series: [{ name: "Dividend per share", values: main.dps }],
          note: "Dividends paid per share in each calendar year, before tax. A year can look high when a payment lands just before New Year, or with a one-off special dividend. Yahoo Finance.",
        };
  return (
    <div className={styles.dividendPanel}>
      <div className={styles.dividendHead}>
        <span>Dividends, last 10 years</span>
        <div className={styles.dividendToggle} role="group" aria-label="Dividend view">
          <button aria-pressed={view === "yield"} onClick={() => setView("yield")}>
            Yield
          </button>
          <button aria-pressed={view === "dps"} onClick={() => setView("dps")}>
            Per share
          </button>
        </div>
        {!large && <Expandable title="Dividends, last 10 years" render={() => <DividendPanel data={data} name={name} large />} />}
      </div>
      <DataChart fig={fig} bare large={large} expandable={false} />
    </div>
  );
}
