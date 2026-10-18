import type { Metadata } from "next";
import Link from "next/link";
import styles from "../privacy/privacy.module.css";

export const metadata: Metadata = {
  title: "Terms · Tickerwise",
  description: "The terms for using Tickerwise.",
};

export default function Terms() {
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.back}>
        ← Back to Tickerwise
      </Link>
      <h1>Terms of service</h1>
      <p className={styles.updated}>Last updated 16 October 2026</p>

      <p>By using Tickerwise you agree to these terms. If you don&apos;t agree, please don&apos;t use it.</p>

      <h2>What Tickerwise is</h2>
      <p>
        Tickerwise is a free research tool that answers questions about investing and personal finance in the US, UK and
        India (stocks, funds, bonds, mortgages, retirement and tax) using
        AI, web search, and market data. It is offered as is, as a learning project, and may change or stop at any
        time.
      </p>

      <h2>Not financial advice</h2>
      <p>
        Answers are general information for education. They are not personal financial, investment, tax, or legal
        advice, and they don&apos;t take your circumstances into account. Past performance doesn&apos;t predict future
        results. Before making decisions about your own money, speak to a regulated financial adviser.
      </p>

      <h2>Accuracy</h2>
      <p>
        Answers can be wrong, incomplete, or out of date. Market data may be delayed, and AI can misread sources.
        Check anything important against the original sources linked in each answer.
      </p>

      <h2>Fair use</h2>
      <ul>
        <li>Don&apos;t use Tickerwise for anything unlawful, or to harass or mislead others.</li>
        <li>Don&apos;t try to overload, scrape, or break the service, or get around its limits.</li>
        <li>We may limit or end access for anyone who misuses it.</li>
      </ul>

      <h2>Your account</h2>
      <p>
        Signing in with Google is optional. You&apos;re responsible for activity on your account. How we handle your
        data is explained in the <Link href="/privacy">privacy policy</Link>.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, we aren&apos;t liable for any loss arising from use of Tickerwise or reliance
        on its answers. Nothing in these terms limits rights you have under consumer law.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms can be sent from the <Link href="/feedback">Send feedback</Link> page.
      </p>
    </main>
  );
}
