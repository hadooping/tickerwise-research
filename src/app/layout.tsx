import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Atkinson_Hyperlegible, Geist, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

// Optional reading fonts from Settings > Appearance; not preloaded, since most people keep the default.
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif", preload: false });
const readable = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-readable",
  preload: false,
});

// Applies saved appearance settings before the first paint, so the page doesn't flash the
// default theme. Mirrors applyAppearance in settings.ts.
const APPEARANCE_SCRIPT = `try{var a=(JSON.parse(localStorage.getItem("tickerwise.settings"))||{}).appearance||{};var d=document.documentElement.dataset;["theme","font","size","width"].forEach(function(k){if(a[k])d[k]=a[k]})}catch(e){}`;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcf9" },
    { media: "(prefers-color-scheme: dark)", color: "#191a1a" },
  ],
};

export const metadata: Metadata = {
  title: "Tickerwise",
  description: "Investment research in plain English for the UK, India and the US: stocks, funds, bonds, mortgages, retirement and tax, with sourced answers, charts and planners.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geist.variable} ${serif.variable} ${readable.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_SCRIPT }} />
      </head>
      <body>
        {children}
        {/* Anonymous visit counts (country, page, device) for the Vercel dashboard; no cookies. */}
        <Analytics />
      </body>
    </html>
  );
}
