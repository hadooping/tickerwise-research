"use client";

import { useState } from "react";
import styles from "./settings.module.css";
import {
  ISA_LABELS,
  LIMITS_CHECKED,
  paymentsLeft,
  pounds,
  summarise,
  taxYearLabel,
  taxYearOf,
  type Contribution,
  type IsaType,
} from "./isa";

const TYPES: IsaType[] = ["ss", "lisa", "cash", "ifisa"];

/** This tax year's ISA allowance: used, left, the Lifetime ISA bonus, and a projection to 5 April. */
export default function IsaCard({
  contributions,
  monthly,
  onMonthly,
  onAdd,
  onRemove,
}: {
  contributions: Contribution[];
  monthly: number;
  onMonthly: (amount: number) => void;
  onAdd: (list: Contribution[]) => Promise<void>;
  onRemove: (ids: string[]) => Promise<void>;
}) {
  const today = new Date();
  const year = taxYearOf(today);
  const s = summarise(contributions, year, today);
  const [showList, setShowList] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    type: "ss" as IsaType,
    day: today.toISOString().slice(0, 10),
    provider: "",
    withdrawal: false,
  });
  const [error, setError] = useState<string | null>(null);

  const months = paymentsLeft(year, today);
  const projected = s.total + monthly * months;
  const endLabel = `5 April ${Number(year.slice(0, 4)) + 1}`;

  const add = async () => {
    const amount = Number(form.amount);
    if (!(amount > 0)) return;
    setError(null);
    try {
      await onAdd([
        {
          id: crypto.randomUUID(),
          taxYear: taxYearOf(form.day),
          type: form.type,
          amount: form.withdrawal ? -amount : amount,
          paidOn: form.day,
          provider: form.provider.trim() || null,
          source: "manual",
        },
      ]);
      setForm({ ...form, amount: "", provider: "", withdrawal: false });
    } catch {
      setError("Couldn't save that payment. Please try again.");
    }
  };

  return (
    <div className={styles.isa}>
      <div className={styles.isaHead}>
        <h3 className={styles.sectionTitle}>ISA allowance {taxYearLabel(year)}</h3>
        <span className={styles.hint}>
          {s.daysLeft} {s.daysLeft === 1 ? "day" : "days"} left · until {endLabel}
        </span>
      </div>

      <p className={styles.isaFigures}>
        <strong>{pounds(s.total)}</strong> used of {pounds(s.limits.overall)} ·{" "}
        <strong>{pounds(s.left)}</strong> left
      </p>

      {/* One bar for the whole allowance, split by type; the list below gives the same figures as text. */}
      <div
        className={styles.isaBar}
        role="img"
        aria-label={`${pounds(s.total)} of ${pounds(s.limits.overall)} used`}
      >
        {TYPES.filter((t) => s.byType[t] > 0).map((t) => (
          <span
            key={t}
            className={styles[`isa_${t}`]}
            style={{ width: `${Math.min(100, (s.byType[t] / s.limits.overall) * 100)}%` }}
          />
        ))}
      </div>
      <ul className={styles.isaLegend}>
        {TYPES.filter((t) => s.byType[t] > 0).map((t) => (
          <li key={t}>
            <span className={`${styles.isaKey} ${styles[`isa_${t}`]}`} />
            {ISA_LABELS[t]} <strong>{pounds(s.byType[t])}</strong>
          </li>
        ))}
      </ul>

      {s.byType.lisa > 0 && (
        <p className={styles.hint}>
          Lifetime ISA: {pounds(s.byType.lisa)} of {pounds(s.limits.lisa)} this year, so the government adds{" "}
          <strong>{pounds(s.lisaBonus)}</strong>. Taking money out other than for a first home or after 60 costs 25%.
        </p>
      )}
      {(s.overBy > 0 || s.lisaOverBy > 0 || s.cashOverBy > 0) && (
        <p className={styles.error} role="alert">
          {s.overBy > 0 && `You're ${pounds(s.overBy)} over this year's ${pounds(s.limits.overall)} allowance. `}
          {s.lisaOverBy > 0 && `The Lifetime ISA is ${pounds(s.lisaOverBy)} over its ${pounds(s.limits.lisa)} limit. `}
          {s.cashOverBy > 0 &&
            `If you're under 65, cash ISAs are ${pounds(s.cashOverBy)} over the ${pounds(s.limits.cashUnder65)} cash limit. `}
          Check with your provider: payments over the limit usually have to be returned.
        </p>
      )}

      <label className={styles.isaPlan}>
        <span>If I pay in</span>
        <input
          className={styles.input}
          inputMode="decimal"
          value={monthly || ""}
          placeholder="0"
          onChange={(e) => onMonthly(Math.max(0, Number(e.target.value.replace(/[£,]/g, "")) || 0))}
          aria-label="Monthly ISA payment in pounds"
        />
        <span>a month</span>
      </label>
      {monthly > 0 && (
        <p className={styles.hint}>
          {months} more {months === 1 ? "payment" : "payments"} before {endLabel} takes you to {pounds(projected)}:{" "}
          {projected <= s.limits.overall
            ? `${pounds(s.limits.overall - projected)} of allowance would go unused.`
            : `${pounds(projected - s.limits.overall)} over the allowance, so you'd need to stop or lower payments.`}{" "}
          Unused allowance can&apos;t be carried into the next tax year.
        </p>
      )}

      <button className={styles.linkButton} onClick={() => setShowList(!showList)} aria-expanded={showList}>
        {showList ? "Hide payments" : `Payments (${contributions.length}) · add a payment`}
      </button>

      {showList && (
        <div className={styles.isaPayments}>
          <div className={styles.isaAdd}>
            <input className={styles.input} type="date" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} aria-label="Date paid" />
            <input
              className={styles.input}
              inputMode="decimal"
              placeholder="Amount (£)"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              aria-label="Amount in pounds"
            />
            <select className={styles.input} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as IsaType })} aria-label="ISA type">
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {ISA_LABELS[t]}
                </option>
              ))}
            </select>
            <input
              className={styles.input}
              placeholder="Provider (optional)"
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value })}
              aria-label="Provider"
            />
            <label className={styles.isaCheck}>
              <input type="checkbox" checked={form.withdrawal} onChange={(e) => setForm({ ...form, withdrawal: e.target.checked })} />
              Withdrawal from a flexible ISA
            </label>
            <button className={styles.button} onClick={add} disabled={!(Number(form.amount) > 0)}>
              Add
            </button>
          </div>
          {error && <p className={styles.error}>{error}</p>}
          {contributions.length > 0 && (
            <table className={styles.isaTable}>
              <tbody>
                {contributions.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className={styles.holdingName}>{ISA_LABELS[c.type]}</span>
                      <span className={styles.hint}>
                        {new Date(`${c.paidOn}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        {c.provider ? ` · ${c.provider}` : ""} · {taxYearLabel(c.taxYear)}
                      </span>
                    </td>
                    <td>{c.amount < 0 ? `−${pounds(-c.amount)}` : pounds(c.amount)}</td>
                    <td>
                      <button className={styles.remove} onClick={() => onRemove([c.id])} aria-label="Remove payment">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <p className={styles.hint}>
        Limits checked against GOV.UK on {LIMITS_CHECKED}{s.limits.confirmed ? "" : " (not yet confirmed for this year)"}. From 6
        April 2027, people under 65 can put at most £12,000 a year into cash ISAs. The government is consulting on a First
        Time Buyer ISA that may replace the Lifetime ISA.
      </p>
    </div>
  );
}
