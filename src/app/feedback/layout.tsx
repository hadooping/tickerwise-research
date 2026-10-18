import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Send feedback · Tickerwise",
  description: "Report a problem or suggest an idea for Tickerwise.",
};

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
