// Sharing threads by link (api/share.py). The browser remembers which threads it has shared and
// the token that lets it update or stop sharing them; a signed-in person can also do that from
// another device, because the backend checks their account.
import { supabase } from "./account";
import { deviceHeaders } from "./device";

export interface ShareLink {
  id: string;
  token: string | null;
  at: number; // when the link was last made or updated
}

const KEY = "tickerwise.shares";

export function loadShares(): Record<string, ShareLink> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveShares(shares: Record<string, ShareLink>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(shares));
  } catch {
    // Without storage the link still works; it just can't be updated from this browser.
  }
}

export const shareUrl = (id: string) => `${window.location.origin}/share/${id}`;

async function headers(): Promise<Record<string, string>> {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  return { "Content-Type": "application/json", ...deviceHeaders(), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function detail(res: Response, fallback: string) {
  const d = (await res.json().catch(() => null))?.detail;
  return typeof d === "string" ? d : fallback;
}

/** Makes a link for the thread, or updates its existing link to the thread as it is now. */
export async function shareThread(threadId: string, title: string, turns: unknown[]): Promise<ShareLink> {
  const existing = loadShares()[threadId];
  const res = await fetch("/api/share", {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({ title, turns, id: existing?.id, token: existing?.token }),
  });
  if (!res.ok) throw new Error(await detail(res, "The link couldn't be made just now. Please try again later."));
  const { id, token } = await res.json();
  const link = { id, token, at: Date.now() };
  saveShares({ ...loadShares(), [threadId]: link });
  return link;
}

/** Deletes the shared copy, so the link stops working. */
export async function stopSharing(threadId: string) {
  const existing = loadShares()[threadId];
  if (!existing) return;
  const res = await fetch(`/api/share/${existing.id}/delete`, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({ token: existing.token }),
  });
  if (!res.ok) throw new Error(await detail(res, "Sharing couldn't be stopped just now. Please try again later."));
  const shares = loadShares();
  delete shares[threadId];
  saveShares(shares);
}
