import { createClient, type User } from "@supabase/supabase-js";

// Accounts are optional: without these variables (local development, for example)
// the app runs as before with chats kept in the browser.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key, { auth: { flowType: "pkce" } }) : null;

export interface Account {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

export function toAccount(user: User): Account {
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    name: meta.full_name ?? meta.name ?? user.email ?? "Signed in",
    email: user.email ?? "",
    avatar: meta.avatar_url ?? meta.picture ?? null,
  };
}

export function signInWithGoogle() {
  // Google sends the person back to the page they started on.
  return supabase?.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
}

export function signOut() {
  return supabase?.auth.signOut();
}

// One row per thread in public.threads; row-level security limits each person to their own rows.
export interface ThreadRow<T> {
  id: string;
  title: string;
  turns: T;
  pinned: boolean;
  updated_at: number;
}

export async function fetchThreads<T>(): Promise<ThreadRow<T>[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("threads")
    .select("id, title, turns, pinned, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data as ThreadRow<T>[];
}

export async function saveThreadRows<T>(userId: string, upserts: ThreadRow<T>[], deletes: string[]) {
  if (!supabase) return;
  if (upserts.length) {
    const { error } = await supabase
      .from("threads")
      .upsert(upserts.map((row) => ({ ...row, user_id: userId })), { onConflict: "user_id,id" });
    if (error) throw error;
  }
  if (deletes.length) {
    const { error } = await supabase.from("threads").delete().in("id", deletes);
    if (error) throw error;
  }
}
