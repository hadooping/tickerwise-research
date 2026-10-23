"use client";

import { useState } from "react";
import { supabase } from "../account";
import { deviceHeaders } from "../device";
import type { DirectSavings } from "../portfolio";
import styles from "./regular.module.css";

/** What /api/regular-plan-cost returns: the direct-vs-regular comparison, plus counts for the summary line. */
export type Result = DirectSavings & { funds_in_statement: number; regular_plans: number };

const inr = (v: number | undefined) =>
  v === undefined ? "–" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

/** The upload form and the result. The statement and password go to the backend once, are read in memory and
 *  dropped; nothing is saved, so a visitor needs no account. Signed-in people send their token too, so their hourly
 *  check count is by account rather than by browser. */
export default function Checker() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const check = async () => {
    if (!file || !password) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("password", password);
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      const res = await fetch("/api/regular-plan-cost", {
        method: "POST",
        headers: { ...deviceHeaders(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail ?? "The statement couldn't be read.");
      if (data.error) throw new Error(data.error);
      setResult(data as Result);
      // The password isn't needed again, so it isn't kept on screen.
      setPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't work this out right now. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.checker}>
      <p className={styles.hint}>
        Request a <strong>detailed</strong> CAS by email from CAMS or KFintech (it covers every fund house), or download one
        from NSDL or CDSL, then choose the PDF here.
      </p>
      <input type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={styles.file} />
      <label className={styles.field}>
        <span className={styles.label}>PDF password</span>
        <span className={styles.hint}>Usually your PAN in capitals, as set when you requested the statement.</span>
        <input
          className={styles.input}
          type="password"
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void check()}
        />
      </label>
      <button className={styles.button} disabled={!file || !password || busy} onClick={() => void check()}>
        {busy ? "Reading your statement and comparing with direct plans…" : "Work out what my regular plans cost"}
      </button>
      <p className={styles.hint}>
        Free, and no sign-in. Your statement is read once and discarded: nothing from it is saved, not your PAN, your
        address, your folios or your funds.
      </p>
      {error && <p className={styles.error}>{error}</p>}

      {result && <ResultView result={result} />}
    </section>
  );
}

/** The result: a headline in rupees, the table of compared funds, and why any others couldn't be compared. */
export function ResultView({ result }: { result: Result }) {
  // The funds that were compared (the regular plans with a direct twin and enough history), and the rest.
  const compared = result.funds.filter((f) => f.gap_pct_per_year !== undefined);
  const others = result.funds.filter((f) => f.gap_pct_per_year === undefined && f.note !== "Already a direct plan.");
  return (
        <div className={styles.result}>
          {result.regular_plans === 0 ? (
            <p className={styles.headline}>
              {result.funds_in_statement === 0
                ? "This statement doesn't list any mutual funds."
                : `None of your ${result.funds_in_statement} funds is a regular plan, so there's no distributor commission to measure.`}
            </p>
          ) : compared.length === 0 ? (
            <p className={styles.headline}>
              {result.regular_plans} of your funds {result.regular_plans === 1 ? "is a regular plan" : "are regular plans"},
              but none could be compared with a direct plan yet. The reasons are below.
            </p>
          ) : (
            <>
              <p className={styles.headline}>
                Your regular plans cost you about <strong>{inr(result.total_cost_this_year_inr)}</strong> this year, and
                about <strong>{inr(result.total_cost_over_10_years_inr)}</strong> over 10 years if nothing changes.
              </p>
              <p className={styles.hint}>
                {result.regular_plans} of the {result.funds_in_statement} funds in your statement{" "}
                {result.regular_plans === 1 ? "is a regular plan" : "are regular plans"}. The{" "}
                {compared.length === 1 ? "one compared is" : `${compared.length} compared are`} worth{" "}
                {inr(result.total_value_inr)}.
              </p>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Fund</th>
                      <th className={styles.wide}>Value</th>
                      <th className={styles.wide}>Cost a year</th>
                      <th>This year</th>
                      <th>Over 10 years</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compared.map((f) => (
                      <tr key={f.isin}>
                        <td>
                          <span className={styles.fund}>{f.name ?? f.isin}</span>
                          <span className={styles.hint}>
                            Direct grew {f.direct_growth_pct}% a year vs {f.regular_growth_pct}% over {f.years_compared} years
                          </span>
                        </td>
                        <td className={styles.wide}>{inr(f.value_inr)}</td>
                        <td className={styles.wide}>{f.gap_pct_per_year}%</td>
                        <td>{inr(f.cost_this_year_inr)}</td>
                        <td>{inr(f.cost_over_10_years_inr)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Total</td>
                      <td className={styles.wide}>{inr(result.total_value_inr)}</td>
                      <td className={styles.wide} />
                      <td>{inr(result.total_cost_this_year_inr)}</td>
                      <td>{inr(result.total_cost_over_10_years_inr)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
          {others.length > 0 && (
            <ul className={styles.others}>
              {others.map((f) => (
                <li key={f.isin}>
                  {f.name ?? f.isin}: {f.error ?? f.note}
                </li>
              ))}
            </ul>
          )}
          {compared.length > 0 && <p className={styles.hint}>{result.notes}</p>}
          <p className={styles.hint}>
            Figures from AMFI&apos;s daily NAVs and NAV history (via mfapi.in), as of{" "}
            {result.as_of
              ? new Date(result.as_of).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
              : "today"}
            .
          </p>
        </div>
  );
}
