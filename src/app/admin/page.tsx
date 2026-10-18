"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import page from "../privacy/privacy.module.css";
import styles from "../retirement.module.css";
import DataChart, { type FigureData } from "../data-chart";
import { supabase } from "../account";

interface Person {
  email: string | null;
  joined: string | null;
  last_sign_in: string | null;
  today: number;
  week: number;
  days_14: number;
  all_time: number;
  last_asked: string | null;
  last_asked_at: string | null;
  cost_14_days: number;
}

interface Summary {
  days: string[];
  costs: {
    per_day: Record<string, { cost: number; answers: number }>;
    today: number;
    total: number;
    answers: number;
    per_answer: number | null;
    split: { answer: number; searches: number; follow_ups: number; rewrite?: number };
    outcomes: Record<string, number>;
    recorded_since: string | null;
    caching: {
      saved: number;
      without: number;
      saved_pct: number | null;
      cached_pct: number | null;
      per_day: Record<string, number>;
    };
    speed: {
      answers: number;
      first_text_ms: { median: number | null; p90: number | null };
      total_ms: { median: number | null; p90: number | null };
      per_day: Record<string, number | null>;
    };
  } | null;
  people: {
    registered: number;
    new_7_days: number;
    signed_in_7_days: number;
    signed_in_30_days: number;
    asked_7_days: number;
    people: Person[];
    visitor_cost_14_days: number;
  };
  questions: Record<string, { users: number; visitors: number; people_users: number; people_visitors: number }>;
  totals: Record<string, number | null>;
  feedback: { at: string; message: string; contact: string | null; signed_in: boolean }[];
  top_companies: { key: string; count: number }[];
  top_questions: { key: string; count: number }[];
}

type State = { kind: "loading" } | { kind: "signed-out" } | { kind: "denied" } | { kind: "error"; message: string } | { kind: "ready"; s: Summary };

// Dollars, with cents shown down to a tenth of a cent, since one answer costs a few cents.
const usd = (v: number | null | undefined) =>
  v === null || v === undefined ? "–" : v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: v < 1 ? 3 : 2, maximumFractionDigits: v < 1 ? 3 : 2 });
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }) : "–");
const seconds = (ms: number | null | undefined) => (ms === null || ms === undefined ? "–" : `${(ms / 1000).toFixed(1)}s`);
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

/** For admins only (checked by the backend): feedback, questions asked each day and by each account, what answers
 *  cost, and what people search for. */
export default function Admin() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    (async () => {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token) return setState({ kind: "signed-out" });
      const res = await fetch("/api/admin/summary", { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 404) return setState({ kind: "denied" });
      if (!res.ok) return setState({ kind: "error", message: "The figures couldn't be loaded just now." });
      setState({ kind: "ready", s: await res.json() });
    })().catch(() => setState({ kind: "error", message: "The figures couldn't be loaded just now." }));
  }, []);

  return (
    <main className={page.page} style={{ maxWidth: 960 }}>
      <Link href="/" className={page.back}>
        ← Back to Tickerwise
      </Link>
      <h1>Admin</h1>
      {state.kind === "loading" && <p>Loading…</p>}
      {state.kind === "signed-out" && <p>Sign in on the home page first.</p>}
      {(state.kind === "denied" || state.kind === "error") && <p>{state.kind === "denied" ? "Page not found." : state.message}</p>}
      {state.kind === "ready" && <Dashboard s={state.s} />}
    </main>
  );
}

