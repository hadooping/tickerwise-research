import type { Metadata } from "next";
import Link from "next/link";
import styles from "./privacy.module.css";

export const metadata: Metadata = {
  title: "Privacy · Tickerwise",
  description: "What Tickerwise stores, who processes it, and how to delete it.",
};

export default function Privacy() {
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.back}>
        ← Back to Tickerwise
      </Link>
      <h1>Privacy</h1>
      <p className={styles.updated}>Last updated 19 October 2026</p>

      <p>
        Tickerwise is a research tool for investing and personal finance in the US, UK and India: stocks, funds, bonds,
        mortgages, retirement and tax. This page explains what it stores
        about you and why. We don&apos;t show ads, sell data, or use tracking cookies.
      </p>

      <h2>If you don&apos;t sign in</h2>
      <p>
        Your threads and theme are saved only in your own browser (settings, your investment profile and memory need an
        account). Clearing your
        browser&apos;s site data removes them. Your questions and answers aren&apos;t kept on our servers once an answer
        has been written.
      </p>
      <p>
        To apply the daily question limit, your browser keeps a random ID (in its local storage, not a cookie) that it
        sends with each question, and we count how many questions each ID and each network address ask a day. Neither
        the ID nor the address is stored: we keep only scrambled codes made from them with a secret key (keyed hashes),
        which can&apos;t be turned back. With the same scrambled code we record how much computing each answer took (its
        size in words processed and how many web searches it ran, never its content), to see what Tickerwise costs to run.
        We also record the steps each answer took, to find slow or failing ones: which lookups and web searches ran, with
        the short labels you see while it works (such as &ldquo;Searching: Lloyds news&rdquo;), how long each took and
        how much computing it used. Your question, the answer and who asked aren&apos;t included.
        The counts aren&apos;t linked to your questions or to who you are. Clearing
        your browser&apos;s site data removes the ID.
      </p>

      <h2>If you sign in with Google</h2>
      <ul>
        <li>
          Google shares your <strong>name, email address, and profile picture</strong> with us. We don&apos;t
          receive your password or access anything else in your Google account.
        </li>
        <li>
          We store that profile and your <strong>threads</strong> (your questions, the answers, and their sources)
          so they appear on every device you sign in on, along with your <strong>settings</strong>,{" "}
          <strong>investment profile</strong>, <strong>instructions</strong>, and <strong>memory</strong> (short notes
          Tickerwise saves when you mention lasting things like your goals; you can see, edit, or turn these off in
          Settings). Each account can read only its own data.
        </li>
        <li>
          If you add your <strong>portfolio</strong>, we store each holding&apos;s name, market symbol, quantity, average
          cost, and which account it&apos;s in (for example ISA or mutual funds), plus any ISA payments you record
          (date, amount, ISA type, and provider) for the allowance tracker. A CSV is read in your browser; an India
          CAS statement is sent to our server, read once in memory, and discarded with its password. Your PAN, address,
          and folio numbers are never stored. You can turn off &ldquo;Use my portfolio in answers&rdquo; at any time.
        </li>
        <li>
          If you use them, we store your <strong>watchlist</strong>, the <strong>notifications</strong> we create for
          you (deadline reminders, results-day alerts, and weekly summaries), and, for each device you turn
          notifications on for, the browser&apos;s push address. You choose which notifications you get, and can
          turn them off on any device.
        </li>
        <li>
          We count how many questions your account asks each day, to apply the daily limit, and record how much computing
          each answer took (its size and number of web searches, never its content), to see what Tickerwise costs to run.
          Both are deleted with your account.
        </li>
        <li>A sign-in token is kept in your browser so you stay signed in. Signing out removes it.</li>
      </ul>

      <h2>Shared threads</h2>
      <p>
        If you share a thread, we store a copy of its finished questions and answers, with their sources, charts and
        planners, so anyone with the link can read it without signing in. It doesn&apos;t include your settings, memory or
        portfolio, but answers can mention things you told Tickerwise, so check before you share. Search engines are asked
        not to list shared threads. Choose &ldquo;Stop sharing&rdquo; in the thread&apos;s Share menu to delete the copy at
        once; copies shared while signed in are also deleted with your account.
      </p>

      <h2>Feedback</h2>
      <p>
        If you send feedback, we store your message, the contact details you choose to add, and the date. If you&apos;re
        signed in, it&apos;s linked to your account and deleted with it; if not, it&apos;s stored with the same scrambled
        form of your network address used for the daily question limit, so one person can&apos;t send too many messages.
        Only the people who run Tickerwise can read it.
      </p>
      <p>
        Issues opened on GitHub are different: they&apos;re public, posted under your GitHub account, and handled under
        GitHub&apos;s own terms and privacy policy. Don&apos;t include personal or financial details in them.
      </p>

      <h2>Frequently searched</h2>
      <p>
        To show what&apos;s popular on the home page, we count which companies and funds Tickerwise looks up and
        which of its own suggested questions are chosen, by day. These counts aren&apos;t linked to you, and nothing
        you type is stored or shown for this.
      </p>

      <h2>Visit statistics</h2>
      <p>
        We use Vercel Web Analytics to count visits: which pages are viewed, roughly which country visitors are in
        (worked out from the network address, which isn&apos;t stored), and the type of device and browser. It uses no
        cookies, doesn&apos;t follow you across other sites, and can&apos;t identify you.
      </p>

      <h2>Who processes your data</h2>
      <ul>
        <li>
          <strong>Our AI model provider</strong> receives each question and the earlier messages in that thread, to
          write the answer and run web searches. It doesn&apos;t use them to train its models.
        </li>
        <li>
          <strong>Yahoo Finance</strong> receives the ticker symbols being looked up, never your questions or
          identity.
        </li>
        <li>
          <strong>Supabase</strong> stores accounts and saved threads.
        </li>
        <li>
          <strong>Langfuse</strong> receives the steps each answer took (described above), stored in the EU.
        </li>
        <li>
          <strong>Vercel</strong> hosts the site and keeps short-lived request logs, such as IP addresses, for
          security and troubleshooting.
        </li>
      </ul>

      <h2>Deleting your data</h2>
      <p>
        Delete any thread from its ⋯ menu; it is removed from your account straight away. In{" "}
        <strong>Settings › Data &amp; account</strong> you can download all your chats, settings, and memory, and
        delete your account and everything in it immediately. Without an account, &ldquo;Clear this device&rdquo; in
        the sidebar removes what your browser holds.
      </p>

      <h2>Not financial advice</h2>
      <p>
        Answers are researched from public sources and can be wrong or out of date. They are for education, not
        personal financial advice.
      </p>
    </main>
  );
}
