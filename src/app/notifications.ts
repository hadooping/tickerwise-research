// Notifications (written by the backend's daily job) and browser push on this device, plus the
// watchlist. All stored per person with row-level security.

import { supabase } from "./account";

export interface AppNotification {
  id: string;
  kind: "deadline" | "results" | "digest";
  title: string;
  body: string;
  question: string | null;
  action: "ask" | "portfolio" | "isa" | null;
  createdAt: string;
  readAt: string | null;
}

export async function fetchNotifications(): Promise<AppNotification[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, title, body, question, action, created_at, read_at")
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw error;
  return (data ?? []).map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    question: n.question,
    action: n.action,
    createdAt: n.created_at,
    readAt: n.read_at,
  }));
}

export async function markRead(ids: string[]) {
  if (!supabase || !ids.length) return;
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
  if (error) throw error;
}

// ---- Push on this device ----

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

// iPhones and iPads only allow web push once Tickerwise is added to the home screen.
const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const isInstalled = () => window.matchMedia?.("(display-mode: standalone)").matches;

export async function pushState(): Promise<PushState> {
  if (!VAPID_PUBLIC_KEY || !("serviceWorker" in navigator)) return "unsupported";
  if (!("PushManager" in window)) return isIos() && !isInstalled() ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}

function keyBytes(base64url: string) {
  const padded = base64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (base64url.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

/** Asks permission, subscribes this browser, and saves the subscription to the account. */
export async function enablePush(userId: string): Promise<PushState> {
  if (!supabase || !VAPID_PUBLIC_KEY) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
  const json = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: userId, endpoint: sub.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth },
    { onConflict: "endpoint" }
  );
  if (error) throw error;
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase?.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
  return "off";
}

// ---- Watchlist ----

export interface WatchItem {
  symbol: string;
  name: string;
}

export async function fetchWatchlist(): Promise<WatchItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("watchlist").select("symbol, name").order("added_at");
  if (error) throw error;
  return data ?? [];
}

export async function addToWatchlist(userId: string, item: WatchItem) {
  if (!supabase) return;
  const { error } = await supabase
    .from("watchlist")
    .upsert({ user_id: userId, symbol: item.symbol, name: item.name }, { onConflict: "user_id,symbol" });
  if (error) throw error;
}

export async function removeFromWatchlist(symbol: string) {
  if (!supabase) return;
  const { error } = await supabase.from("watchlist").delete().eq("symbol", symbol);
  if (error) throw error;
}
