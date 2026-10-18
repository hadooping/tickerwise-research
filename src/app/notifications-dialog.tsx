"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./settings.module.css";
import type { AppNotification, PushState } from "./notifications";

const KINDS = [
  { key: "deadlines", label: "Deadline reminders", hint: "ISA allowance before 5 April; India's 31 March tax-saving deadline; SIP step-ups" },
  { key: "results", label: "Results days", hint: "The day before a company on your watchlist reports, and when it has" },
  { key: "digest", label: "Weekly digest", hint: "Mondays: how your watchlist and portfolio moved last week" },
] as const;
export type NotifyKind = (typeof KINDS)[number]["key"];

const ago = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  if (mins < 48 * 60) return `${Math.round(mins / 60)} h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

export default function NotificationsDialog({
  open,
  onClose,
  signedIn,
  items,
  onOpenItem,
  onMarkAllRead,
  push,
  onPush,
  onTestPush,
  kinds,
  onKind,
  onSignIn,
}: {
  open: boolean;
  onClose: () => void;
  signedIn: boolean;
  items: AppNotification[];
  onOpenItem: (n: AppNotification) => void;
  onMarkAllRead: () => void;
  push: PushState;
  onPush: (on: boolean) => Promise<void>;
  onTestPush: () => Promise<number>;
  kinds: Record<NotifyKind, boolean>;
  onKind: (kind: NotifyKind, on: boolean) => void;
  onSignIn: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const unread = items.filter((n) => !n.readAt).length;

  return (
    <dialog ref={ref} className={styles.dialog} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-labelledby="notif-title">
      <div className={`${styles.panel} ${styles.panelSingle}`}>
        <header className={styles.head}>
          <h2 id="notif-title">Notifications</h2>
          <button className={styles.close} onClick={onClose} aria-label="Close notifications">
            ✕
          </button>
        </header>
        <div className={styles.body}>
          {!signedIn ? (
            <section>
              <p className={styles.intro}>
                Sign in to get reminders before ISA and tax deadlines, alerts on results days for companies you watch, and a
                weekly summary of your watchlist and portfolio.
              </p>
              <button className={styles.primaryButton} onClick={onSignIn}>
                Sign in with Google
              </button>
            </section>
          ) : (
            <>
              <div className={styles.pushRow}>
                <div>
                  <strong>Notifications on this device</strong>
                  <span className={styles.hint}>
                    {push === "on"
                      ? "On: alerts arrive even when Tickerwise isn't open."
                      : push === "denied"
                        ? "Blocked in your browser settings. Allow notifications for this site to turn them on."
                        : push === "needs-install"
                          ? "On iPhone and iPad: tap Share, then Add to Home Screen, and open Tickerwise from there to turn these on."
                          : push === "unsupported"
                            ? "This browser doesn't support notifications. They'll still appear here."
                            : "Off: you'll see them here when you open Tickerwise."}
                  </span>
                </div>
                {(push === "on" || push === "off") && (
                  <button
                    className={push === "on" ? styles.button : styles.primaryButton}
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setNote(null);
                      try {
                        await onPush(push !== "on");
                      } catch {
                        setNote("Couldn't change notifications on this device. Please try again.");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {push === "on" ? "Turn off" : "Turn on"}
                  </button>
                )}
              </div>
              {push === "on" && (
                <button
                  className={styles.linkButton}
                  onClick={async () => setNote((await onTestPush()) ? "Test sent: it should appear in a moment." : "No device received it. Try turning notifications off and on again.")}
                >
                  Send a test
                </button>
              )}
              {note && <p className={styles.notice}>{note}</p>}

              <fieldset className={styles.field}>
                <legend>Notify me about</legend>
                {KINDS.map((k) => (
                  <label key={k.key} className={styles.toggle}>
                    <input type="checkbox" checked={kinds[k.key]} onChange={(e) => onKind(k.key, e.target.checked)} />
                    <span>
                      <strong>{k.label}</strong>
                      <span className={styles.hint}>{k.hint}</span>
                    </span>
                  </label>
                ))}
              </fieldset>

              <div className={styles.notifHead}>
                <h3 className={styles.sectionTitle}>Recent</h3>
                {unread > 0 && (
                  <button className={styles.linkButton} onClick={onMarkAllRead}>
                    Mark all read
                  </button>
                )}
              </div>
              {items.length === 0 ? (
                <p className={styles.empty}>Nothing yet. Reminders and alerts will appear here.</p>
              ) : (
                <ul className={styles.notifList}>
                  {items.map((n) => (
                    <li key={n.id}>
                      <button className={n.readAt ? "" : styles.notifUnread} onClick={() => onOpenItem(n)}>
                        <span className={styles.notifTitle}>
                          {n.title}
                          <span className={styles.hint}>{ago(n.createdAt)}</span>
                        </span>
                        <span className={styles.notifBody}>{n.body}</span>
                        <span className={styles.notifAction}>
                          {n.action === "isa" ? "Open ISA tracker →" : n.action === "portfolio" ? "Open My portfolio →" : "Ask Tickerwise →"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
