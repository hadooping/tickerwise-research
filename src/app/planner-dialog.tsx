"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./retirement.module.css";
import RetirementCard from "./retirement-card";
import InheritanceCard from "./inheritance-card";
import MortgageCard from "./mortgage-card";
import type { PlanInput } from "./retirement";
import type { EstateInput } from "./inheritance";
import type { MortgageInput } from "./mortgage";

const TABS = [
  { key: "retirement", label: "Retirement" },
  { key: "mortgage", label: "Mortgage or invest" },
  { key: "inheritance", label: "Inheritance tax" },
] as const;

/** The retirement planner, overpay the mortgage or invest, and the inheritance tax estimate, from the sidebar. */
export default function PlannerDialog({
  open,
  onClose,
  retirement,
  estate,
  mortgage,
  onAsk,
  disabled,
}: {
  open: boolean;
  onClose: () => void;
  retirement: PlanInput;
  estate: EstateInput;
  mortgage: MortgageInput;
  onAsk: (question: string) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("retirement");
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const ask = (q: string) => {
    onClose();
    onAsk(q);
  };

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label="Planners"
    >
      <div className={styles.tabs} role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <button className={styles.dialogClose} onClick={onClose} aria-label="Close">
        ✕
      </button>
      {open &&
        (tab === "retirement" ? (
          <RetirementCard key={`r-${retirement.country}`} initial={retirement} disabled={disabled} onAsk={ask} />
        ) : tab === "mortgage" ? (
          <MortgageCard key={`m-${mortgage.country}`} initial={mortgage} disabled={disabled} onAsk={ask} />
        ) : (
          <InheritanceCard key={`i-${estate.country}`} initial={estate} disabled={disabled} onAsk={ask} />
        ))}
    </dialog>
  );
}
