"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import styles from "../../page.module.css";
import { TurnContent, type Turn } from "../../chat";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; title: string; turns: Turn[]; updated: string };

/** A thread someone shared by link: read-only, no account needed. */
export default function SharedThread() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let live = true;
    fetch(`/api/share/${encodeURIComponent(id)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(typeof body?.detail === "string" ? body.detail : "This shared thread couldn't be loaded.");
        return body;
      })
      .then((body) => {
        if (!live) return;
        document.title = `${body.title} · Tickerwise`;
        setState({ kind: "ready", title: body.title, turns: body.turns, updated: body.updated_at });
      })
      .catch((e) => live && setState({ kind: "error", message: e instanceof Error ? e.message : "This shared thread couldn't be loaded." }));
    return () => {
      live = false;
    };
  }, [id]);

  return (
    <div className={styles.shared}>
      <header className={styles.sharedBar}>
        <Link href="/" className={styles.sharedBrand}>
          tickerwise
        </Link>
        <Link href="/" className={styles.sharedCta}>
          Ask your own question →
        </Link>
      </header>

      <section className={styles.thread}>
        {state.kind === "loading" && <p className={styles.sharedNote}>Loading the shared thread…</p>}
        {state.kind === "error" && (
          <>
            <p className={styles.sharedNote}>{state.message}</p>
            <p className={styles.sharedNote}>
              <Link href="/">Go to Tickerwise</Link>
            </p>
          </>
        )}
        {state.kind === "ready" && (
          <>
            <p className={styles.sharedNote}>
              Shared from Tickerwise
              {state.updated &&
                ` · ${new Date(state.updated).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`}
              . Figures were correct when the answers were written and may have changed since. Research, not financial advice.
            </p>
            {state.turns.map((turn) => (
              <article key={turn.id} className={styles.turn}>
                <div className={styles.turnMain}>
                  <TurnContent turn={turn} />
                </div>
              </article>
            ))}
            <div className={styles.sharedEnd}>
              <Link href="/" className={styles.sharedCta}>
                Ask Tickerwise your own question →
              </Link>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
