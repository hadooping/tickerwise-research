"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./settings.module.css";
import { loadShares, shareThread, shareUrl, stopSharing, type ShareLink } from "./share";

/** Share a thread by link: make it, copy it, update it to the latest answers, or stop sharing. */
export default function ShareDialog({
  thread,
  onClose,
}: {
  thread: { id: string; title: string; turns: unknown[]; updatedAt: number } | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [link, setLink] = useState<ShareLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (thread && !dialog.open) {
      setLink(loadShares()[thread.id] ?? null);
      setError(null);
      setCopied(false);
      dialog.showModal();
    }
    if (!thread && dialog.open) dialog.close();
  }, [thread]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const make = () =>
    run(async () => {
      if (!thread) return;
      const made = await shareThread(thread.id, thread.title, thread.turns);
      setLink(made);
      await copy(made);
    });

  const copy = async (l: ShareLink | null = link) => {
    if (!l) return;
    try {
      await navigator.clipboard.writeText(shareUrl(l.id));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const outdated = link && thread && thread.updatedAt > link.at;

  return (
    <dialog ref={ref} className={styles.dialog} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-labelledby="share-title">
      <div className={`${styles.panel} ${styles.panelSingle}`}>
        <header className={styles.head}>
          <h2 id="share-title">Share thread</h2>
          <button className={styles.close} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className={styles.body}>
          <section>
            <p className={styles.intro}>
              Anyone with the link can read this thread&apos;s questions and answers, with their sources, charts and planners,
              without signing in. Answers may mention things you told Tickerwise, such as your holdings or plans, so check
              before you share. Your settings, memory and portfolio aren&apos;t included.
            </p>

            {link ? (
              <>
                <input className={styles.shareLink} readOnly value={shareUrl(link.id)} onFocus={(e) => e.target.select()} aria-label="Share link" />
                <div className={styles.shareActions}>
                  <button className={styles.primaryButton} onClick={() => copy()} disabled={busy}>
                    {copied ? "Link copied" : "Copy link"}
                  </button>
                  {outdated && (
                    <button className={styles.linkButton} onClick={make} disabled={busy}>
                      Update to include the latest answers
                    </button>
                  )}
                  <button className={styles.dangerButton} onClick={() => run(async () => { if (thread) await stopSharing(thread.id); setLink(null); })} disabled={busy}>
                    Stop sharing
                  </button>
                </div>
                {!outdated && <p className={styles.shareNote}>The link shows the thread as it was when you shared it. New questions aren&apos;t added unless you update it.</p>}
              </>
            ) : (
              <button className={styles.primaryButton} onClick={make} disabled={busy}>
                {busy ? "Making a link…" : "Make a link and copy it"}
              </button>
            )}
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
          </section>
        </div>
      </div>
    </dialog>
  );
}
