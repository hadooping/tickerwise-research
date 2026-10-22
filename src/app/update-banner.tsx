"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";

// How often an open page asks whether a new version is live: every 15 minutes, and when the person comes back to
// the tab, but not more than once a minute.
const EVERY = 15 * 60 * 1000;
const AT_MOST = 60 * 1000;

/** A banner offering a reload when a new version of the website goes live while the page is open, since an open
 *  tab keeps running the code it first loaded (charts and answers stay in their old form until it's reloaded).
 *  The version the page started with is the first one /version gives; any later, different one means a new
 *  deployment. A failed check is ignored and tried again next time. */
export default function UpdateBanner() {
  const [stale, setStale] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let first: string | null = null;
    let last = 0;
    const check = async () => {
      if (Date.now() - last < AT_MOST) return;
      last = Date.now();
      try {
        const res = await fetch("/version", { cache: "no-store" });
        const { version } = (await res.json()) as { version: string };
        if (first === null) first = version;
        else if (version !== first) setStale(true);
      } catch {
        // Offline or a failed request: nothing to show; the next check tries again.
      }
    };
    check();
    const timer = setInterval(check, EVERY);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!stale || hidden) return null;
  return (
    <div className={styles.updateBanner} role="status">
      <span>A new version of Tickerwise is available.</span>
      <button className={styles.updateReload} onClick={() => window.location.reload()}>
        Reload
      </button>
      <button className={styles.updateClose} onClick={() => setHidden(true)} aria-label="Not now">
        ×
      </button>
    </div>
  );
}
