"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "../privacy/privacy.module.css";
import { supabase } from "../account";
import { deviceHeaders } from "../device";

type State = { kind: "idle" | "sending" | "sent" } | { kind: "error"; message: string };

/** A message to the people who run Tickerwise, saved to the database (no email needed). */
export default function Feedback() {
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setState({ kind: "sending" });
    try {
      // Signed-in people send their token, so the daily limit counts their account.
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...deviceHeaders(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ message: message.trim(), contact: contact.trim() }),
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => null))?.detail;
        throw new Error(typeof detail === "string" ? detail : "Your message couldn't be sent just now. Please try again later.");
      }
      setState({ kind: "sent" });
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Your message couldn't be sent." });
    }
  };

  return (
    <main className={styles.page}>
      <Link href="/" className={styles.back}>
        ← Back to Tickerwise
      </Link>
      <h1>Send feedback</h1>

      {state.kind === "sent" ? (
        <>
          <p>Thank you. Your message has been sent, and we read every one.</p>
          <p>
            <Link href="/">Back to Tickerwise</Link>
          </p>
        </>
      ) : (
        <form className={styles.form} onSubmit={send}>
          <p>
            Found a problem, got an idea, or something wasn&apos;t clear? Tell us here. If something went wrong, say what you
            asked and what happened. Please leave out personal or financial details such as account numbers.
          </p>
          <p>
            Only Tickerwise sees this message. To report in public, where others can add to it and follow what happens,{" "}
            <a href="https://github.com/hadooping/tickerwise-research/issues/new/choose">open an issue on GitHub</a>.
          </p>

          <label htmlFor="message">Your message</label>
          <textarea
            id="message"
            rows={7}
            maxLength={2000}
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <span className={styles.count}>{message.length} / 2,000</span>

          <label htmlFor="contact">
            How to reach you <span className={styles.optional}>(optional)</span>
          </label>
          <input
            id="contact"
            type="text"
            maxLength={200}
            placeholder="An email address, if you'd like a reply"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />

          {state.kind === "error" && (
            <p className={styles.error} role="alert">
              {state.message}
            </p>
          )}

          <button type="submit" className={styles.submit} disabled={state.kind === "sending" || !message.trim()}>
            {state.kind === "sending" ? "Sending…" : "Send"}
          </button>
          <p className={styles.footnote}>
            Messages are stored privately and read only by the people who run Tickerwise. See the{" "}
            <Link href="/privacy">privacy policy</Link>.
          </p>
        </form>
      )}
    </main>
  );
}
