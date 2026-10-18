"use client";

import React, { useMemo, useState } from "react";
import styles from "./retirement.module.css";
import { AskButton } from "./ask-gate";
import { Field } from "./retirement-card";
import { CHECKED, estateDefaults, estimate, type EstateCountry, type EstateInput } from "./inheritance";
import { money, type Currency } from "./retirement";

const LABELS: Record<EstateCountry, string> = { uk: "UK", in: "India", us: "US" };
const CURRENCY: Record<EstateCountry, Currency> = { uk: "GBP", in: "INR", us: "USD" };

const NOTES: Record<EstateCountry, React.ReactNode> = {
  uk: (
    <>
      Bands frozen to April 2031. Nothing is due on what you leave to a husband, wife or civil partner. Gifts are those above the
      £3,000 yearly exemption in the 7 years before death; tax on gifts above the nil-rate band falls on the people who received
      them. Ignores business and agricultural relief. Official guide:{" "}
      <a href="https://www.gov.uk/inheritance-tax" target="_blank" rel="noreferrer">
        Inheritance Tax on GOV.UK
      </a>
      .
    </>
  ),
  us: (
    <>
      Federal estate tax only; some states charge their own. Gifts are those above the $19,000 yearly exclusion per person. A
      couple&apos;s second exclusion needs an estate tax return at the first death (portability). Official guide:{" "}
      <a href="https://www.irs.gov/businesses/small-businesses-self-employed/estate-tax" target="_blank" rel="noreferrer">
        Estate tax on IRS.gov
      </a>
      .
    </>
  ),
  in: (
    <>
      India has had no estate duty since 1985, and inheriting isn&apos;t taxed as income. Heirs pay capital gains tax when they sell,
      counted from the original owner&apos;s purchase, and income tax on rent or interest. Keep nominations up to date and make a
      will: a nominee may hold assets on behalf of the legal heirs.
    </>
  ),
};

