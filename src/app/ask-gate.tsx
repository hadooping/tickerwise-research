"use client";

import { createContext, useContext } from "react";
import styles from "./retirement.module.css";

// Whether the person can ask another question today, for every "Ask Tickerwise" button in the
// cards. When a signed-out visitor has used their free questions, the button offers to sign in
// and asks the question as soon as they're back, rather than just turning grey.
export interface AskGate {
  mode: "ask" | "signin" | "out"; // signin: signed out with no free questions left; out: signed in, none left
  limit: number | null;
  userLimit: number;
  signInToAsk: (question: string) => void;
}

export const AskGateContext = createContext<AskGate>({ mode: "ask", limit: null, userLimit: 10, signInToAsk: () => {} });

/** A card's "Ask Tickerwise about this" button. question is worked out when it's clicked. */
export function AskButton({
  label,
  question,
  onAsk,
  disabled = false,
}: {
  label: string;
  question: () => string;
  onAsk: (question: string) => void;
  disabled?: boolean;
}) {
  const gate = useContext(AskGateContext);
  if (gate.mode === "signin") {
    return (
      <div className={styles.askGate}>
        <button className={styles.ask} onClick={() => gate.signInToAsk(question())}>
          Sign in to ask this →
        </button>
        <p className={styles.hint}>
          You&apos;ve used today&apos;s {gate.limit ?? 3} free questions. Sign in with Google for {gate.userLimit} a day, and
          we&apos;ll ask this as soon as you&apos;re back.
        </p>
      </div>
    );
  }
  return (
    <div className={styles.askGate}>
      <button className={styles.ask} disabled={disabled || gate.mode === "out"} onClick={() => onAsk(question())}>
        {label}
      </button>
      {gate.mode === "out" && (
        <p className={styles.hint}>You&apos;ve used today&apos;s {gate.limit} questions. They reset at midnight UK time.</p>
      )}
    </div>
  );
}
