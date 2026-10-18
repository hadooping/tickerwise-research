"use client";

import { useCallback, useRef, useState } from "react";
import styles from "./page.module.css";

/** A chart shown nearly full screen, for a closer look; Escape, the ✕ or a click outside closes it. */
export function ExpandDialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement | null>(null);
  // Opened as soon as it's attached, before the charts inside measure their width (which happens
  // in their effects, after this), so they draw at the dialog's real size.
  const attach = useCallback((dialog: HTMLDialogElement | null) => {
    ref.current = dialog;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog ref={attach} className={styles.expandDialog} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-label={title}>
      <div className={styles.expandBody}>
        <button className={styles.expandClose} onClick={onClose} aria-label="Close the larger chart">
          ✕
        </button>
        {children}
      </div>
    </dialog>
  );
}

/** The ⤢ button that opens a chart larger, and the dialog it opens. render draws the chart at the size given. */
export function Expandable({ title, render }: { title: string; render: (large: boolean) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={styles.expandButton} onClick={() => setOpen(true)} aria-label={`Show ${title} larger`} title="Show larger">
        ⤢
      </button>
      {open && (
        <ExpandDialog title={title} onClose={() => setOpen(false)}>
          {render(true)}
        </ExpandDialog>
      )}
    </>
  );
}
