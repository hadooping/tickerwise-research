"use client";

import React, { useState, useEffect, useRef, useCallback, useId, useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./page.module.css";
import GrowthChart, { type ChartData } from "./growth-chart";
import DataChart, { type FigureData } from "./data-chart";
import PeerPanel, { type PeerData } from "./peer-panel";
import { pickStarters, questionsFor, ALL_STARTER_TEXTS, TOPIC_LABELS, suits, whereOf, type Locale, type Topic } from "./starter-questions";
import Onboarding from "./onboarding";
import { rehypeGlossary, meaningOf } from "./glossary";
import { rehypeMoves } from "./moves";
import { deviceHeaders } from "./device";
import { AskGateContext, type AskGate } from "./ask-gate";
import { rehypeRatingChanges, stepInfo, stepOf } from "./ratings";
import Trending, { type TrendingData } from "./trending";
import WatchlistCard, { type WatchQuote } from "./watchlist-card";
import RetirementCard from "./retirement-card";
import InheritanceCard from "./inheritance-card";
import ValuationCard from "./valuation-card";
import MortgageCard from "./mortgage-card";
import BondCard, { type BondsData } from "./bond-card";
import BondScenariosCard from "./bond-scenarios-card";
import ShareDialog from "./share-dialog";
import DividendPanel from "./dividend-panel";
import type { BondScenarioData } from "./bond-scenarios";
import PlannerDialog from "./planner-dialog";
import { defaultsFor, type PlanInput } from "./retirement";
import { estateDefaults, type EstateInput } from "./inheritance";
import type { ValuationData } from "./valuation";
import { mortgageDefaults, type MortgageInput } from "./mortgage";
import NotificationsDialog, { type NotifyKind } from "./notifications-dialog";
import {
  addToWatchlist,
  disablePush,
  enablePush,
  fetchNotifications,
  fetchWatchlist,
  markRead,
  pushState,
  removeFromWatchlist,
  type AppNotification,
  type PushState,
  type WatchItem,
} from "./notifications";
import SettingsDialog from "./settings-dialog";
import PortfolioDialog, { type View as PortfolioView } from "./portfolio-dialog";
import {
  deleteContributions,
  fetchContributions,
  isaForModel,
  saveContributions,
  summarise,
  taxYearOf,
  type Contribution,
} from "./isa";
import {
  deleteHoldings,
  fetchHoldings,
  importId,
  parseCsv,
  portfolioForModel,
  saveHoldings,
  type Draft,
  type DirectSavings,
  type Holding,
} from "./portfolio";
import {
  aboutMe,
  applyAppearance,
  exportJson,
  exportMarkdown,
  fetchAccountSettings,
  loadLocalSettings,
  MAX_MEMORIES,
  saveAccountSettings,
  saveLocalSettings,
  withDefaults,
  type Settings,
} from "./settings";

// Every suggestion Tickerwise itself writes; only these can appear as "Popular questions".
const ALL_STARTERS = ALL_STARTER_TEXTS;
const POPULAR_COUNT = 4;
import {
  supabase,
  toAccount,
  signInWithGoogle,
  signOut,
  fetchThreads,
  saveThreadRows,
  type Account,
  type ThreadRow as SavedThread,
} from "./account";

export interface Source {
  url: string;
  title: string;
}

export interface Turn {
  id: string;
  question: string;
  answer: string;
  steps: string[];
  sources: Source[];
  charts?: ChartData[];
  figures?: FigureData[]; // charts Tickerwise drew with show_chart
  related?: string[]; // follow-up questions suggested from this answer
  peers?: PeerData[];
  plans?: PlanInput[]; // retirement planners, filled in from the answer's plan_retirement calls
  estates?: EstateInput[]; // inheritance tax estimates, from estimate_inheritance_tax calls
  valuations?: ValuationData[]; // valuation cards, from value_company calls
  mortgages?: MortgageInput[]; // overpay or invest, from compare_overpay_or_invest calls
  bonds?: BondsData[]; // bond yield history, from get_bond_yields calls
  bondScenarios?: BondScenarioData[]; // from simulate_bond_scenarios calls
  done: boolean;
  error: string | null;
  stopped?: boolean; // the person pressed Stop; whatever was written so far is kept
  status?: string; // what's happening right now, shown until the answer starts
}

interface Thread {
  id: string;
  title: string;
  turns: Turn[];
  updatedAt: number;
  pinned?: boolean;
}

// Today's question allowance, from the backend. limit is null when there is no limit.
interface Quota {
  signed_in: boolean;
  limit: number | null;
  used: number;
  user_limit: number;
}

// Events streamed by /api/chat, one JSON object per line.
type StreamEvent =
  | { type: "step"; text: string }
  | { type: "sources"; sources: Source[] }
  | { type: "text"; text: string }
  | { type: "preamble" }
  | { type: "cite"; urls: string[] }
  | { type: "chart"; chart: ChartData }
  | { type: "figure"; figure: FigureData }
  | { type: "related"; questions: string[] }
  | { type: "peers"; peers: PeerData }
  | { type: "retirement"; plan: PlanInput }
  | { type: "inheritance"; estate: EstateInput }
  | { type: "valuation"; valuation: ValuationData }
  | { type: "mortgage"; mortgage: MortgageInput }
  | { type: "bonds"; bonds: BondsData }
  | { type: "bond_scenarios"; scenarios: BondScenarioData }
  | { type: "quota"; quota: Quota }
  | { type: "memory"; text: string }
  | { type: "done" }
  | { type: "reset" } // the plain-English rewrite was set aside; the original answer follows
  | { type: "withheld" } // the answer started repeating Tickerwise's instructions, so it's withdrawn
  | { type: "error"; message: string };

const API_BASE = "/api";
const STORAGE_KEY = "tickerwise.threads";
const MAX_THREADS = 30;
const NO_TURNS: Turn[] = [];
const VISIBLE_SOURCES = 4;


const STARTER_COUNT = 8;
const TOPIC_COUNT = 6; // questions shown when someone picks a topic to browse
// Remembers which My portfolio step someone was on when they went to sign in.
const AFTER_SIGN_IN = "tickerwise.afterSignIn";
// A question a signed-out visitor wanted to ask after using their free ones: asked once they're signed in.
const ASK_AFTER_SIGN_IN = "tickerwise.askAfterSignIn";

function signInToAsk(question: string) {
  try {
    window.localStorage.setItem(ASK_AFTER_SIGN_IN, question);
  } catch {
    // Without storage they sign in and ask again themselves.
  }
  signInWithGoogle();
}
const NEWS_COUNT = 2;
const CONTINUE_COUNT = 2;
// Threads quiet for this long are offered as "what's changed since" follow-ups.
const CONTINUE_AFTER_MS = 6 * 60 * 60 * 1000;
const CONTINUE_PROMPT =
  "What has changed since we last discussed this? Update the key figures and news, and say what's different.";

interface Starter {
  text: string; // what the button says
  kind: "evergreen" | "news" | "continue";
  threadId?: string; // for "continue": the thread to ask in
}

function shortTitle(title: string, max = 48) {
  return title.length > max ? `${title.slice(0, max - 1).trimEnd()}…` : title;
}

// Filled into the composer (not sent) so the person can swap in their own holdings.
const PORTFOLIO_TEMPLATE = `Review my portfolio (base currency GBP):
- 20 AAPL @ $190
- 10 MSFT @ $410
- 300 SHEL.L @ 2,700p
- 500 LGEN.L @ 230p
- 50 VUSA.L`;

// Citation markers are written into the answer as [n](<url>) links.
const CITE_MARKER = /\[\d+\]\(<[^>]*>\)/g;

// The line an answer holds where its chart belongs, in an answer about how a company is doing: the chart goes
// after "How it makes money" rather than above the whole answer. Spaces inside it are allowed ("<!-- chart -->").
// The text renderer shows HTML comments as text, so the mark is always taken out before the answer is shown.
const CHART_MARK = /<!--\s*chart\s*-->/i;

// The answer without any chart mark: whole marks anywhere, and the start of one at the very end, which is a mark
// still arriving while the answer streams in ("<!--ch"), so it never flashes up as text.
function withoutMark(text: string) {
  return text.replace(new RegExp(CHART_MARK.source, "gi"), "").replace(/<!?-?-?[\sa-z]*$/i, (tail) =>
    "<!--chart".startsWith(tail.replace(/\s/g, "").toLowerCase()) ? "" : tail
  );
}

// The answer as copied text: without citation markers or the chart's mark.
function plainAnswer(answer: string) {
  return withoutMark(answer.replace(CITE_MARKER, "")).trim();
}

function domainOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// A turn still streaming when the page closed will never finish.
function markInterrupted(th: Thread): Thread {
  return {
    ...th,
    turns: th.turns.map((t) => (!t.done && t.error === null ? { ...t, error: "This answer was interrupted." } : t)),
  };
}

// Pinned threads are always kept; the cap applies to the rest.
function keepThreads(threads: Thread[]) {
  const pinned = threads.filter((th) => th.pinned);
  const recent = threads.filter((th) => !th.pinned).slice(0, MAX_THREADS);
  return [...pinned, ...recent];
}

// Signed out, threads live only in this browser. Storage can be unavailable (private mode,
// blocked site data), so every access is guarded and the app works without it.
function loadThreads(): Thread[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const threads: Thread[] = raw ? JSON.parse(raw) : [];
    return threads.map(markInterrupted);
  } catch {
    return [];
  }
}