/** What an estate might pay in inheritance tax (UK) or federal estate tax (US), and what heirs receive. */
export default function InheritanceCard({
  initial,
  onAsk,
  disabled = false,
}: {
  initial: EstateInput;
  onAsk?: (question: string) => void;
  disabled?: boolean;
}) {
  const [inp, setInp] = useState<EstateInput>({ ...estateDefaults(initial.country), ...initial, gifts: initial.gifts ?? [] });
  const { now, before } = useMemo(() => estimate(inp), [inp]);
  const cur = CURRENCY[inp.country];
  const sym = { GBP: "£", USD: "$", INR: "₹" }[cur];
  const big = cur === "INR" ? 100 : 1;
  const set = (patch: Partial<EstateInput>) => setInp((s) => ({ ...s, ...patch }));
  const m = (v: number) => money(v, cur);
  const uk = inp.country === "uk";
  const india = inp.country === "in";

  const parts = [
    { key: "heirs", label: "To your heirs", value: now.toHeirs, color: "var(--series-3)" },
    { key: "charity", label: "To charity", value: now.charity, color: "var(--series-1)" },
    { key: "tax", label: uk ? "Inheritance tax" : "Estate tax", value: now.tax, color: "var(--series-2)" },
  ].filter((p) => p.value > 0.5);
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;

  return (
    <section className={styles.card} aria-label="Inheritance tax estimate">
      <header className={styles.head}>
        <h3>Inheritance tax estimate</h3>
        <div className={styles.segmented} role="group" aria-label="Country">
          {(Object.keys(LABELS) as EstateCountry[]).map((k) => (
            <button key={k} aria-pressed={inp.country === k} onClick={() => k !== inp.country && setInp(estateDefaults(k))}>
              {LABELS[k]}
            </button>
          ))}
        </div>
      </header>

      <div className={styles.layout}>
        <div className={styles.form}>
          <label className={styles.check}>
            <input type="checkbox" checked={inp.couple} onChange={(e) => set({ couple: e.target.checked })} />
            <span>
              Married or civil partners
              <span className={styles.hint}>
                {india ? "" : "the estate on the second death, with both allowances; enter what you own together"}
              </span>
            </span>
          </label>
          <Field label="Home" hint={inp.couple ? "its full value" : "your share"} value={inp.home} min={0} max={3000000 * big} step={10000 * big} prefix={sym} onChange={(v) => set({ home: v })} />
          {uk && (
            <label className={styles.check}>
              <input type="checkbox" checked={inp.home_to_descendants} onChange={(e) => set({ home_to_descendants: e.target.checked })} />
              <span>
                The home goes to children or grandchildren
                <span className={styles.hint}>needed for the residence nil-rate band</span>
              </span>
            </label>
          )}
          <Field label="Savings and investments" hint={uk ? "including ISAs" : undefined} value={inp.savings} min={0} max={3000000 * big} step={10000 * big} prefix={sym} onChange={(v) => set({ savings: v })} />
          <Field
            label={inp.country === "us" ? "401(k)s and IRAs" : inp.country === "in" ? "EPF, PPF and NPS" : "Unused pensions"}
            hint={uk ? "count from April 2027" : undefined}
            value={inp.pensions}
            min={0}
            max={2000000 * big}
            step={10000 * big}
            prefix={sym}
            onChange={(v) => set({ pensions: v })}
          />
          <Field label="Other property and possessions" value={inp.other} min={0} max={2000000 * big} step={10000 * big} prefix={sym} onChange={(v) => set({ other: v })} />
          <Field label="Mortgage and other debts" hint="including funeral costs" value={inp.debts} min={0} max={1000000 * big} step={5000 * big} prefix={sym} onChange={(v) => set({ debts: v })} />
          {!india && (
            <details className={styles.more}>
              <summary>Gifts and charity</summary>
              <Field label="Left to charity" value={inp.charity_pct} min={0} max={50} step={1} suffix="%" onChange={(v) => set({ charity_pct: Math.min(100, v) })} />
              <div className={styles.gifts}>
                <span className={styles.giftsLabel}>
                  Gifts in the last 7 years
                  <span className={styles.hint}>{uk ? "above £3,000 a year" : "above $19,000 a year per person"}</span>
                </span>
                {inp.gifts.map((g, i) => (
                  <div key={i} className={styles.giftRow}>
                    <span className={styles.number}>
                      <span>{sym}</span>
                      <input
                        type="number"
                        min={0}
                        aria-label={`Gift ${i + 1} amount`}
                        value={g.amount}
                        onChange={(e) => set({ gifts: inp.gifts.map((x, j) => (j === i ? { ...x, amount: Math.max(0, Number(e.target.value) || 0) } : x)) })}
                      />
                    </span>
                    <select
                      aria-label={`Gift ${i + 1}: when`}
                      value={Math.floor(g.years_ago)}
                      onChange={(e) => set({ gifts: inp.gifts.map((x, j) => (j === i ? { ...x, years_ago: Number(e.target.value) } : x)) })}
                    >
                      {[0, 1, 2, 3, 4, 5, 6].map((y) => (
                        <option key={y} value={y}>
                          {y === 0 ? "under a year ago" : `${y}–${y + 1} years ago`}
                        </option>
                      ))}
                    </select>
                    <button className={styles.remove} aria-label={`Remove gift ${i + 1}`} onClick={() => set({ gifts: inp.gifts.filter((_, j) => j !== i) })}>
                      ✕
                    </button>
                  </div>
                ))}
                {inp.gifts.length < 20 && (
                  <button className={styles.linkish} onClick={() => set({ gifts: [...inp.gifts, { amount: 10000 * big, years_ago: 1 }] })}>
                    + Add a gift
                  </button>
                )}
              </div>
            </details>
          )}
        </div>

        <div className={styles.results}>
          <div className={styles.tiles}>
            <div className={styles.tile}>
              <span className={styles.tileLabel}>Estate</span>
              <strong>{m(now.estate)}</strong>
              <span className={styles.hint}>after debts</span>
            </div>
            <div className={`${styles.tile} ${now.tax > 0 ? styles.short : styles.good}`}>
              <span className={styles.tileLabel}>{now.tax > 0 ? (uk ? "Inheritance tax" : "Estate tax") : "✓ No tax"}</span>
              <strong>{m(now.tax)}</strong>
              <span className={styles.hint}>
                {india ? "no inheritance tax in India" : now.tax > 0 ? `${now.ratePct}% of ${m(now.taxable)}` : "the estate is within the allowances"}
              </span>
            </div>
            <div className={styles.tile}>
              <span className={styles.tileLabel}>Heirs receive</span>
              <strong>{m(now.toHeirs)}</strong>
              <span className={styles.hint}>{now.estate ? `${Math.round((now.toHeirs / now.estate) * 100)}% of the estate` : ""}</span>
            </div>
          </div>

          {before && before.tax !== now.tax && (
            <p className={styles.close}>
              Because unused pensions count from <strong>6 April 2027</strong>, the tax rises from {m(before.tax)} to <strong>{m(now.tax)}</strong>.
            </p>
          )}

          <div className={styles.split} role="img" aria-label={parts.map((p) => `${p.label}: ${m(p.value)}`).join("; ")}>
            {parts.map((p) => (
              <span key={p.key} style={{ flexGrow: p.value / total, background: p.color }} />
            ))}
          </div>
          <ul className={styles.legend}>
            {parts.map((p) => (
              <li key={p.key}>
                <span className={styles.key} style={{ background: p.color }} />
                {p.label} <span className={styles.hint}>{m(p.value)}</span>
              </li>
            ))}
          </ul>

          {!india && (
            <table className={styles.table}>
              <caption>How it&apos;s worked out</caption>
              <tbody>
                <tr>
                  <th scope="row">Estate after debts</th>
                  <td>{m(now.estate)}</td>
                </tr>
                {now.charity > 0 && (
                  <tr>
                    <th scope="row">Left to charity (tax-free)</th>
                    <td>−{m(now.charity)}</td>
                  </tr>
                )}
                <tr>
                  <th scope="row">
                    {uk ? "Nil-rate band" : "Basic exclusion"}
                    {inp.couple ? " (both of you)" : ""}
                    {now.allowanceUsedByGifts > 0 && `, after ${m(now.allowanceUsedByGifts)} of gifts`}
                  </th>
                  <td>−{m(now.allowance - now.allowanceUsedByGifts)}</td>
                </tr>
                {uk && (
                  <tr>
                    <th scope="row">Residence nil-rate band</th>
                    <td>−{m(now.residenceBand)}</td>
                  </tr>
                )}
                <tr className={styles.net}>
                  <th scope="row">Taxed at {now.ratePct}%</th>
                  <td>{m(now.taxable)}</td>
                </tr>
                {now.taxOnGifts > 0 && (
                  <tr>
                    <th scope="row">Tax on gifts (paid by recipients)</th>
                    <td>{m(now.taxOnGifts)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {onAsk && (
            <AskButton
              onAsk={onAsk}
              disabled={disabled}
              label="Ask Tickerwise about this →"
              question={() =>
                india
                    ? `How would my family be taxed on inheriting my home (${m(inp.home)}) and investments (${m(inp.savings)}) in India, and how should nominations and a will work?`
                    : `Explain my ${uk ? "inheritance" : "estate"} tax estimate: an estate of ${m(now.estate)}${inp.couple ? " for a married couple" : ""}, including a ${m(inp.home)} home and ${m(inp.pensions)} in ${uk ? "pensions" : "retirement accounts"}. It shows ${m(now.tax)} of tax. What affects this, and what are the general ways people reduce it?`
              }
            />
          )}
        </div>
      </div>

      <p className={styles.note}>
        {NOTES[inp.country]} Rules checked {CHECKED}. An illustration, not advice: a solicitor or tax adviser can help with estate planning.
      </p>
    </section>
  );
}
