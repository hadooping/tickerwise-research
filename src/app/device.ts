// A random ID for this browser, kept in local storage, sent with requests so the backend can count a
// signed-out visitor's questions. The visitor's network address can't be used for that on its own:
// it changes (Safari's Private Relay, mobile networks), and the backend never sees it directly.
const KEY = "tickerwise.device";

export function deviceId(): string | null {
  try {
    let id = localStorage.getItem(KEY);
    if (!id || !/^[A-Za-z0-9-]{16,64}$/.test(id)) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null; // storage blocked: the backend falls back to the network address
  }
}

export const deviceHeaders = (): Record<string, string> => {
  const id = deviceId();
  return id ? { "X-Tickerwise-Device": id } : {};
};