function saveThreads(threads: Thread[]) {
  try {
    if (threads.length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keepThreads(threads)));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Not saved; the current session still works.
  }
}

const toSaved = (th: Thread): SavedThread<Turn[]> => ({
  id: th.id,
  title: th.title,
  turns: th.turns,
  pinned: Boolean(th.pinned),
  updated_at: th.updatedAt,
});

const fromSaved = (row: SavedThread<Turn[]>): Thread =>
  markInterrupted({ id: row.id, title: row.title, turns: row.turns, pinned: row.pinned, updatedAt: row.updated_at });

// The account's threads, plus any made in this browser before signing in, newest first.
function mergeThreads(saved: Thread[], local: Thread[]) {
  const ids = new Set(saved.map((th) => th.id));
  return [...saved, ...local.filter((th) => !ids.has(th.id))].sort((a, b) => b.updatedAt - a.updatedAt);
}

function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M4 22l7-7 5 5 12-12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 8h7v7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 11.5l-7.8 7.8a5 5 0 01-7.1-7.1l8.5-8.5a3.3 3.3 0 014.7 4.7l-8.5 8.5a1.7 1.7 0 01-2.4-2.4l7.8-7.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <rect width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 16V11a6 6 0 1112 0v5l1.5 2h-15L6 16zM10 20a2 2 0 004 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SunsetIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 16a5 5 0 0110 0M3 16h18M12 4v4M4.9 8.9l1.4 1.4M19.1 8.9l-1.4 1.4M6 20h12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M3 13h18" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6L6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 20h8M12 16v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// The sidebar's theme switch: each click moves to the next theme. It's the same setting as
// Settings › Appearance, and works signed out (kept in the browser) as well as signed in.
const THEMES = [
  { key: "light", label: "Light", icon: <SunIcon /> },
  { key: "dark", label: "Dark", icon: <MoonIcon /> },
  { key: "system", label: "Match device", icon: <MonitorIcon /> },
] as const;

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

function PinIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 4h6l-1 6 4 4H6l4-4-1-6zM12 14v6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 20h4L19 9l-4-4L4 16v4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// One row in the sidebar: opens the thread, and a menu renames, pins, or deletes it.
function ThreadRow({
  thread,
  active,
  busy,
  onOpen,
  onRename,
  onTogglePin,
  onShare,
  onDelete,
}: {
  thread: Thread;
  active: boolean;
  busy: boolean;
  onOpen: () => void;
  onRename: (title: string) => void;
  onTogglePin: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(thread.title);
  const rowRef = useRef<HTMLLIElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);

  // Close the menu on a click elsewhere or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (!rowRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        moreRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const openMenu = () => {
    setConfirming(false);
    setMenuOpen((o) => !o);
  };

  const startRename = () => {
    setMenuOpen(false);
    setDraft(thread.title);
    setEditing(true);
  };

  const finishRename = (save: boolean) => {
    setEditing(false);
    const title = draft.trim();
    if (save && title && title !== thread.title) onRename(title);
  };

  return (
    <li ref={rowRef} className={`${styles.historyRow} ${active ? styles.historyActive : ""}`}>
      {editing ? (
        <input
          className={styles.historyRename}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => finishRename(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") finishRename(true);
            if (e.key === "Escape") finishRename(false);
          }}
          maxLength={120}
          aria-label="Thread name"
          autoFocus
          onFocus={(e) => e.target.select()}
        />
      ) : (
        <button className={styles.historyItem} onClick={onOpen} title={thread.title}>
          {thread.title}
        </button>
      )}
      {!editing && (
        <button
          ref={moreRef}
          className={`${styles.historyMore} ${menuOpen ? styles.historyMoreOpen : ""}`}
          onClick={openMenu}
          aria-label={`Options for ${thread.title}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <MoreIcon />
        </button>
      )}
      {menuOpen && (
        <div className={styles.historyMenu} role="menu">
          {confirming ? (
            <>
              <p className={styles.historyMenuNote}>Delete this thread? This can&apos;t be undone.</p>
              <button role="menuitem" className={styles.historyMenuDanger} onClick={onDelete} autoFocus>
                <TrashIcon /> Delete
              </button>
              <button role="menuitem" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button role="menuitem" onClick={startRename} autoFocus>
                <PencilIcon /> Rename
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onTogglePin();
                }}
              >
                <PinIcon /> {thread.pinned ? "Unpin" : "Pin"}
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onShare();
                }}
              >
                <ShareIcon /> Share
              </button>
              <button
                role="menuitem"
                className={styles.historyMenuDanger}
                onClick={() => setConfirming(true)}
                disabled={busy}
              >
                <TrashIcon /> Delete
              </button>
            </>
          )}
        </div>
      )}
    </li>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.5 5.5 0 01-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0012 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 010-4.6V6.6H1.3a12 12 0 000 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 001.3 6.6l4 3.1c.9-2.8 3.6-4.9 6.7-4.9z" />
    </svg>
  );
}

// Sign-in sits at the foot of the sidebar; it only appears when accounts are set up.
function AccountPanel({ account, sync }: { account: Account | null; sync: "idle" | "loading" | "error" }) {
  if (!supabase) return null;
  if (!account) {
    return (
      <div className={styles.account}>
        <button className={styles.googleBtn} onClick={() => signInWithGoogle()}>
          <GoogleIcon /> Sign in with Google
        </button>
        <p className={styles.accountHint}>Keep your threads on every device.</p>
      </div>
    );
  }
  return (
    <div className={styles.account}>
      <div className={styles.accountUser}>
        {account.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- a small remote avatar; no optimisation needed
          <img className={styles.avatar} src={account.avatar} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className={styles.avatar}>{account.name.slice(0, 1).toUpperCase()}</span>
        )}
        <span className={styles.accountName}>
          {account.name}
          <span className={styles.accountEmail}>{account.email}</span>
        </span>
        <button className={styles.signOut} onClick={() => signOut()}>
          Sign out
        </button>
      </div>
      {sync === "loading" && <p className={styles.accountHint}>Loading your threads…</p>}
      {sync === "error" && (
        <p className={styles.accountError} role="alert">
          Couldn&apos;t reach your account. Threads will save on your next change.
        </p>
      )}
    </div>
  );
}

const questionsLeft = (q: Quota | null) => (q && q.limit !== null ? Math.max(0, q.limit - q.used) : null);

// The sign-in token lets the backend count questions against the account, not the network address.
// Signed-out visitors are counted by this browser's ID (device.ts) as well.
async function authHeaders(): Promise<Record<string, string>> {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  return { ...deviceHeaders(), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// Visitors always see how many free questions are left; signed-in people once they're running low.
function QuotaNote({ quota }: { quota: Quota | null }) {
  const left = questionsLeft(quota);
  if (!quota || left === null) return null;
  const signIn = supabase && !quota.signed_in;

  if (left === 0) {
    return (
      <div className={styles.quotaOut} role="status">
        <p>
          {quota.signed_in
            ? `You've used today's ${quota.limit} questions. They reset at midnight UK time.`
            : `You've used today's ${quota.limit} free questions. Sign in for ${quota.user_limit} a day, or come back after midnight UK time.`}
        </p>
        {signIn && (
          <button className={styles.googleBtn} onClick={() => signInWithGoogle()}>
            <GoogleIcon /> Sign in with Google
          </button>
        )}
      </div>
    );
  }
  if (quota.signed_in && left > 3) return null;
  return (
    <p className={styles.quotaNote}>
      {left} of {quota.limit} {quota.signed_in ? "" : "free "}questions left today
      {signIn && (
        <>
          {" · "}
          <button className={styles.quotaLink} onClick={() => signInWithGoogle()}>
            Sign in for {quota.user_limit} a day
          </button>
        </>
      )}
    </p>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CornerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 10l-5 5 5 5M20 4v7a4 4 0 01-4 4H4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Numbered citation links render as small pills; other links open in a new tab.
// Plain text of a markdown node (hast), for spotting special tables by their headers.
type HastNode = { type: string; value?: string; tagName?: string; children?: HastNode[] };
function textOf(node: HastNode | undefined): string {
  if (!node) return "";
  return node.type === "text" ? (node.value ?? "") : (node.children ?? []).map(textOf).join("");
}

const BULL_BEAR = /^\s*(what could go right|bull|upside|strengths?|pros)\b.*\|\s*(what could go wrong|bear|downside|risks?|cons)\b/i;

// A glossary term: dotted underline, with its meaning shown on hover, focus, or tap. The visible
// tip is drawn by CSS from data attributes, so selecting and copying the answer doesn't pick it up;
// the hidden span gives screen readers the same meaning.
function Gloss({ term, children }: { term: string; children: React.ReactNode }) {
  const id = useId();
  const meaning = meaningOf(term);
  if (!meaning) return <>{children}</>;
  return (
    <span className={styles.gloss} tabIndex={0} aria-describedby={id} data-tip-term={term} data-tip={meaning}>
      {children}
      <span id={id} hidden>
        {term}: {meaning}
      </span>
    </span>
  );
}

const markdownComponents: Components = {
  span: ({ className, children, ...props }) => {
    const term = (props as Record<string, unknown>)["data-term"];
    return className === "gloss" && typeof term === "string" ? (
      <Gloss term={term}>{children}</Gloss>
    ) : (
      <span className={className}>{children}</span>
    );
  },
  // A two-column bull/bear table gets equal, wrapping columns with ▲/▼ headers.
  table: ({ node, children }) => {
    const head = (node?.children as HastNode[] | undefined)?.find((c) => c.tagName === "thead");
    const cells = (head?.children?.find((c) => c.tagName === "tr")?.children ?? []).filter((c) => c.tagName === "th");
    const bullBear = cells.length === 2 && BULL_BEAR.test(cells.map(textOf).join(" | "));
    return <table className={bullBear ? styles.bullBear : undefined}>{children}</table>;
  },
  // A table cell that is just an analyst rating ("Buy", "Overweight", "Hold") becomes a coloured badge.
  td: ({ children, style }) => {
    const text = React.Children.toArray(children).join("").trim();
    const step = text.length < 30 ? stepOf(text) : null;
    return (
      <td style={style}>
        {step ? (
          <span className={styles.ratingPill} style={{ background: stepInfo(step).color }}>
            {children}
          </span>
        ) : (
          children
        )}
      </td>
    );
  },
  a: ({ href, children }) => {
    const label = String(React.Children.toArray(children).join(""));
    const isCite = /^\d+$/.test(label);
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={isCite ? styles.cite : undefined}>
        {children}
      </a>
    );
  },
};

function Composer({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
  large,
  inputRef,
  onStop,
  onAttach,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop?: () => void; // while an answer is streaming, the send button becomes Stop
  onAttach?: (file: File) => void; // a platform CSV or India CAS PDF, for My portfolio
  disabled: boolean;
  placeholder: string;
  large?: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }
  }, [value, inputRef]);

  return (
    <form
      className={`${styles.composer} ${large ? styles.composerLarge : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <textarea
        ref={inputRef}
        className={styles.composerInput}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
        }}
        rows={1}
        aria-label="Message"
      />
      {onAttach && (
        <label className={styles.attachBtn} title="Import holdings: a CSV from your platform, or an India CAS PDF">
          <PaperclipIcon />
          <span className={styles.visuallyHidden}>Import holdings from a file</span>
          <input
            type="file"
            accept=".csv,text/csv,application/pdf,.pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = ""; // so choosing the same file again still triggers
              if (file) onAttach(file);
            }}
          />
        </label>
      )}
      {onStop ? (
        <button type="button" className={`${styles.sendBtn} ${styles.stopBtn}`} onClick={onStop} aria-label="Stop answering">
          <StopIcon />
        </button>
      ) : (
        <button type="submit" className={styles.sendBtn} disabled={!value.trim() || disabled} aria-label="Send">
          <ArrowUpIcon />
        </button>
      )}
    </form>
  );
}