function Dashboard({ s }: { s: Summary }) {
  const t = s.totals;
  const fig: FigureData = {
    kind: "line",
    title: "Questions asked each day",
    unit: "number",
    labels: s.days.map((d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" })),
    series: [
      { name: "Signed in", values: s.days.map((d) => s.questions[d].users) },
      { name: "Visitors", values: s.days.map((d) => s.questions[d].visitors) },
    ],
    note: "From the daily question counts. Visitors are counted by browser; the per-address backstop isn't double-counted.",
  };
  const today = s.questions[s.days[s.days.length - 1]];
  const p = s.people;
  const c = s.costs;
  const label = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const costFig: FigureData | null = c && {
    kind: "bar",
    title: "What answers cost each day",
    unit: "USD",
    labels: s.days.map(label),
    series: [{ name: "Cost", values: s.days.map((d) => c.per_day[d]?.cost ?? 0) }],
    note: "Model tokens, web searches and follow-up suggestions, at the AI provider's list prices (US dollars). Includes answers that were stopped or failed part-way.",
  };
  return (
    <>
      <div className={styles.tiles} style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginTop: 20 }}>
        <Tile label="Questions today" value={t.questions_today} hint={`${today.people_users} signed in, ${today.people_visitors} visitors`} />
        <Tile label="Questions, last 14 days" value={t.questions_14_days} />
        <Tile label="Accounts" value={p.registered} hint={`all through Google; ${p.new_7_days} new this week`} />
        <Tile label="Signed in this week" value={p.signed_in_7_days} hint={`${p.signed_in_30_days} in the last 30 days`} />
        <Tile label="Asked a question this week" value={p.asked_7_days} hint="accounts" />
        <Tile label="Threads saved" value={t.threads_saved} />
        <Tile label="Shared links" value={t.shared_links} />
        <Tile label="Feedback messages" value={t.feedback_messages} />
      </div>

      <DataChart fig={fig} />

      <h2>Costs</h2>
      {!c ? (
        <p>Costs aren&apos;t being recorded yet: run supabase/question_costs.sql in the Supabase SQL editor.</p>
      ) : (
        <>
          <div className={styles.tiles} style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            <Tile label="Cost today" text={usd(c.today)} hint={`${c.per_day[s.days[s.days.length - 1]]?.answers ?? 0} answers`} />
            <Tile label="Cost, last 14 days" text={usd(c.total)} hint={`${c.answers} answers${c.recorded_since ? `, recorded since ${day(c.recorded_since)}` : ""}`} />
            <Tile label="Average per answer" text={usd(c.per_answer)} hint={`${usd(c.per_answer === null ? null : c.per_answer * 10)} for a full day of 10 questions`} />
          </div>
          <p className={styles.hint}>
            Last 14 days: answers {usd(c.split.answer)}, web searches {usd(c.split.searches)}, follow-up suggestions{" "}
            {usd(c.split.follow_ups)}, plain-English rewrites {usd(c.split.rewrite ?? 0)}. {c.outcomes.stopped ?? 0} stopped and {c.outcomes.failed ?? 0} failed part-way; visitors
            (not signed in) cost {usd(p.visitor_cost_14_days)}.
          </p>
          {costFig && <DataChart fig={costFig} />}

          <h2>Prompt caching</h2>
          <p className={styles.hint}>
            The instructions and tool descriptions are the same for every question, so they&apos;re kept in a cache and
            re-read at a twentieth of the normal price, instead of being sent in full each time. Saving the cache costs a
            little extra the first time.
          </p>
          <div className={styles.tiles} style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            <Tile label="Saved, last 14 days" text={usd(c.caching.saved)} hint={c.caching.saved_pct === null ? undefined : `${c.caching.saved_pct}% off the input cost`} />
            <Tile label="Input without caching" text={usd(c.caching.without)} hint={`would have cost; it cost ${usd(c.caching.without - c.caching.saved)}`} />
            <Tile label="Input read from the cache" text={c.caching.cached_pct === null ? "–" : `${c.caching.cached_pct}%`} hint="of all input words processed" />
          </div>
          <DataChart
            fig={{
              kind: "bar",
              title: "Saved by caching each day",
              unit: "USD",
              labels: s.days.map(label),
              series: [{ name: "Saved", values: s.days.map((d) => c.caching.per_day[d] ?? 0) }],
              note: "Against sending every input token at the full price, after the extra cost of saving the cache. Output isn't affected by caching.",
            }}
          />

          <h2>Answer speed</h2>
          {c.speed.answers === 0 ? (
            <p>No finished answers timed yet: timing starts once the latest lines of supabase/question_costs.sql have been run.</p>
          ) : (
            <>
              <div className={styles.tiles} style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                <Tile label="Until the first words appear" text={seconds(c.speed.first_text_ms.median)} hint={`typical (median); 9 in 10 within ${seconds(c.speed.first_text_ms.p90)}`} />
                <Tile label="Until the answer is complete" text={seconds(c.speed.total_ms.median)} hint={`typical (median); 9 in 10 within ${seconds(c.speed.total_ms.p90)}`} />
              </div>
              <DataChart
                fig={{
                  kind: "line",
                  title: "Typical time to a complete answer, each day",
                  unit: "number",
                  labels: s.days.map(label),
                  series: [{ name: "Seconds (median)", values: s.days.map((d) => (c.speed.per_day[d] == null ? null : Math.round(c.speed.per_day[d]! / 100) / 10)) }],
                  note: `Finished answers only, from the question being sent to the last word (follow-up suggestions come after). ${c.speed.answers} answers in the last 14 days.`,
                }}
              />
            </>
          )}
        </>
      )}

      <h2>Questions by account</h2>
      {p.people.length === 0 ? (
        <p>No accounts yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Account</th>
                <th scope="col">Today</th>
                <th scope="col">7 days</th>
                <th scope="col">14 days</th>
                <th scope="col">All time</th>
                <th scope="col">Cost, 14 days</th>
                <th scope="col">Last asked</th>
                <th scope="col">Joined</th>
              </tr>
            </thead>
            <tbody>
              {p.people.map((u, i) => (
                <tr key={u.email ?? i}>
                  <th scope="row">{u.email ?? "–"}</th>
                  <td>{u.today}</td>
                  <td>{u.week}</td>
                  <td>{u.days_14}</td>
                  <td>{u.all_time}</td>
                  <td>{c ? usd(u.cost_14_days) : "–"}</td>
                  <td>{u.last_asked_at ? when(u.last_asked_at) : day(u.last_asked)}</td>
                  <td>{day(u.joined)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className={styles.hint}>
        Counts come from the daily limits, so they start from when limits were switched on; accounts with no limit (yours)
        are counted from the answers recorded since costs began. &ldquo;Last asked&rdquo; shows the exact time (UK) for questions in
        the last 14 days since costs were recorded, and the day before that.
      </p>

      <h2>Latest feedback</h2>
      {s.feedback.length === 0 ? (
        <p>No feedback yet.</p>
      ) : (
        <table className={styles.table}>
          <tbody>
            {s.feedback.map((f, i) => (
              <tr key={i}>
                <th scope="row" style={{ verticalAlign: "top" }}>
                  {when(f.at)}
                  <span className={styles.hint} style={{ display: "block" }}>
                    {f.signed_in ? "signed in" : "visitor"}
                  </span>
                </th>
                <td className={styles.qualityCell}>
                  {f.message}
                  {f.contact && <span className={styles.hint}>Reply to: {f.contact}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Most looked up this week</h2>
      <Ranked rows={s.top_companies} empty="Nothing looked up yet this week." />
      <h2>Suggested questions clicked this week</h2>
      <Ranked rows={s.top_questions} empty="No suggestions clicked yet this week." />
    </>
  );
}

function Tile({ label, value, text, hint }: { label: string; value?: number | null; text?: string; hint?: string }) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileLabel}>{label}</span>
      <strong>{text ?? (value === null || value === undefined ? "–" : value.toLocaleString("en-GB"))}</strong>
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}

function Ranked({ rows, empty }: { rows: { key: string; count: number }[]; empty: string }) {
  if (!rows.length) return <p>{empty}</p>;
  return (
    <table className={styles.table}>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <th scope="row" style={{ whiteSpace: "normal" }}>
              {r.key}
            </th>
            <td>{r.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
