import type { Metadata } from "next";
import Link from "next/link";
import styles from "../privacy/privacy.module.css";
import Checker from "./checker";

export const metadata: Metadata = {
  title: "What your regular plans cost · Tickerwise",
  description:
    "Upload your mutual fund CAS and see, in rupees, what the distributor commission in your regular plans costs you this year and over 10 years. Free, no sign-in, nothing saved.",
};

/** The open regular-plan cost page: what it is, then the checker. No sign-in, so a visitor can try it straight away
 *  (it was only inside My portfolio before, after signing in and importing a portfolio). */
export default function RegularPlanCost() {
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.back}>
        ← Back to Tickerwise
      </Link>
      <h1>What do your regular plans cost you?</h1>
      <p>
        Every Indian mutual fund comes in two versions. A <strong>regular plan</strong> is sold through a distributor, such
        as a bank, an agent or an app, who is paid a commission out of the fund every year. A <strong>direct plan</strong>{" "}
        holds exactly the same investments with no commission, so it grows a little faster. You never see the commission as
        a bill: it comes out of the fund&apos;s price every day.
      </p>
      <p>
        Upload your Consolidated Account Statement (CAS) and Tickerwise works out, fund by fund, how much faster the direct
        plan has grown and what the gap costs you in rupees.
      </p>
      <Checker />
      <h2>Before you think about switching</h2>
      <ul>
        <li>
          Moving to a direct plan means selling the regular plan and buying the direct one. Selling can mean capital gains
          tax, and some funds charge an exit load if you sell within a year or so of buying.
        </li>
        <li>Tax-saving ELSS funds can&apos;t be sold for 3 years after each purchase.</li>
        <li>
          A distributor may give you help that&apos;s worth paying for. With a direct plan you choose and look after the
          funds yourself, or pay a SEBI-registered investment adviser separately.
        </li>
      </ul>
      <p>
        This is an illustration from each fund&apos;s past growth, not advice. For your own situation, speak to a
        SEBI-registered investment adviser.
      </p>
    </main>
  );
}
