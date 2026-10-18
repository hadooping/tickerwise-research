import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin · Tickerwise",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