// Turns a research step into a plain status line: "Searching: x" -> "Searching the web for "x"".
function statusFor(step: string) {
  const search = step.match(/^Searching: (.*)$/);
  return search ? `Searching the web for “${search[1]}”` : step.replace(/: .*/, "");
}

// Shown in place of the answer until its first words arrive, with a timer once it takes a while.
function StatusLine({ status }: { status: string }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className={styles.status} role="status" aria-live="polite">
      <span className={styles.statusDot} aria-hidden="true" />
      <span className={styles.statusText}>{status}…</span>
      {seconds >= 5 && <span className={styles.statusTime}>{seconds}s</span>}
    </div>
  );
}

function Steps({ turn }: { turn: Turn }) {
  const [open, setOpen] = useState(false);
  if (turn.steps.length === 0) return null;

  // While researching, show every step; afterwards, collapse to a summary.
  if (!turn.done && !turn.error) {
    return (
      <ul className={styles.steps}>
        {turn.steps.map((s, i) => (
          <li key={i} className={i === turn.steps.length - 1 ? styles.stepActive : undefined}>
            <SearchIcon />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    );
  }

  const searches = turn.steps.filter((s) => s.startsWith("Searching")).length;
  const lookups = turn.steps.filter((s) => /^(Getting|Analysing|Replaying)/.test(s)).length;
  const summary = [
    searches > 0 && `Searched ${searches} ${searches === 1 ? "time" : "times"}`,
    lookups > 0 && `${lookups} data ${lookups === 1 ? "lookup" : "lookups"}`,
  ].filter(Boolean).join(" · ");
  return (
    <div className={styles.stepsDone}>
      <button className={styles.stepsToggle} onClick={() => setOpen(!open)} aria-expanded={open}>
        <SearchIcon />
        {summary || "Research steps"}
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <ul className={styles.steps}>
          {turn.steps.map((s, i) => (
            <li key={i}>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Sources({ sources }: { sources: Source[] }) {
  const [showAll, setShowAll] = useState(false);
  if (sources.length === 0) return null;
  const shown = showAll ? sources : sources.slice(0, VISIBLE_SOURCES);
  const hidden = sources.length - shown.length;

  return (
    <div className={styles.sources}>
      {shown.map((s, i) => (
        <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className={styles.sourceCard} title={s.title}>
          <span className={styles.sourceTitle}>{s.title || domainOf(s.url)}</span>
          <span className={styles.sourceMeta}>
            <span className={styles.sourceNum}>{i + 1}</span>
            {domainOf(s.url)}
          </span>
        </a>
      ))}
      {hidden > 0 && (
        <button className={styles.sourceMore} onClick={() => setShowAll(true)}>
          +{hidden} more
        </button>
      )}
    </div>
  );
}

// Dividend histories from the answer's valuations, shown beside it with the competitor panels.
const dividendsOf = (turn: Turn) => (turn.valuations ?? []).flatMap((v) => (v.dividends ? [{ data: v.dividends, name: v.name }] : []));
// A turn gets the right-hand column on wide screens when it has competitors or dividends to show there.
const hasRail = (turn: Turn) => Boolean(turn.peers?.length) || dividendsOf(turn).length > 0;

/** Answer text as formatted text: bold, tables, links, the glossary's explanations, ratings and price moves. */
function Prose({ text }: { text: string }) {
  return (
    <div className={styles.prose}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeGlossary, rehypeRatingChanges, rehypeMoves]}
        components={markdownComponents}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

/** One question and its answer, with its sources, charts and cards: in the chat, and read-only on a
 *  shared thread's page (no onAsk, so the cards' "Ask Tickerwise" buttons are hidden). */
export function TurnContent({
  turn,
  onAsk,
  disabled = false,
  watched,
  onWatch,
}: {
  turn: Turn;
  onAsk?: (question: string) => void;
  disabled?: boolean;
  watched?: Set<string>;
  onWatch?: (company: { symbol: string; name: string }, on: boolean) => void;
}) {
  // With a chart and the mark in the answer, the answer is split at the mark and the chart drawn between the two
  // parts; otherwise charts go above the answer as before. While the answer streams in, the mark may not have
  // arrived yet, so the chart stays above until it does.
  const mark = turn.answer?.match(CHART_MARK);
  const at = mark?.index ?? -1;
  const inline = at >= 0 && Boolean(turn.figures?.length);
  return (
    <>
      <h2 className={styles.question}>{turn.question}</h2>

      <Steps turn={turn} />
      <Sources sources={turn.sources} />
      {turn.charts?.map((c, i) => <GrowthChart key={i} chart={c} />)}
      {!inline && turn.figures?.map((f, i) => <DataChart key={i} fig={f} />)}
      {turn.plans?.map((pl, i) => (
        <RetirementCard key={i} initial={pl} onAsk={onAsk} disabled={disabled} />
      ))}
      {turn.estates?.map((es, i) => (
        <InheritanceCard key={i} initial={es} onAsk={onAsk} disabled={disabled} />
      ))}
      {turn.bonds?.map((b, i) => (
        <BondCard key={i} data={b} onAsk={onAsk} disabled={disabled} />
      ))}
      {turn.bondScenarios?.map((b, i) => (
        <BondScenariosCard key={i} data={b} onAsk={onAsk} disabled={disabled} />
      ))}
      {turn.mortgages?.map((mo, i) => (
        <MortgageCard key={i} initial={mo} onAsk={onAsk} disabled={disabled} />
      ))}
      {turn.valuations?.map((v, i) => (
        <ValuationCard key={i} data={v} onAsk={onAsk} disabled={disabled} />
      ))}
      {hasRail(turn) ? (
        <div className={styles.peersInline}>
          {turn.peers?.map((p, i) => (
            <PeerPanel key={i} data={p} watched={watched} onWatch={onWatch} />
          ))}
          {dividendsOf(turn).map((dv, i) => (
            <DividendPanel key={i} data={dv.data} name={dv.name} />
          ))}
        </div>
      ) : null}

      <div className={styles.answerLabel}>
        <LogoMark size={16} />
        <span>Answer</span>
      </div>

      {turn.answer && inline ? (
        <>
          <Prose text={turn.answer.slice(0, at)} />
          {turn.figures?.map((f, i) => <DataChart key={i} fig={f} />)}
          <Prose text={withoutMark(turn.answer.slice(at + (mark?.[0].length ?? 0)))} />
        </>
      ) : turn.answer ? (
        // No chart to put at the mark (none was drawn, or it hasn't arrived): the mark is just taken out.
        <Prose text={withoutMark(turn.answer)} />
      ) : (
        !turn.error &&
        !turn.done && (
          <>
            <StatusLine status={turn.status ?? "Thinking about your question"} />
            <div className={styles.skeleton} aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </>
        )
      )}
    </>
  );
}

export default function Chat() {
  const [threads, setThreads] = useState<Thread[]>(loadThreads);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [account, setAccount] = useState<Account | null>(null);
  const [sync, setSync] = useState<"idle" | "loading" | "error">("idle");
  const [settings, setSettings] = useState<Settings>(loadLocalSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sharing, setSharing] = useState<Thread | null>(null); // the thread whose share dialog is open
  const [isAdmin, setIsAdmin] = useState(false); // shows the Admin link; the backend checks again on the page
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [retirementOpen, setRetirementOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [push, setPush] = useState<PushState>("unsupported");
  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  const [watchQuotes, setWatchQuotes] = useState<Record<string, WatchQuote>>({});
  // Opened from a push message (?notification=…): show the notifications once they've loaded.
  const fromPush = useRef(new URLSearchParams(window.location.search).get("notification"));
  // Where My portfolio opens, and with which file: from the attach button or after signing in.
  const [portfolioStart, setPortfolioStart] = useState<{
    key: number;
    view: PortfolioView;
    rows?: string[][];
    casFile?: File;
    message?: string;
  }>({ key: 0, view: "list" });
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const contributionsRef = useRef(contributions);
  useEffect(() => {
    contributionsRef.current = contributions;
  }, [contributions]);
  const holdingsRef = useRef(holdings);
  useEffect(() => {
    holdingsRef.current = holdings;
  }, [holdings]);
  // The latest settings for code outside render (the auth callback, ask), and whose account
  // they've been loaded from, so nothing is saved to an account before its own settings arrive.
  const settingsRef = useRef(settings);
  const signedInRef = useRef(false); // settings only go with questions from signed-in people
  const settingsFor = useRef<string | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  // Suggestions match the person's country: from their profile, else where they're browsing from.
  const [detected, setDetected] = useState<Locale>(null);
  const profileCountry = settings.profile.country;
  const locale: Locale = profileCountry === "uk" || profileCountry === "in" || profileCountry === "us"
    ? profileCountry
    : profileCountry === "other"
      ? null
      : detected;
  const plannerCountry = locale ?? "uk"; // where the planners start; they can switch country
  // Planning questions always appear: retirement and tax & inheritance, retirement first for
  // people saving for it or aged 40 and over.
  const wantsRetirement =
    /retire/i.test(settings.profile.goals) || settings.profile.age === "40-54" || settings.profile.age === "55+";
  const evergreen = useMemo(
    () => pickStarters(STARTER_COUNT, locale, wantsRetirement ? ["retirement", "legacy"] : ["legacy", "retirement"]),
    [locale, wantsRetirement]
  );
  // "Browse by topic" on the home page: the chosen topic and its questions.
  const [browse, setBrowse] = useState<{ topic: Topic; questions: string[] } | null>(null);
  // When the page opened; threads quiet since well before this get "what's changed" follow-ups.
  const [loadedAt] = useState(() => Date.now());
  const [news, setNews] = useState<string[]>([]);
  const [allNews, setAllNews] = useState<string[]>([]);
  const [trending, setTrending] = useState<TrendingData | null>(null);
  const outOfQuestions = questionsLeft(quota) === 0;
  // Out of questions and signed out: asking means signing in first (for more a day), then asking.
  const canSignInForMore = outOfQuestions && Boolean(supabase) && !quota?.signed_in;
  const askGate: AskGate = {
    mode: !outOfQuestions ? "ask" : canSignInForMore ? "signin" : "out",
    limit: quota?.limit ?? null,
    userLimit: quota?.user_limit ?? 10,
    signInToAsk,
  };

  const inputRef = useRef<HTMLTextAreaElement>(null);
  // The answer being streamed, so Stop can cancel it here and on the server.
  const abortRef = useRef<{ controller: AbortController; answerId: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  // What the account last stored, by thread id; null until the account's threads have loaded.
  const saved = useRef<Map<string, Thread> | null>(null);

  const active = threads.find((th) => th.id === activeId) ?? null;
  const turns = active?.turns ?? NO_TURNS;
  const accountId = account?.id ?? null;
  useEffect(() => {
    signedInRef.current = Boolean(account);
  }, [account]);

  // Sign-in state comes from Supabase. When the account changes, its threads load
  // (off the callback, since Supabase calls made inside it can deadlock).
  useEffect(() => {
    if (!supabase) return;
    let current: string | null = null;
    let cancelled = false;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user ? toAccount(session.user) : null;
      if ((next?.id ?? null) === current) return;
      current = next?.id ?? null;
      setAccount(next);

      if (!next) {
        // Signing out takes the account's threads off this screen; they stay in the account.
        if (saved.current) {
          saved.current = null;
          setThreads([]);
          setActiveId(null);
        }
        // The profile and memory belong to the account; keep only how the app looks.
        if (settingsFor.current) {
          settingsFor.current = null;
          setSettings((s) => withDefaults({ appearance: s.appearance }));
          setHoldings([]);
          setContributions([]);
          setNotifications([]);
          setWatchlist([]);
        }
        setSync("idle");
        return;
      }

      const id = next.id;
      setSync("loading");
      // Back from signing in to import something: reopen My portfolio at that step.
      try {
        const after = window.localStorage.getItem(AFTER_SIGN_IN) as PortfolioView | null;
        if (after) {
          window.localStorage.removeItem(AFTER_SIGN_IN);
          setPortfolioStart({
            key: Date.now(),
            view: after,
            message: after === "csv" || after === "cas" ? "You're signed in. Choose your file again to import it." : undefined,
          });
          setPortfolioOpen(true);
        }
      } catch {
        // Storage unavailable: they can open My portfolio themselves.
      }
      setTimeout(() => {
        fetchThreads<Turn[]>()
          .then((rows) => {
            if (cancelled || current !== id) return;
            const fromAccount = rows.map(fromSaved);
            saved.current = new Map(fromAccount.map((th) => [th.id, th]));
            // Threads started before signing in move into the account (the save effect uploads them).
            setThreads((prev) => mergeThreads(fromAccount, prev));
            saveThreads([]);
            setSync("idle");
          })
          .catch(() => {
            if (!cancelled && current === id) setSync("error");
          });
        // The account's settings, or this browser's if the account has none yet.
        fetchAccountSettings()
          .then((fromAccount) => {
            if (cancelled || current !== id) return;
            if (fromAccount) setSettings(fromAccount);
            else void saveAccountSettings(id, settingsRef.current).catch(() => {});
            settingsFor.current = id;
          })
          .catch(() => {});
        fetchContributions()
          .then((list) => !cancelled && current === id && setContributions(list))
          .catch(() => {});
        fetchHoldings()
          .then((list) => !cancelled && current === id && setHoldings(list))
          .catch(() => {});
        fetchWatchlist()
          .then((list) => !cancelled && current === id && setWatchlist(list))
          .catch(() => {});
        fetchNotifications()
          .then((list) => {
            if (cancelled || current !== id) return;
            setNotifications(list);
            if (fromPush.current) {
              fromPush.current = null;
              window.history.replaceState(null, "", window.location.pathname);
              setNotificationsOpen(true);
            }
          })
          .catch(() => {});
      }, 0);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  // Settings apply straight away and are kept in this browser; signed in, they're also saved
  // to the account a moment after the last change.
  useEffect(() => {
    settingsRef.current = settings;
    applyAppearance(settings.appearance);
    saveLocalSettings(settings);
    if (!accountId || settingsFor.current !== accountId) return;
    const timer = setTimeout(() => void saveAccountSettings(accountId, settings).catch(() => {}), 800);
    return () => clearTimeout(timer);
  }, [settings, accountId]);

  const updateSettings = (update: (s: Settings) => Settings) =>
    setSettings((s) => ({ ...update(s), updatedAt: Date.now() }));

  // Questions about today's market news, written once a day by the backend.
  useEffect(() => {
    fetch(`${API_BASE}/suggestions`)
      .then((res) => (res.ok ? res.json() : { news: [] }))
      // A random pair, so the UK, US, and India stories all get their turn.
      .then((data: { news?: string[] }) => {
        setAllNews(data.news ?? []);
        setNews([...(data.news ?? [])].sort(() => Math.random() - 0.5).slice(0, NEWS_COUNT));
      })
      .catch(() => {});
    fetch(`${API_BASE}/trending`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: (TrendingData & { region_code?: string }) | null) => {
        if (!data) return;
        setTrending(data);
        const code = data.region_code;
        setDetected(code === "uk" || code === "in" || code === "us" ? code : null);
      })
      .catch(() => {});
  }, []);

  // Today's allowance, fetched on load and whenever the person signs in or out.
  useEffect(() => {
    let cancelled = false;
    authHeaders()
      .then((headers) => fetch(`${API_BASE}/quota`, { headers }))
      .then((res) => (res.ok ? res.json() : null))
      .then((q: Quota | null) => {
        if (!cancelled && q) setQuota(q);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  // Signed out, threads save to this browser. Signed in, changed threads save to the account
  // a moment after the last change, so a streaming answer is written once it settles.
  useEffect(() => {
    if (!accountId) {
      saveThreads(threads);
      return;
    }
    const base = saved.current;
    if (!base) return;
    const timer = setTimeout(() => {
      const kept = keepThreads(threads);
      const keptIds = new Set(kept.map((th) => th.id));
      const upserts = kept.filter((th) => base.get(th.id) !== th);
      const deletes = [...base.keys()].filter((id) => !keptIds.has(id));
      if (!upserts.length && !deletes.length) return;
      saveThreadRows(accountId, upserts.map(toSaved), deletes)
        .then(() => {
          if (saved.current === base) saved.current = new Map(kept.map((th) => [th.id, th]));
          setSync("idle");
        })
        .catch(() => setSync("error"));
    }, 1000);
    return () => clearTimeout(timer);
  }, [threads, accountId]);

  // Scroll when a turn is added, not on every streamed token.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, activeId]);

  // Updates one turn in one thread, by id, so a reply lands in the right thread
  // even if the person has switched to another one while waiting.
  const updateTurn = (threadId: string, turnId: string, update: (t: Turn) => Turn) => {
    setThreads((prev) =>
      prev.map((th) =>
        th.id === threadId
          ? { ...th, turns: th.turns.map((t) => (t.id === turnId ? update(t) : t)) }
          : th
      )
    );
  };

  const applyEvent = (t: Turn, ev: StreamEvent): Turn => {
    switch (ev.type) {
      case "step":
        return { ...t, steps: [...t.steps, ev.text], status: statusFor(ev.text) };
      case "sources": {
        const known = new Set(t.sources.map((s) => s.url));
        const sources = [...t.sources, ...ev.sources.filter((s) => !known.has(s.url))];
        const read = sources.filter((s) => !s.url.includes("finance.yahoo.com")).length;
        return { ...t, sources, status: read ? `Reading ${read} ${read === 1 ? "source" : "sources"}` : t.status };
      }
      case "text":
        return { ...t, answer: t.answer + ev.text, status: "Writing the answer" };
      case "preamble":
        // Text written before a search was narration; move it to the steps.
        return {
          ...t,
          steps: t.answer.trim() ? [...t.steps, t.answer.trim()] : t.steps,
          answer: "",
        };
      case "cite": {
        const sources = [...t.sources];
        const markers = ev.urls.map((url) => {
          let n = sources.findIndex((s) => s.url === url);
          if (n === -1) {
            sources.push({ url, title: domainOf(url) });
            n = sources.length - 1;
          }
          return `[${n + 1}](<${url}>)`;
        });
        return { ...t, sources, answer: t.answer + markers.join("") };
      }
      case "chart":
        return { ...t, charts: [...(t.charts ?? []), ev.chart], status: "Comparing the results" };
      case "related":
        return { ...t, related: ev.questions };
      case "figure":
        return { ...t, figures: [...(t.figures ?? []), ev.figure], status: "Drawing the chart" };
      case "peers":
        return { ...t, peers: [...(t.peers ?? []), ev.peers], status: "Comparing with competitors" };
      case "retirement":
        return { ...t, plans: [...(t.plans ?? []), ev.plan], status: "Working out the plan" };
      case "inheritance":
        return { ...t, estates: [...(t.estates ?? []), ev.estate], status: "Working out the estimate" };
      case "bond_scenarios":
        return { ...t, bondScenarios: [...(t.bondScenarios ?? []), ev.scenarios], status: "Running bond scenarios" };
      case "bonds":
        return { ...t, bonds: [...(t.bonds ?? []), ev.bonds], status: "Looking at bond yields" };
      case "mortgage":
        return { ...t, mortgages: [...(t.mortgages ?? []), ev.mortgage], status: "Comparing overpaying with investing" };
      case "valuation":
        return { ...t, valuations: [...(t.valuations ?? []), ev.valuation], status: "Working out the valuation" };
      case "done":
        return { ...t, done: true };
      case "reset":
        // The plain-English rewrite was set aside; the original answer follows.
        return { ...t, answer: "" };
      case "withheld":
        return { ...t, answer: "", error: "Tickerwise can't share how it works internally. Try asking about an investment, an account or a tax rule." };
      case "error":
        return { ...t, error: ev.message };
      case "quota":
      case "memory":
        return t;
    }
  };

  // `prior` is the conversation the question builds on; it defaults to the whole thread.
  const ask = useCallback(
    async (text?: string, prior: Turn[] = turns, inThread: string | null = activeId, suggested = false) => {
      const question = (text ?? input).trim();
      if (!question || isLoading) return;
      if (outOfQuestions) {
        // A suggestion clicked after the free questions ran out: sign in, then it's asked.
        if (canSignInForMore) signInToAsk(question);
        return;
      }

      // Only completed turns go back to the model; failed ones are left out.
      const history = prior
        .filter((t) => t.done && !t.error && !t.stopped)
        .flatMap((t) => [
          { role: "user", content: t.question },
          { role: "assistant", content: plainAnswer(t.answer) },
        ]);

      const turnId = Date.now().toString();
      const threadId = inThread ?? `t${turnId}`;
      const newTurn: Turn = {
        id: turnId,
        question,
        answer: "",
        steps: [],
        sources: [],
        done: false,
        error: null,
        status: "Thinking about your question",
      };

      // The thread being written to moves to the top of the list.
      setThreads((prev) => {
        const existing = prev.find((th) => th.id === threadId);
        const updated: Thread = {
          id: threadId,
          title: existing?.title ?? question,
          turns: [...prior, newTurn],
          updatedAt: Date.now(),
        };
        return [updated, ...prev.filter((th) => th.id !== threadId)];
      });
      setActiveId(threadId);
      setInput("");
      setIsLoading(true);
      const controller = new AbortController();
      const answerId = crypto.randomUUID();
      abortRef.current = { controller, answerId };

      try {
        const res = await fetch(`${API_BASE}/chat`, {
          signal: controller.signal,
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await authHeaders()) },
          body: JSON.stringify({
            message: question,
            history,
            answer_id: answerId,
            suggested,
            about_me: [
              signedInRef.current ? aboutMe(settingsRef.current) : "",
              settingsRef.current.portfolioInAnswers ? portfolioForModel(holdingsRef.current) : "",
              settingsRef.current.portfolioInAnswers
                ? isaForModel(summarise(contributionsRef.current, taxYearOf(new Date())))
                : "",
            ]
              .filter(Boolean)
              .join("\n\n"),
            memory: signedInRef.current && settingsRef.current.memory.enabled,
          }),
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({ detail: res.statusText }));
          if (data.quota) setQuota(data.quota);
          throw new Error(data.detail || `Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finished = false;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const ev = JSON.parse(line) as StreamEvent;
            if (ev.type === "quota") {
              setQuota(ev.quota);
              continue;
            }
            if (ev.type === "memory") {
              const text = ev.text;
              setSettings((s) =>
                s.memory.items.some((m) => m.text.toLowerCase() === text.toLowerCase())
                  ? s
                  : {
                      ...s,
                      updatedAt: Date.now(),
                      memory: {
                        ...s.memory,
                        items: [{ id: crypto.randomUUID(), text, savedAt: Date.now() }, ...s.memory.items].slice(
                          0,
                          MAX_MEMORIES
                        ),
                      },
                    }
              );
              continue;
            }
            if (ev.type === "done" || ev.type === "error") finished = true;
            updateTurn(threadId, turnId, (t) => applyEvent(t, ev));
          }
        }
        if (!finished) throw new Error("The connection closed before the answer finished.");
      } catch (err: unknown) {
        if (controller.signal.aborted) {
          // Keep what was written so far; closing the connection also stops the research on the server.
          updateTurn(threadId, turnId, (t) => ({ ...t, done: true, stopped: true }));
          return;
        }
        const msg = err instanceof Error ? err.message : "Something went wrong.";
        updateTurn(threadId, turnId, (t) => ({ ...t, error: msg }));
      } finally {
        abortRef.current = null;
        setIsLoading(false);
      }
    },
    [input, isLoading, outOfQuestions, canSignInForMore, turns, activeId]
  );

  // Whether to show the Admin link: the backend decides, so admin emails never appear in the website.
  useEffect(() => {
    if (!accountId) return;
    let live = true;
    void authHeaders()
      .then((headers) => fetch(`${API_BASE}/admin/check`, { headers }))
      .then((res) => (res.ok ? res.json() : { admin: false }))
      .then((r) => live && setIsAdmin(Boolean(r.admin)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [accountId]);

  // Back from signing in to ask a question: ask it once the new allowance has loaded.
  useEffect(() => {
    if (!account || !quota?.signed_in || outOfQuestions || isLoading) return;
    let pending: string | null = null;
    try {
      pending = window.localStorage.getItem(ASK_AFTER_SIGN_IN);
    } catch {
      return;
    }
    if (!pending) return;
    const question = pending;
    const timer = setTimeout(() => {
      try {
        window.localStorage.removeItem(ASK_AFTER_SIGN_IN);
      } catch {
        // Asked anyway; it may be offered again on the next visit.
      }
      void ask(question, NO_TURNS, null);
    }, 0);
    return () => clearTimeout(timer);
  }, [account, quota, outOfQuestions, isLoading, ask]);

  // Closing the connection stops the answer here; the server is told separately, because it
  // can't always see the connection close.
  const stop = () => {
    const current = abortRef.current;
    if (!current) return;
    current.controller.abort();
    fetch(`${API_BASE}/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer_id: current.answerId }),
      keepalive: true,
    }).catch(() => {});
  };

  const exportable = () =>
    keepThreads(threads).map((th) => ({
      title: th.title,
      updatedAt: th.updatedAt,
      pinned: th.pinned,
      turns: th.turns.map((t) => ({ question: t.question, answer: plainAnswer(t.answer), sources: t.sources })),
    }));

  // Everything this browser holds: chats, settings, and memory.
  const clearDevice = () => {
    setThreads([]);
    saveThreads([]);
    setActiveId(null);
    setSettings(withDefaults(null));
    saveLocalSettings(null);
  };

  // Deletes the account on the server, then signs out here and clears this browser.
  // ---- Notifications and watchlist ----

  // Whether this device gets push notifications (checked once; changed from the notifications panel).
  useEffect(() => {
    pushState()
      .then(setPush)
      .catch(() => {});
  }, []);

  // Today's price for each watched company or fund.
  useEffect(() => {
    if (!watchlist.length) return;
    let cancelled = false;
    fetch(`${API_BASE}/watchlist/quotes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbols: watchlist.map((w) => w.symbol) }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { quotes: WatchQuote[] } | null) => {
        if (!cancelled && data) setWatchQuotes(Object.fromEntries(data.quotes.map((q) => [q.symbol, q])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [watchlist]);

  const unread = notifications.filter((n) => !n.readAt).length;
  const watched = new Set(watchlist.map((w) => w.symbol));

  const toggleWatch = async (item: WatchItem, on: boolean) => {
    if (!accountId) return;
    if (on) {
      await addToWatchlist(accountId, item);
      setWatchlist((prev) => [...prev.filter((w) => w.symbol !== item.symbol), item]);
    } else {
      await removeFromWatchlist(item.symbol);
      setWatchlist((prev) => prev.filter((w) => w.symbol !== item.symbol));
    }
  };

  // Marked read straight away on screen; saved in the background.
  const readNotifications = async (ids: string[]) => {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, readAt: n.readAt ?? now } : n)));
    await markRead(ids).catch(() => {});
  };

  // Opening a notification does what it's for: asks its question, or opens the ISA tracker.
  const openNotification = (n: AppNotification) => {
    void readNotifications([n.id]);
    setNotificationsOpen(false);
    if (n.action === "isa" || n.action === "portfolio") openPortfolio();
    else ask(n.question ?? n.title, NO_TURNS, null);
  };

  const sendTestPush = async () => {
    const res = await fetch(`${API_BASE}/notify/test`, { method: "POST", headers: await authHeaders() });
    return res.ok ? (await res.json()).sent : 0;
  };

  // ---- My portfolio ----

  const openPortfolio = (
    view: PortfolioView = "list",
    extra: { rows?: string[][]; casFile?: File; message?: string } = {}
  ) => {
    setPortfolioStart({ key: Date.now(), view, ...extra });
    setPortfolioOpen(true);
    setDrawerOpen(false);
  };

  // A file from the attach button: CSVs go to the CSV import with columns already guessed,
  // PDFs to the CAS import. Signed out, the dialog explains that holdings need an account.
  const attachFile = async (file: File) => {
    const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
    const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";
    if (!isPdf && !isCsv) {
      openPortfolio("list", { message: "Tickerwise can import a CSV from your platform or an India CAS statement (PDF)." });
      return;
    }
    if (!account) {
      openPortfolio(isPdf ? "cas" : "csv");
      return;
    }
    if (isPdf) openPortfolio("cas", { casFile: file });
    else openPortfolio("csv", { rows: parseCsv(await file.text()) });
  };

  const saveToPortfolio = async (list: Holding[]) => {
    if (!accountId) return;
    await saveHoldings(accountId, list);
    setHoldings((prev) => {
      const byId = new Map(prev.map((h) => [h.id, h]));
      list.forEach((h) => byId.set(h.id, h));
      return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
    });
  };

  const removeFromPortfolio = async (ids: string[] | "all") => {
    await deleteHoldings(ids);
    setHoldings((prev) => (ids === "all" ? [] : prev.filter((h) => !ids.includes(h.id))));
  };

  const resolveSymbols = async (drafts: Draft[]): Promise<(string | null)[]> => {
    const res = await fetch(`${API_BASE}/portfolio/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({
        items: drafts.map((d) => ({ name: d.name, ticker: d.ticker, isin: d.isin, currency: d.currency })),
      }),
    });
    if (!res.ok) throw new Error("Couldn't match holdings to market prices. Please try again.");
    return (await res.json()).symbols;
  };

  const addContributions = async (list: Contribution[]) => {
    if (!accountId) return;
    await saveContributions(accountId, list);
    setContributions((prev) => {
      const byId = new Map(prev.map((c) => [c.id, c]));
      list.forEach((c) => byId.set(c.id, c));
      return [...byId.values()].sort((a, b) => b.paidOn.localeCompare(a.paidOn));
    });
  };

  const removeContributions = async (ids: string[]) => {
    await deleteContributions(ids);
    setContributions((prev) => prev.filter((c) => !ids.includes(c.id)));
  };

  const directSavings = async (funds: { isin: string; units: number }[]): Promise<DirectSavings> => {
    const res = await fetch(`${API_BASE}/portfolio/direct-savings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ funds }),
    });
    if (!res.ok) throw new Error("Couldn't compare with direct plans.");
    return res.json();
  };

  const readCas = async (file: File, password: string): Promise<Holding[]> => {
    const form = new FormData();
    form.append("file", file);
    form.append("password", password);
    const res = await fetch(`${API_BASE}/portfolio/cas`, { method: "POST", headers: await authHeaders(), body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail ?? "The statement couldn't be read.");
    type CasHolding = Omit<Holding, "id" | "source" | "avgCost"> & { avg_cost: number | null };
    return (data.holdings as CasHolding[]).map(({ avg_cost, ...h }) => ({
      ...h,
      avgCost: avg_cost,
      id: importId("cas", h.account, h.isin ?? h.name),
      source: "cas",
    }));
  };

  const deleteAccount = async (): Promise<string | null> => {
    try {
      const res = await fetch(`${API_BASE}/account/delete`, { method: "POST", headers: await authHeaders() });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return data.detail ?? "Your account couldn't be deleted. Please try again.";
      }
    } catch {
      return "Your account couldn't be deleted. Check your connection and try again.";
    }
    saved.current = null;
    settingsFor.current = null;
    await supabase?.auth.signOut({ scope: "local" }).catch(() => {});
    clearDevice();
    setSettingsOpen(false);
    return null;
  };

  // Re-asks a question using only the turns before it.
  const retry = (turn: Turn) => {
    const index = turns.findIndex((t) => t.id === turn.id);
    void ask(turn.question, turns.slice(0, index));
  };

  const copy = (turn: Turn) => {
    navigator.clipboard.writeText(plainAnswer(turn.answer));
    setCopiedId(turn.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const newThread = () => {
    if (isLoading) return;
    setActiveId(null);
    setInput("");
    setDrawerOpen(false);
    inputRef.current?.focus();
  };

  // The logo: from a thread, back to the home page; on the home page already, nothing.
  const goHome = () => {
    if (turns.length > 0) newThread();
  };

  const openThread = (id: string) => {
    if (isLoading) return;
    setActiveId(id);
    setInput("");
    setDrawerOpen(false);
  };

  const deleteThread = (id: string) => {
    if (isLoading && id === activeId) return;
    setThreads((prev) => prev.filter((th) => th.id !== id));
    if (id === activeId) setActiveId(null);
  };

  const editThread = (id: string, change: Partial<Thread>) =>
    setThreads((prev) => prev.map((th) => (th.id === id ? { ...th, ...change } : th)));

  const pinnedThreads = threads.filter((th) => th.pinned);
  const recentThreads = threads.filter((th) => !th.pinned);
  const threadRow = (th: Thread) => (
    <ThreadRow
      key={th.id}
      thread={th}
      active={th.id === activeId}
      busy={isLoading && th.id === activeId}
      onOpen={() => openThread(th.id)}
      onRename={(title) => editThread(th.id, { title })}
      onTogglePin={() => editThread(th.id, { pinned: !th.pinned })}
      onShare={() => setSharing(th)}
      onDelete={() => deleteThread(th.id)}
    />
  );

  const asked = new Set(turns.map((t) => t.question));
  // Follow-ups written for the latest answer (older threads saved without them show none).
  const related = (turns[turns.length - 1]?.related ?? []).filter((s) => !asked.has(s)).slice(0, 3);

  // Home page: follow-ups on the person's own quiet threads, today's news, then evergreen questions.
  const continuing: Starter[] = threads
    .filter((th) => loadedAt - th.updatedAt > CONTINUE_AFTER_MS && th.turns.some((t) => t.done && !t.error))
    .slice(0, CONTINUE_COUNT)
    .map((th) => ({ text: `What's changed since we looked at “${shortTitle(th.title)}”?`, kind: "continue", threadId: th.id }));
  const today: Starter[] = news.map((text): Starter => ({ text, kind: "news" }));
  const starters: Starter[] = [
    ...continuing,
    ...today,
    ...evergreen.map((text): Starter => ({ text, kind: "evergreen" })),
  ].slice(0, STARTER_COUNT);

  const askStarter = (s: Starter) => {
    const thread = s.threadId ? threads.find((th) => th.id === s.threadId) : undefined;
    if (thread) {
      setActiveId(thread.id);
      ask(CONTINUE_PROMPT, thread.turns, thread.id);
    } else {
      ask(s.text, NO_TURNS, null, true);
    }
  };

  // Only questions Tickerwise wrote itself are shown as popular, never anything a person typed.
  const popular = trending && {
    ...trending,
    questions: trending.questions
      .filter((q) => {
        const where = whereOf(q.text);
        return allNews.includes(q.text) || (ALL_STARTERS.has(q.text) && where !== undefined && suits(where, locale));
      })
      .slice(0, POPULAR_COUNT),
  };
  const showTrending = popular && (popular.companies.length > 0 || popular.questions.length > 0);
  const last = turns[turns.length - 1];

  return (
    <AskGateContext.Provider value={askGate}>
    <div className={styles.shell}>
      <aside className={`${styles.sidebar} ${drawerOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.sidebarHead}>
          <button className={styles.brand} onClick={goHome} aria-label="Tickerwise home">
            <LogoMark size={22} /> tickerwise
          </button>
          <button className={styles.drawerClose} onClick={() => setDrawerOpen(false)} aria-label="Close menu">
            <CloseIcon size={16} />
          </button>
        </div>

        <button className={styles.newBtn} onClick={newThread} disabled={isLoading}>
          <PlusIcon /> New thread
        </button>

        {threads.length > 0 && (
          <nav className={styles.history} aria-label="Threads">
            {pinnedThreads.length > 0 && (
              <>
                <div className={styles.historyLabel}>
                  <PinIcon size={12} /> Pinned
                </div>
                <ul>{pinnedThreads.map(threadRow)}</ul>
              </>
            )}
            {recentThreads.length > 0 && (
              <>
                <div className={styles.historyLabel}>Recent</div>
                <ul>{recentThreads.map(threadRow)}</ul>
              </>
            )}
          </nav>
        )}

        <button
          className={styles.settingsBtn}
          onClick={() => {
            setNotificationsOpen(true);
            setDrawerOpen(false);
            if (accountId) fetchNotifications().then(setNotifications).catch(() => {});
          }}
        >
          <BellIcon /> Notifications
          {unread > 0 && <span className={`${styles.badge} ${styles.badgeAlert}`}>{unread}</span>}
        </button>
        {/* My portfolio is for signed-in people only, so visitors don't see it. */}
        {account && (
          <button
            className={styles.settingsBtn}
            onClick={() => openPortfolio()}
          >
            <BriefcaseIcon /> My portfolio
            {holdings.length > 0 && <span className={styles.badge}>{holdings.length}</span>}
          </button>
        )}
        <button
          className={styles.settingsBtn}
          onClick={() => {
            setRetirementOpen(true);
            setDrawerOpen(false);
          }}
        >
          <SunsetIcon /> Planners
        </button>
        <a href="/help" className={styles.settingsBtn}>
          <HelpIcon /> Help &amp; FAQ
        </a>
        {isAdmin && account && (
          <a href="/admin" className={styles.settingsBtn}>
            <GearIcon /> Admin
          </a>
        )}
        {(() => {
          const i = Math.max(0, THEMES.findIndex((t) => t.key === settings.appearance.theme));
          const now = THEMES[i];
          const next = THEMES[(i + 1) % THEMES.length];
          return (
            <button
              className={styles.settingsBtn}
              onClick={() => updateSettings((s) => ({ ...s, appearance: { ...s.appearance, theme: next.key } }))}
              aria-label={`Theme: ${now.label}. Switch to ${next.label}`}
              title={`Switch to ${next.label}`}
            >
              {now.icon} Theme: {now.label}
            </button>
          );
        })()}
        {/* Settings are personal, so they're for signed-in people; the theme above works for everyone. */}
        {account && (
          <button
            className={styles.settingsBtn}
            onClick={() => {
              setSettingsOpen(true);
              setDrawerOpen(false);
            }}
          >
            <GearIcon /> Settings
          </button>
        )}
        <AccountPanel account={account} sync={sync} />
        {!account && threads.length > 0 && (
          <button
            className={styles.settingsBtn}
            onClick={() => {
              if (window.confirm("Remove every chat stored in this browser? This can't be undone.")) clearDevice();
            }}
          >
            Clear this device
          </button>
        )}
        <p className={styles.sidebarNote}>
          US, UK &amp; Indian markets. Research only, not financial advice. <a href="/help">Help</a> · <a href="/feedback">Feedback</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a>
        </p>
      </aside>

      {drawerOpen && <div className={styles.scrim} onClick={() => setDrawerOpen(false)} />}

      <ShareDialog thread={sharing} onClose={() => setSharing(null)} />

      <SettingsDialog
        open={settingsOpen && Boolean(account)}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={updateSettings}
        signedIn={Boolean(account)}
        email={account?.email ?? null}
        onExportMarkdown={() => exportMarkdown(exportable(), (a) => a)}
        onExportJson={() =>
          exportJson(exportable(), settings, account?.email ?? null, [...holdings, ...contributions.map((c) => ({ isaPayment: c }))])
        }
        onDeleteAccount={deleteAccount}
        onClearDevice={clearDevice}
      />

      <PlannerDialog
        open={retirementOpen}
        onClose={() => setRetirementOpen(false)}
        retirement={defaultsFor(plannerCountry, settings.profile.age)}
        estate={estateDefaults(plannerCountry)}
        mortgage={mortgageDefaults(plannerCountry)}
        onAsk={(q) => ask(q, NO_TURNS, null)}
        disabled={isLoading}
      />

      <NotificationsDialog
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        signedIn={Boolean(account)}
        items={notifications}
        onOpenItem={openNotification}
        onMarkAllRead={() => void readNotifications(notifications.filter((n) => !n.readAt).map((n) => n.id))}
        push={push}
        onPush={async (on) => setPush(on && accountId ? await enablePush(accountId) : await disablePush())}
        onTestPush={sendTestPush}
        kinds={settings.notify}
        onKind={(kind: NotifyKind, on) => updateSettings((s) => ({ ...s, notify: { ...s.notify, [kind]: on } }))}
        onSignIn={() => signInWithGoogle()}
      />

      <PortfolioDialog
        key={portfolioStart.key}
        initialView={portfolioStart.view}
        initialRows={portfolioStart.rows ?? null}
        initialCasFile={portfolioStart.casFile ?? null}
        initialMessage={portfolioStart.message ?? null}
        open={portfolioOpen}
        onClose={() => setPortfolioOpen(false)}
        signedIn={Boolean(account)}
        country={settings.profile.country || detected || "other"}
        holdings={holdings}
        useInAnswers={settings.portfolioInAnswers}
        onUseInAnswers={(on) => updateSettings((s) => ({ ...s, portfolioInAnswers: on }))}
        onSave={saveToPortfolio}
        onRemove={removeFromPortfolio}
        resolve={resolveSymbols}
        readCas={readCas}
        onReview={() => ask("Review my portfolio.", NO_TURNS, null)}
        directSavings={directSavings}
        contributions={contributions}
        isaMonthly={settings.isaMonthly}
        onIsaMonthly={(amount) => updateSettings((s) => ({ ...s, isaMonthly: amount }))}
        onAddContributions={addContributions}
        onRemoveContributions={removeContributions}
        onAsk={(question) => ask(question, NO_TURNS, null)}
        onSignIn={(view) => {
          try {
            window.localStorage.setItem(AFTER_SIGN_IN, view);
          } catch {
            // Without storage they just land on the home page after signing in.
          }
          signInWithGoogle();
        }}
      />

      <div className={styles.mobileBar}>
        <button className={styles.iconBtn} onClick={() => setDrawerOpen(true)} aria-label="Open menu">
          <MenuIcon />
        </button>
        <button className={styles.brand} onClick={goHome} aria-label="Tickerwise home">
          <LogoMark size={20} /> tickerwise
        </button>
        <button className={styles.iconBtn} onClick={newThread} aria-label="New thread">
          <PlusIcon />
        </button>
      </div>

      {/* Threads with a peer comparison get a right-hand column for it on wide screens. */}
      <main className={`${styles.main} ${turns.some(hasRail) ? styles.withRail : ""}`}>
        {turns.length === 0 ? (
          <div className={`${styles.homeLayout} ${showTrending || watchlist.length > 0 ? styles.homeWithTrending : ""}`}>
            <section className={styles.home}>
              <h1 className={styles.wordmark}>tickerwise</h1>
              <Composer
                value={input}
                onChange={setInput}
                onSubmit={() => ask()}
                onStop={isLoading ? stop : undefined}
                onAttach={account ? attachFile : undefined}
                disabled={isLoading || outOfQuestions}
                placeholder="Ask about stocks, funds, bonds, mortgages, retirement or tax"
                large
                inputRef={inputRef}
              />
              <QuotaNote quota={quota} />
              {!settings.onboarded && !settings.profile.country && (
                <Onboarding
                  detected={detected ?? ""}
                  onDone={(profile) =>
                    updateSettings((s) => ({
                      ...s,
                      onboarded: true,
                      profile: profile ? { ...s.profile, ...profile } : s.profile,
                    }))
                  }
                />
              )}
              <ul className={styles.suggestions}>
                {starters.map((s) => (
                  <li key={s.text}>
                    <button className={styles.suggestion} onClick={() => askStarter(s)}>
                      {s.kind !== "evergreen" && (
                        <span className={styles.suggestionTag}>{s.kind === "news" ? "Today" : "Continue"}</span>
                      )}
                      {s.text}
                    </button>
                  </li>
                ))}
                {/* Portfolio reviews are for signed-in people only, so visitors don't see this suggestion. */}
                {account && (
                  <li>
                    <button
                      className={`${styles.suggestion} ${styles.suggestionPortfolio}`}
                      onClick={() => {
                        setInput(PORTFOLIO_TEMPLATE);
                        inputRef.current?.focus();
                      }}
                    >
                      Review my portfolio: paste your holdings
                    </button>
                  </li>
                )}
              </ul>
              <div className={styles.topics}>
                <span className={styles.topicsLabel}>Browse by topic</span>
                <div className={styles.topicChips} role="group" aria-label="Browse questions by topic">
                  {(Object.keys(TOPIC_LABELS) as Topic[]).map((topic) => (
                    <button
                      key={topic}
                      className={styles.topicChip}
                      aria-pressed={browse?.topic === topic}
                      onClick={() =>
                        setBrowse(browse?.topic === topic ? null : { topic, questions: questionsFor(topic, locale, TOPIC_COUNT) })
                      }
                    >
                      {TOPIC_LABELS[topic]}
                    </button>
                  ))}
                </div>
                {browse && (
                  <ul className={styles.suggestions} aria-label={`${TOPIC_LABELS[browse.topic]} questions`}>
                    {browse.questions.map((text) => (
                      <li key={text}>
                        <button className={styles.suggestion} onClick={() => ask(text, NO_TURNS, null, true)}>
                          {text}
                        </button>
                      </li>
                    ))}
                    <li>
                      <button
                        className={`${styles.suggestion} ${styles.suggestionPortfolio}`}
                        onClick={() => setBrowse({ topic: browse.topic, questions: questionsFor(browse.topic, locale, TOPIC_COUNT) })}
                      >
                        More {TOPIC_LABELS[browse.topic].toLowerCase()} questions ↻
                      </button>
                    </li>
                  </ul>
                )}
              </div>
              <p className={styles.disclaimer}>
                Answers are researched from public sources and can be wrong or out of date. Not financial advice.
              </p>
            </section>
            {(showTrending || watchlist.length > 0) && (
              <div className={styles.homeSide}>
                {watchlist.length > 0 && (
                  <WatchlistCard
                    items={watchlist}
                    quotes={watchQuotes}
                    onAsk={(w) => ask(`What's happening with ${w.name} (${w.symbol})?`, NO_TURNS, null)}
                    onRemove={(symbol) => void toggleWatch({ symbol, name: "" }, false)}
                  />
                )}
                {showTrending && (
                  <Trending
                    data={popular}
                    disabled={isLoading}
                    onCompany={(name, symbol) => ask(`What's happening with ${name} (${symbol})?`, NO_TURNS, null)}
                    onQuestion={(text) => ask(text, NO_TURNS, null, true)}
                  />
                )}
              </div>
            )}
          </div>
        ) : (
          <section className={styles.thread}>
            {turns.map((turn) => (
              <article key={turn.id} className={styles.turn}>
                <div className={styles.turnMain}>
                  <TurnContent
                    turn={turn}
                    onAsk={(q) => ask(q)}
                    disabled={isLoading}
                    watched={watched}
                    onWatch={account ? (c, on) => void toggleWatch(c, on) : undefined}
                  />

                  {turn.error ? (
                    <div className={styles.error} role="alert">
                      <span>{turn.error}</span>
                      {turn === last && (
                        <button className={styles.actionBtn} onClick={() => retry(turn)} disabled={isLoading}>
                          Try again
                        </button>
                      )}
                    </div>
                  ) : (
                    turn.done && (
                      <div className={styles.actions}>
                        {turn.stopped && (
                          <span className={styles.stoppedNote}>
                            {turn.answer ? "Stopped" : "Stopped before the answer started"}
                          </span>
                        )}
                        {turn.answer && (
                          <button className={styles.actionBtn} onClick={() => copy(turn)}>
                            {copiedId === turn.id ? "Copied" : "Copy"}
                          </button>
                        )}
                        {turn === last && (
                          <button className={styles.actionBtn} onClick={() => retry(turn)} disabled={isLoading}>
                            Rewrite
                          </button>
                        )}
                        {turn === last && active && (
                          <button className={styles.actionBtn} onClick={() => setSharing(active)} disabled={isLoading}>
                            Share
                          </button>
                        )}
                      </div>
                    )
                  )}
                </div>
                {hasRail(turn) ? (
                  <aside className={styles.peerRail}>
                    <div>
                      {turn.peers?.map((p, i) => (
                        <PeerPanel key={i} data={p} watched={watched} onWatch={account ? (c, on) => void toggleWatch(c, on) : undefined} />
                      ))}
                      {dividendsOf(turn).map((dv, i) => (
                        <DividendPanel key={i} data={dv.data} name={dv.name} />
                      ))}
                    </div>
                  </aside>
                ) : null}
              </article>
            ))}

            {last?.done && !last.error && related.length > 0 && (
              <div className={styles.related}>
                <div className={styles.relatedLabel}>Related</div>
                <ul>
                  {related.map((s) => (
                    <li key={s}>
                      <button className={styles.relatedItem} onClick={() => ask(s, turns, activeId)} disabled={isLoading}>
                        <span>{s}</span>
                        <CornerIcon />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div ref={endRef} className={styles.threadEnd} />
          </section>
        )}

        {turns.length > 0 && (
          <div className={styles.dock}>
            <Composer
              value={input}
              onChange={setInput}
              onSubmit={() => ask()}
              onStop={isLoading ? stop : undefined}
              onAttach={account ? attachFile : undefined}
              disabled={isLoading || outOfQuestions}
              placeholder="Ask a follow-up"
              inputRef={inputRef}
            />
            <QuotaNote quota={quota} />
            <p className={styles.dockNote}>Not financial advice. Check figures before you invest.</p>
          </div>
        )}
      </main>
    </div>
    </AskGateContext.Provider>
  );
}
