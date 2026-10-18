import type { Metadata } from "next";

// Shared threads are for the people they're sent to, so search engines are asked not to list them.
export const metadata: Metadata = {
  title: "Shared thread · Tickerwise",
  description: "A research thread shared from Tickerwise.",
  robots: { index: false, follow: false },
};

export default function SharedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
