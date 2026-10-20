import { NextResponse, type NextRequest } from "next/server";

// The backend is a separate Vercel project, and Vercel replaces the visitor's details with its own
// servers' when the website forwards /api requests there. So the website, which still sees them,
// passes on:
// - the visitor's country (from Vercel's edge), for popular questions from their region;
// - their real address, with an HMAC signature the backend can check (CLIENT_IP_SECRET, set on
//   both projects), for the daily question limit. Anything a visitor sends in these headers
//   themselves is thrown away first.
const SECRET = process.env.CLIENT_IP_SECRET;

async function sign(ip: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-tickerwise-country", request.headers.get("x-vercel-ip-country") ?? "");
  headers.delete("x-tickerwise-client-ip");
  headers.delete("x-tickerwise-client-sig");
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || request.headers.get("x-real-ip");
  if (SECRET && ip) {
    headers.set("x-tickerwise-client-ip", ip);
    headers.set("x-tickerwise-client-sig", await sign(ip));
  }
  // "Frequently searched" depends only on the visitor's region, so the region goes into the address
  // (/api/trending?region=uk). Vercel's CDN can then keep one copy per region and serve it in about 0.2s,
  // instead of every visit waiting seconds for the backend to rebuild it.
  if (request.nextUrl.pathname === "/api/trending" && !request.nextUrl.searchParams.has("region")) {
    const url = request.nextUrl.clone();
    url.searchParams.set("region", REGIONS[(request.headers.get("x-vercel-ip-country") ?? "").toUpperCase()] ?? "other");
    return NextResponse.rewrite(url, { request: { headers } });
  }
  return NextResponse.next({ request: { headers } });
}

// The countries with their own "Frequently searched" list, as the backend's trending.REGIONS (GB is the
// United Kingdom's code); every other country is "other".
const REGIONS: Record<string, string> = { GB: "uk", US: "us", IN: "in" };

export const config = {
  matcher: "/api/:path*",
};
