"use client";

import React, { useEffect, useRef, useState } from "react";
import styles from "./settings.module.css";
import IsaCard from "./isa-card";
import { contributionsFromTrading212, ISA_LABELS, pounds, type Contribution } from "./isa";
import {
  ACCOUNT_LABELS,
  ACCOUNTS_BY_COUNTRY,
  FIELD_LABELS,
  guessMapping,
  holdingsFromCsv,
  holdingsFromTrading212,
  importId,
  isTrading212,
  parseCsv,
  regularPlans,
  type AccountType,
  type DirectSavings,
  type Draft,
  type Field,
  type Holding,
  type Mapping,
} from "./portfolio";

export type View = "list" | "add" | "csv" | "cas";
const CURRENCIES = ["GBP", "USD", "INR", "EUR"];

const fmt = (v: number | null, currency: string | null) =>
  v === null
    ? "–"
    : new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-GB", {
        style: currency && CURRENCIES.includes(currency) ? "currency" : "decimal",
        currency: currency && CURRENCIES.includes(currency) ? currency : undefined,
        maximumFractionDigits: 2,
      }).format(v);

export default function PortfolioDialog({
  open,
  onClose,
  signedIn,
  country,
  holdings,
  useInAnswers,
  onUseInAnswers,
  onSave,
  onRemove,
  resolve,
  readCas,
  onReview,
  onSignIn,
  directSavings,
  onAsk,
  contributions,
  isaMonthly,
  onIsaMonthly,
  onAddContributions,
  onRemoveContributions,
  initialView = "list",
  initialRows = null,
  initialCasFile = null,
  initialMessage = null,
}: {
  open: boolean;
  onClose: () => void;
  signedIn: boolean;
  country: string;
  holdings: Holding[];
  useInAnswers: boolean;
  onUseInAnswers: (on: boolean) => void;
  onSave: (holdings: Holding[]) => Promise<void>;
  onRemove: (ids: string[] | "all") => Promise<void>;
  resolve: (drafts: Draft[]) => Promise<(string | null)[]>;
  readCas: (file: File, password: string) => Promise<Holding[]>;
  onReview: () => void;
  onSignIn: (view: View) => void; // remembers where they were, so the dialog reopens there after sign-in
  directSavings: (funds: { isin: string; units: number }[]) => Promise<DirectSavings>;
  onAsk: (question: string) => void;
  contributions: Contribution[];
  isaMonthly: number;
  onIsaMonthly: (amount: number) => void;
  onAddContributions: (list: Contribution[]) => Promise<void>;
  onRemoveContributions: (ids: string[]) => Promise<void>;
  // Opened from the attach button or after sign-in: start at a step, with the file already chosen.
  initialView?: View;
  initialRows?: string[][] | null;
  initialCasFile?: File | null;
  initialMessage?: string | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [view, setView] = useState<View>(initialView);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(
    initialMessage ? { text: initialMessage } : null
  );
  const accounts = ACCOUNTS_BY_COUNTRY[country] ?? ACCOUNTS_BY_COUNTRY.other;
  const defaultCurrency = { uk: "GBP", in: "INR", us: "USD" }[country] ?? "GBP";

  // Add one
  const [draft, setDraft] = useState({ name: "", quantity: "", cost: "", currency: defaultCurrency, account: accounts[0] });
  // CSV
  const [rows, setRows] = useState<string[][] | null>(initialRows);
  const [mapping, setMapping] = useState<Mapping | null>(initialRows ? guessMapping(initialRows[0]) : null);
  const [csvAccount, setCsvAccount] = useState<AccountType>(accounts[0]);
  const [csvCurrency, setCsvCurrency] = useState(defaultCurrency);
  // Direct vs regular
  const [savings, setSavings] = useState<DirectSavings | null>(null);
  const [savingsBusy, setSavingsBusy] = useState(false);
  const regular = regularPlans(holdings);
  const inr = (v: number | undefined) =>
    v === undefined ? "–" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
  // CAS
  const [casFile, setCasFile] = useState<File | null>(initialCasFile);
  const [casPassword, setCasPassword] = useState("");

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const go = (v: View) => {
    setView(v);
    setMessage(null);
  };

  // Matches drafts to symbols, saves them, and reports how many couldn't be matched.
  const importDrafts = async (drafts: Draft[], source: Holding["source"]) => {
    if (!drafts.length) {
      setMessage({ text: "No holdings were found in that file.", error: true });
      return;
    }
    setBusy(true);
    setMessage({ text: `Matching ${drafts.length} holdings to market prices…` });
    try {
      const symbols = await resolve(drafts);
      const holdings: Holding[] = drafts.map((d, i) => ({
        id: source === "manual" ? crypto.randomUUID() : importId(source, d.account, d.isin || d.ticker || d.name),
        name: d.name,
        symbol: symbols[i],
        isin: d.isin || null,
        quantity: d.quantity,
        avgCost: d.avgCost,
        currency: d.currency || null,
        account: d.account,
        plan: null,
        source,
      }));
      await onSave(holdings);
      const missed = holdings.filter((h) => !h.symbol).length;
      setView("list");
      setMessage({
        text: `Added ${holdings.length} ${holdings.length === 1 ? "holding" : "holdings"}.${
          missed ? ` ${missed} couldn't be matched to a market price; add a ticker below.` : ""
        }`,
      });
      setRows(null);
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Import failed. Please try again.", error: true });
    } finally {
      setBusy(false);
    }
  };

  const loadCsv = async (file: File) => {
    const parsed = parseCsv(await file.text());
    if (parsed.length < 2) {
      setMessage({ text: "That file has no rows.", error: true });
      return;
    }
    setRows(parsed);
    setMapping(guessMapping(parsed[0]));
    setMessage(null);
  };

  const fixSymbol = async (h: Holding, ticker: string) => {
    if (!ticker.trim()) return;
    const [symbol] = await resolve([
      { name: h.name, ticker, isin: "", quantity: h.quantity, avgCost: h.avgCost, currency: h.currency ?? "", account: h.account },
    ]);
    if (!symbol) {
      setMessage({ text: `No market price found for “${ticker}”. Try the code shown on your platform.`, error: true });
      return;
    }
    await onSave([{ ...h, symbol }]);
    setMessage({ text: `${h.name} matched to ${symbol}.` });
  };

  const t212 = rows ? isTrading212(rows[0]) : false;
  // A Trading 212 ISA export also has the deposits that count towards the ISA allowance.
  const isaKind = csvAccount === "lisa" ? "lisa" : csvAccount === "isa" ? "ss" : null;
  const deposits: Contribution[] = rows && t212 && isaKind ? contributionsFromTrading212(rows, isaKind) : [];
  const showIsa = country === "uk" || contributions.length > 0 || holdings.some((h) => h.account === "isa" || h.account === "lisa");
  const preview: Draft[] = rows && mapping ? (t212 ? holdingsFromTrading212(rows, csvAccount) : holdingsFromCsv(rows, mapping, csvAccount, csvCurrency)) : [];
  const grouped = accounts
    .concat(Object.keys(ACCOUNT_LABELS).filter((a) => !accounts.includes(a as AccountType)) as AccountType[])
    .map((a) => [a, holdings.filter((h) => h.account === a)] as const)
    .filter(([, list]) => list.length);

  return (
    <dialog ref={ref} className={styles.dialog} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-labelledby="portfolio-title">
      <div className={`${styles.panel} ${styles.panelSingle}`}>
        <header className={styles.head}>
          <h2 id="portfolio-title">My portfolio</h2>
          <button className={styles.close} onClick={onClose} aria-label="Close portfolio">
            ✕
          </button>
        </header>

        <div className={styles.body}>
          {!signedIn ? (
            <section>
              <p className={styles.intro}>
                Bring in your holdings and Tickerwise can review your real portfolio, track your ISA allowance, and show
                what regular mutual fund plans cost you. They&apos;re saved privately to your account, so sign in with
                Google first; you&apos;ll come straight back here.
              </p>
              {view !== "list" && (
                <p className={styles.notice}>
                  {view === "cas"
                    ? "To import your India CAS statement, sign in first."
                    : view === "csv"
                      ? "To import your CSV, sign in first."
                      : "To add a holding, sign in first."}
                </p>
              )}
              <div className={styles.buttonRow}>
                <button className={styles.button} onClick={() => onSignIn("csv")}>
                  Import a CSV from your platform
                </button>
                <button className={styles.button} onClick={() => onSignIn("cas")}>
                  Import India CAS (PDF)
                </button>
                <button className={styles.button} onClick={() => onSignIn("add")}>
                  Add one
                </button>
              </div>
              <p className={styles.hint}>
                Works with Trading 212, Vanguard, Hargreaves Lansdown, AJ Bell, and other platforms&apos; CSV downloads,
                and India&apos;s CAS from CAMS, KFintech, NSDL, or CDSL.
              </p>
              <button className={styles.primaryButton} onClick={() => onSignIn(view)}>
                Sign in with Google
              </button>
            </section>
          ) : (
            <>
              {message && (
                <p className={message.error ? styles.error : styles.notice} role="status">
                  {message.text}
                </p>
              )}

              {view === "list" && (
                <section>
                  {showIsa && (
                    <IsaCard
                      contributions={contributions}
                      monthly={isaMonthly}
                      onMonthly={onIsaMonthly}
                      onAdd={onAddContributions}
                      onRemove={onRemoveContributions}
                    />
                  )}
                  <div className={styles.buttonRow}>
                    <button className={styles.button} onClick={() => go("csv")}>
                      Import a CSV from your platform
                    </button>
                    <button className={styles.button} onClick={() => go("cas")}>
                      Import India CAS (PDF)
                    </button>
                    <button className={styles.button} onClick={() => go("add")}>
                      Add one
                    </button>
                  </div>

                  {holdings.length === 0 ? (
                    <p className={styles.empty}>
                      No holdings yet. Import a CSV from Trading 212, Vanguard, Hargreaves Lansdown, AJ Bell or another
                      platform, or your India Consolidated Account Statement (CAS) from CAMS, KFintech, NSDL, or CDSL.
                    </p>
                  ) : (
                    <>
                      <label className={styles.toggle}>
                        <input type="checkbox" checked={useInAnswers} onChange={(e) => onUseInAnswers(e.target.checked)} />
                        <span>
                          <strong>Use my portfolio in answers</strong>
                          <span className={styles.hint}>Tickerwise sees these holdings when you ask about your money.</span>
                        </span>
                      </label>
                      <button
                        className={styles.primaryButton}
                        onClick={() => {
                          onReview();
                          onClose();
                        }}
                      >
                        Review my portfolio
                      </button>

                      {regular.length > 0 && (
                        <div className={styles.savings}>
                          <h3 className={styles.sectionTitle}>What your regular plans cost</h3>
                          <p className={styles.hint}>
                            {regular.length} of your funds {regular.length === 1 ? "is a regular plan" : "are regular plans"}, which
                            pay a distributor a commission out of your money every year. Each has a direct plan that holds the same
                            investments without it.
                          </p>
                          {!savings ? (
                            <button
                              className={styles.button}
                              disabled={savingsBusy}
                              onClick={async () => {
                                setSavingsBusy(true);
                                try {
                                  setSavings(await directSavings(regular.map((h) => ({ isin: h.isin as string, units: h.quantity }))));
                                } catch {
                                  setMessage({ text: "Couldn't work this out right now. Please try again.", error: true });
                                } finally {
                                  setSavingsBusy(false);
                                }
                              }}
                            >
                              {savingsBusy ? "Comparing with direct plans…" : "Work out what they cost me"}
                            </button>
                          ) : savings.error ? (
                            <p className={styles.error}>{savings.error}</p>
                          ) : (
                            <>
                              <table className={`${styles.holdings} ${styles.savingsTable}`}>
                                <thead>
                                  <tr>
                                    <th>Fund</th>
                                    <th>Value</th>
                                    <th>Cost a year</th>
                                    <th>This year</th>
                                    <th>Over 10 years</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {savings.funds.map((f) => (
                                    <tr key={f.isin}>
                                      <td>
                                        <span className={styles.holdingName}>{f.name ?? f.isin}</span>
                                        <span className={styles.hint}>
                                          {f.error ??
                                            f.note ??
                                            `Direct grew ${f.direct_growth_pct}% a year vs ${f.regular_growth_pct}% over ${f.years_compared} years`}
                                        </span>
                                      </td>
                                      <td>{inr(f.value_inr)}</td>
                                      <td>{f.gap_pct_per_year === undefined ? "–" : `${f.gap_pct_per_year}%`}</td>
                                      <td>{inr(f.cost_this_year_inr)}</td>
                                      <td>{inr(f.cost_over_10_years_inr)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr>
                                    <td>Total</td>
                                    <td>{inr(savings.total_value_inr)}</td>
                                    <td />
                                    <td>{inr(savings.total_cost_this_year_inr)}</td>
                                    <td>{inr(savings.total_cost_over_10_years_inr)}</td>
                                  </tr>
                                </tfoot>
                              </table>
                              <p className={styles.hint}>{savings.notes}</p>
                              <button
                                className={styles.button}
                                onClick={() => {
                                  onAsk("My regular-plan mutual funds: what do they cost me compared with direct plans, and what should I think about before moving?");
                                  onClose();
                                }}
                              >
                                Ask Tickerwise what to consider
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      {grouped.map(([account, list]) => (
                        <div key={account} className={styles.holdingGroup}>
                          <h3 className={styles.sectionTitle}>
                            {ACCOUNT_LABELS[account]} · {list.length}
                          </h3>
                          <table className={styles.holdings}>
                            <thead>
                              <tr>
                                <th>Holding</th>
                                <th>Quantity</th>
                                <th>Average cost</th>
                                <th aria-label="Actions" />
                              </tr>
                            </thead>
                            <tbody>
                              {list.map((h) => (
                                <tr key={h.id}>
                                  <td>
                                    <span className={styles.holdingName}>{h.name}</span>
                                    {h.symbol ? (
                                      <span className={styles.hint}>
                                        {h.symbol}
                                        {h.plan ? ` · ${h.plan} plan` : ""}
                                      </span>
                                    ) : (
                                      <input
                                        className={`${styles.input} ${styles.tickerFix}`}
                                        placeholder="Not matched: add ticker"
                                        aria-label={`Ticker for ${h.name}`}
                                        onKeyDown={(e) => e.key === "Enter" && fixSymbol(h, e.currentTarget.value)}
                                        onBlur={(e) => fixSymbol(h, e.currentTarget.value)}
                                      />
                                    )}
                                  </td>
                                  <td>{+h.quantity.toFixed(4)}</td>
                                  <td>{fmt(h.avgCost, h.currency)}</td>
                                  <td>
                                    <button className={styles.remove} onClick={() => onRemove([h.id])} aria-label={`Remove ${h.name}`}>
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                      <button className={styles.linkButton} onClick={() => onRemove("all")}>
                        Remove all holdings
                      </button>
                    </>
                  )}
                </section>
              )}

              {view === "add" && (
                <section>
                  <div className={styles.grid}>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Name or ticker</span>
                      <input className={styles.input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. VUSA, Vanguard LifeStrategy 80, RELIANCE" />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Shares or units</span>
                      <input className={styles.input} inputMode="decimal" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Average cost per share (optional)</span>
                      <input className={styles.input} inputMode="decimal" value={draft.cost} onChange={(e) => setDraft({ ...draft, cost: e.target.value })} />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Currency</span>
                      <select className={styles.input} value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value })}>
                        {CURRENCIES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Account</span>
                      <select className={styles.input} value={draft.account} onChange={(e) => setDraft({ ...draft, account: e.target.value as AccountType })}>
                        {accounts.map((a) => (
                          <option key={a} value={a}>
                            {ACCOUNT_LABELS[a]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className={styles.buttonRow}>
                    <button
                      className={styles.primaryButton}
                      disabled={busy || !draft.name.trim() || !(Number(draft.quantity) > 0)}
                      onClick={() =>
                        importDrafts(
                          [
                            {
                              name: draft.name.trim(),
                              ticker: /^[A-Za-z0-9.^-]{1,15}$/.test(draft.name.trim()) ? draft.name.trim() : "",
                              isin: "",
                              quantity: Number(draft.quantity),
                              avgCost: draft.cost ? Number(draft.cost) : null,
                              currency: draft.currency,
                              account: draft.account,
                            },
                          ],
                          "manual"
                        ).then(() => setDraft({ ...draft, name: "", quantity: "", cost: "" }))
                      }
                    >
                      Add holding
                    </button>
                    <button className={styles.button} onClick={() => go("list")}>
                      Cancel
                    </button>
                  </div>
                </section>
              )}

              {view === "csv" && (
                <section>
                  <p className={styles.intro}>
                    Download your holdings (or, for Trading 212, your history) as a CSV from your platform, then choose it
                    here. It&apos;s read in your browser; only the holdings are saved.
                  </p>
                  <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && loadCsv(e.target.files[0])} className={styles.file} />
                  {rows && mapping && (
                    <>
                      {t212 ? (
                        <p className={styles.notice}>
                          This looks like a Trading 212 history export: trades are added up into what you hold now.
                        </p>
                      ) : (
                        <div className={styles.grid}>
                          {(Object.keys(FIELD_LABELS) as Field[]).map((f) => (
                            <label key={f} className={styles.field}>
                              <span className={styles.fieldLabel}>{FIELD_LABELS[f]}</span>
                              <select className={styles.input} value={mapping[f]} onChange={(e) => setMapping({ ...mapping, [f]: Number(e.target.value) })}>
                                <option value={-1}>Not in this file</option>
                                {rows[0].map((h, i) => (
                                  <option key={i} value={i}>
                                    {h || `Column ${i + 1}`}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ))}
                          <label className={styles.field}>
                            <span className={styles.fieldLabel}>Currency (if not in the file)</span>
                            <select className={styles.input} value={csvCurrency} onChange={(e) => setCsvCurrency(e.target.value)}>
                              {CURRENCIES.map((c) => (
                                <option key={c}>{c}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                      )}
                      <label className={styles.field}>
                        <span className={styles.fieldLabel}>Which account is this?</span>
                        <select className={styles.input} value={csvAccount} onChange={(e) => setCsvAccount(e.target.value as AccountType)}>
                          {accounts.map((a) => (
                            <option key={a} value={a}>
                              {ACCOUNT_LABELS[a]}
                            </option>
                          ))}
                        </select>
                      </label>
                      {deposits.length > 0 && (
                        <p className={styles.notice}>
                          Also found {deposits.length} {deposits.length === 1 ? "payment" : "payments"} in or out (net{" "}
                          {pounds(deposits.reduce((sum, c) => sum + c.amount, 0))}), which will count towards your{" "}
                          {ISA_LABELS[isaKind ?? "ss"]} allowance. Withdrawals free allowance up again in the same tax
                          year, as Trading 212&apos;s ISA is flexible.
                        </p>
                      )}
                      <p className={styles.hint}>
                        {preview.length} holdings found
                        {preview.length ? `: ${preview.slice(0, 4).map((d) => `${d.name} (${+d.quantity.toFixed(4)})`).join(", ")}${preview.length > 4 ? "…" : ""}` : ""}
                      </p>
                    </>
                  )}
                  <div className={styles.buttonRow}>
                    <button
                      className={styles.primaryButton}
                      disabled={busy || !preview.length}
                      onClick={async () => {
                        if (deposits.length) await onAddContributions(deposits);
                        await importDrafts(preview, "csv");
                      }}
                    >
                      {busy ? "Importing…" : `Import ${preview.length || ""} holdings`}
                    </button>
                    <button className={styles.button} onClick={() => go("list")}>
                      Cancel
                    </button>
                  </div>
                </section>
              )}

              {view === "cas" && (
                <section>
                  <p className={styles.intro}>
                    Your Consolidated Account Statement lists every mutual fund you hold, across all fund houses. Request
                    a <strong>detailed</strong> CAS by email from CAMS or KFintech (or download one from NSDL or CDSL), then
                    choose the PDF here.
                  </p>
                  <input type="file" accept="application/pdf,.pdf" onChange={(e) => setCasFile(e.target.files?.[0] ?? null)} className={styles.file} />
                  {casFile && <p className={styles.hint}>Selected: {casFile.name}</p>}
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>PDF password</span>
                    <span className={styles.hint}>Usually your PAN in capitals, as set when you requested the statement.</span>
                    <input className={styles.input} type="password" autoComplete="off" value={casPassword} onChange={(e) => setCasPassword(e.target.value)} />
                  </label>
                  <p className={styles.hint}>
                    The statement is read once and discarded. Only the funds, units, and average costs are saved to your
                    account; your PAN, address, and folio numbers are never stored.
                  </p>
                  <div className={styles.buttonRow}>
                    <button
                      className={styles.primaryButton}
                      disabled={busy || !casFile || !casPassword}
                      onClick={async () => {
                        if (!casFile) return;
                        setBusy(true);
                        setMessage({ text: "Reading your statement…" });
                        try {
                          const found = await readCas(casFile, casPassword);
                          await onSave(found);
                          const missed = found.filter((h) => !h.symbol).length;
                          const regular = found.filter((h) => h.plan === "regular").length;
                          setView("list");
                          setMessage({
                            text: `Added ${found.length} funds from your statement.${missed ? ` ${missed} couldn't be matched to a price.` : ""}${
                              regular === 1
                                ? " 1 is a regular plan, which pays a distributor commission every year."
                                : regular
                                  ? ` ${regular} are regular plans, which pay a distributor commission every year.`
                                  : ""
                            }`,
                          });
                          setCasPassword("");
                          setCasFile(null);
                        } catch (e) {
                          setMessage({ text: e instanceof Error ? e.message : "The statement couldn't be read.", error: true });
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {busy ? "Reading…" : "Import statement"}
                    </button>
                    <button className={styles.button} onClick={() => go("list")}>
                      Cancel
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
