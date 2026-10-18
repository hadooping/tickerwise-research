import type { Metadata } from "next";
import Link from "next/link";
import styles from "../privacy/privacy.module.css";

export const metadata: Metadata = {
  title: "Help · Tickerwise",
  description: "What Tickerwise is, why it exists, how it differs from other AI and finance tools, and how your data is kept safe.",
};


type Faq = { q: string; a: React.ReactNode };

const SECTIONS: { title: string; faqs: Faq[] }[] = [
  {
    title: "About Tickerwise",
    faqs: [
      {
        q: "What is Tickerwise?",
        a: (
          <>
            <p>
              Tickerwise is a free investment research assistant for US, UK and Indian markets. You ask a question in
              everyday words, about a share, a fund, bonds and interest rates, a mortgage, an account such as an ISA or a
              SIP, or a tax rule. It looks up live market data and official guidance, then answers in plain English with
              charts, tables and links to its sources.
            </p>
            <p>
              It also has interactive tools you can adjust yourself: a retirement planner, an overpay-the-mortgage-or-invest
              comparison, an inheritance tax estimate, an ISA allowance tracker, a direct vs regular mutual fund comparison, a
              share valuation card, a bond yields chart that marks the world events behind past moves, and bond scenarios
              that show what happens to bonds, mortgages and annuities if interest rates move, and how bonds did in past
              crises.
            </p>
            <p>
              You can share any thread by link, so someone else can read it without an account.
            </p>
          </>
        ),
      },
      {
        q: "Why was Tickerwise created?",
        a: (
          <>
            <p>
              Financial information is spread all over the internet. Share prices are on one site, company results on
              another, fund fees in factsheets, tax rules on government pages, and opinions on forums and social media. To
              answer one simple question, such as whether a fund is worth its fee or how much is left in an ISA allowance,
              you often have to piece together five different sources, each written in its own jargon.
            </p>
            <p>
              There was no single place that brings all of this together and presents it clearly, so Tickerwise was built
              to be that place. It gathers live market data, company figures, fund records and official rules, and turns
              them into one plain-English answer with charts, tables and links to every source. It doesn&apos;t sell or
              promote anything.
            </p>
            <p>
              It began with a problem we ran into ourselves as investors, and one that many people share: spending hours
              searching across sites for an answer that should take minutes, and still not being sure it was right.
              Tickerwise is the tool we wished we&apos;d had.
            </p>
          </>
        ),
      },
      {
        q: "Who is it for?",
        a: (
          <p>
            Mainly people who are new to investing or want to understand their investments better: UK savers using ISAs
            and pensions, Indian investors with SIPs, mutual funds and NPS, and US investors with 401(k)s and IRAs.
            Experienced investors use it for quick research too, and every answer links to its sources.
          </p>
        ),
      },
      {
        q: "Is it free?",
        a: (
          <p>
            Yes. There are no fees, subscriptions or ads. To keep running costs manageable, you can ask 3 questions a day
            without an account and 10 a day when signed in. The count resets at midnight UK time. The planners on the home
            page don&apos;t count towards the limit.
          </p>
        ),
      },
      {
        q: "Will Tickerwise tell me what to buy or sell?",
        a: (
          <p>
            No. Tickerwise is a research and education tool, not a financial adviser. It explains facts, trade-offs and
            risks: what could go right, what could go wrong, and what a share price assumes. It never tells you to buy,
            sell or hold. For advice about your own situation, speak to a regulated adviser. In India, that means a
            SEBI-registered investment adviser. In the UK, MoneyHelper offers free guidance.
          </p>
        ),
      },
    ],
  },
  {
    title: "How Tickerwise compares",
    faqs: [
      {
        q: "How is it different from ChatGPT, Claude, Perplexity Finance or Google Finance?",
        a: (
          <>
            <p>
              They&apos;re all good tools, and many people use more than one. Tickerwise is narrower: it&apos;s built only
              for investing questions, for US, UK and Indian investors, and for people who are still learning.
            </p>
            <ul>
              <li>
                <strong>ChatGPT and Claude</strong> are general assistants that can help with almost anything. Tickerwise
                adds tools a general assistant doesn&apos;t have by default: live prices and company
                accounts, fund replays that include fees, peer comparisons drawn as charts, and a library of official UK,
                Indian and US rules (GOV.UK, SEBI, AMFI, PFRDA, the IRS and others) that it quotes and links to. It also
                follows firm rules: no buy or sell tips, plain words, and dated figures in the right currency.
              </li>
              <li>
                <strong>Perplexity Finance</strong> is strong on market news, live quotes and company data. Tickerwise goes
                further into the personal side of investing in the UK and India: ISAs, SIPs, direct vs regular plans, NPS,
                Indian CAS statements and UK inheritance tax. It also has planners you can adjust.
              </li>
              <li>
                <strong>Google Finance</strong> is excellent for quotes, charts, news and following a watchlist. Tickerwise
                is for the questions that come after: what the numbers mean, how two funds compare after fees, what a
                share price assumes about growth, or which account suits a goal.
              </li>
            </ul>
            <p>
              Tickerwise doesn&apos;t show ads, isn&apos;t paid by any fund or broker, and has no products to sell.
            </p>
          </>
        ),
      },
      {
        q: "How does Tickerwise write its answers?",
        a: (
          <p>
            Answers are written by an AI model from a leading provider. Before it writes anything, it looks up live
            market data, searches the web and checks Tickerwise&apos;s library of official rules. It then answers from
            what it found, with links to the sources, rather than from memory.
          </p>
        ),
      },
      {
        q: "Where do the numbers come from, and how up to date are they?",
        a: (
          <ul>
            <li>
              <strong>Prices, company figures and history</strong> come from Yahoo Finance and can be delayed by about 15
              minutes.
            </li>
            <li>
              <strong>Indian mutual fund prices (NAVs)</strong> come from AMFI and mfapi.in.
            </li>
            <li>
              <strong>UK gilt yields</strong> come from the Bank of England, about two working days behind; US Treasury
              yields come from Yahoo Finance.
            </li>
            <li>
              <strong>Rules and allowances</strong> come from about 100 official pages, such as GOV.UK, FSCS, India&apos;s
              Income Tax portal, AMFI, PFRDA, SEBI and the IRS. These are checked weekly, and newly announced changes are
              found with web search.
            </li>
            <li>
              <strong>News and commentary</strong> come from web search, with a numbered link to each source.
            </li>
          </ul>
        ),
      },
      {
        q: "Can answers be wrong?",
        a: (
          <p>
            Yes. AI can misread a source, and data can be delayed or out of date. That&apos;s why every answer shows its
            sources and dates its figures. Check anything important against the linked sources before you act on it.
          </p>
        ),
      },
    ],
  },
  {
    title: "Using Tickerwise",
    faqs: [
      {
        q: "What kinds of questions can I ask?",
        a: (
          <ul>
            <li>A company: &ldquo;Give me a rundown of Shell&apos;s latest results.&rdquo;</li>
            <li>
              Whether a share looks expensive: &ldquo;What growth is priced into Apple&apos;s share price?&rdquo;
            </li>
            <li>A comparison: &ldquo;Compare TCS and Infosys&rdquo;, with a chart.</li>
            <li>
              What regular investing would have done: &ldquo;What would a ₹5,000 SIP in a Nifty 50 fund have become over
              10 years?&rdquo;
            </li>
            <li>
              Accounts and tax: &ldquo;How much can I put in an ISA this year?&rdquo; or &ldquo;How is ELSS taxed?&rdquo;
            </li>
            <li>
              Bonds and interest rates: &ldquo;Why are gilt yields rising?&rdquo; or &ldquo;What would happen to my bond fund
              if yields rose another 1%?&rdquo;
            </li>
            <li>
              Planning: &ldquo;Am I on track to retire at 60?&rdquo;, &ldquo;Overpaying my mortgage or investing: how do they
              compare?&rdquo; or &ldquo;How much inheritance tax would my estate pay?&rdquo;
            </li>
          </ul>
        ),
      },
      {
        q: "How does the valuation card work?",
        a: (
          <>
            <p>
              Ask whether a share is expensive and Tickerwise picks the method that suits the company, and says why: free cash
              flow (cash left after running and investing in the business) for most companies, averaged over good and bad
              years for cyclical ones such as miners; return on equity (profit as a % of shareholders&apos; money) for banks
              and insurers; dividend growth for utilities and property companies; and sales growth for companies not yet
              making steady cash. The discount rate (the yearly return investors want for the risk) starts from today&apos;s
              government bond yield plus an allowance for how much the share swings.
            </p>
            <p>
              The card has five views. <strong>What&apos;s priced in</strong> shows the growth today&apos;s price needs.{" "}
              <strong>What analysts say</strong> shows how analysts at banks and brokers rate the share, the range of their
              12-month price targets against today&apos;s price, and, for most US shares, recent rating changes by firm, with a
              link to the source. These are their opinions, not Tickerwise&apos;s.{" "}
              <strong>Value investing</strong> shows an estimated value from the company&apos;s own record, the price a
              margin of safety (paying well below that value, to allow for mistakes) would point to, its earnings yield (a
              year&apos;s profit as a % of the price) against the bond yield, and a quality checklist covering debt, return
              on equity, cash and dividends. <strong>Price in context</strong> shows what buyers pay for each 1 of
              profit (the P/E) beside the company&apos;s own usual level, its competitors and its home stock market as a
              whole (the FTSE 100, Nifty 50 or S&amp;P 500), then how it has moved over recent years. Where profit is a
              poor guide it uses the yardstick that suits the industry: net assets for insurers, property companies and
              investment trusts, sales for companies making a loss or very little profit, profit averaged over several
              years for miners, oil and other cyclical businesses, and next year&apos;s expected profit for fast growers. <strong>Against peers</strong> compares it with similar companies, including PEG (P/E
              adjusted for growth). For companies that pay dividends, a chart beside the answer shows 10 years of dividends
              against their competitors.
            </p>
            <p>
              Drag the sliders to try your own assumptions. The card doesn&apos;t give a &ldquo;fair value&rdquo; or a
              verdict: it shows what has to go right for the price to be justified, which you can then compare with how
              the business has actually grown.
            </p>
          </>
        ),
      },
      {
        q: "How do the bond charts and scenarios work?",
        a: (
          <>
            <p>
              Ask about bond yields, gilts or Treasuries and Tickerwise shows today&apos;s yields on a long-run chart, with
              numbered markers for the world events behind past moves (such as the 1981 peak, the 2008 crisis and the 2022
              mini-budget). It also lists past times yields were at today&apos;s level, and what yields and the stock market did
              over the following year.
            </p>
            <p>
              Ask a &ldquo;what if&rdquo; question and a scenarios card lets you try it: how short, medium and long bonds react if
              yields move; what £10,000 did in bonds, shares and a 60/40 mix through past crises; why a single bond held to the
              end behaves differently from a bond fund; and rough guides to the effect on mortgage payments, annuity income and
              savings. UK figures come from the Bank of England and US figures from Yahoo Finance; India isn&apos;t covered yet,
              because there&apos;s no free history of Indian bond yields. Scenarios are illustrations, not forecasts.
            </p>
          </>
        ),
      },
      {
        q: "What is value investing?",
        a: (
          <p>
            Buying shares for less than you estimate the business is worth, then holding while the price catches up. It was
            taught by Benjamin Graham and made famous by Warren Buffett. Three ideas sit at its heart: intrinsic value (what a
            business is worth from the cash it will make), a margin of safety (paying well below that, so a wrong estimate
            doesn&apos;t cost you), and a moat (a lasting advantage that protects profits). Tickerwise&apos;s valuation card
            has a Value investing view that shows each of these for a company, using assumptions you can change; it never
            tells you whether to buy.
          </p>
        ),
      },
      {
        q: "Do I need an account?",
        a: (
          <p>
            No. Without one, your threads are saved only in your browser. Signing in with Google gives you 10 questions a
            day instead of 3. It also syncs your threads across devices and unlocks Settings (your profile, answer length
            and language, memory), your portfolio, your watchlist, and reminders and alerts.
          </p>
        ),
      },
      {
        q: "Can I add my own investments?",
        a: (
          <p>
            Yes, once you&apos;re signed in. Open My portfolio and add holdings by hand, import a CSV from your broker
            (Trading 212 and others), or upload an Indian CAS statement. Tickerwise can then review your concentration,
            sector and currency exposure, and what regular-plan mutual funds have cost you. You can stop it using your
            portfolio in answers at any time.
          </p>
        ),
      },
      {
        q: "Can I share a thread with someone?",
        a: (
          <p>
            Yes. Open the thread&apos;s ⋯ menu, or the Share button under its latest answer, and make a link. Anyone with the link
            can read the whole thread, with its sources, charts and planners, without an account. The link shows the thread as
            it was when you shared it; you can update it after asking more, or stop sharing to delete the copy. Answers may
            mention things you told Tickerwise, so check before you share.
          </p>
        ),
      },
      {
        q: "Can I switch between light and dark mode?",
        a: (
          <p>
            Yes, and you don&apos;t need an account. Click <strong>Theme</strong> in the sidebar to switch between Light, Dark
            and Match device (which follows your phone or computer). Without an account, your choice is kept in this
            browser. Signed in, it follows you to every device, and Settings › Appearance also lets you change the font,
            text size and reading width.
          </p>
        ),
      },
      {
        q: "Can I get answers in my own language?",
        a: (
          <p>
            Yes. Sign in, then in Settings › Answers choose from 21 languages, including Hindi, Tamil, Telugu, Bengali, Marathi,
            Gujarati, Kannada, Malayalam, Punjabi and Urdu. You can also choose shorter or longer answers there.
          </p>
        ),
      },
    ],
  },
  {
    title: "Your data and privacy",
    faqs: [
      {
        q: "Is my data safe?",
        a: (
          <>
            <p>Here is how Tickerwise keeps your data safe:</p>
            <ul>
              <li>
                <strong>Without an account</strong>, your threads and theme stay in your browser. The only thing
                kept on our servers is a daily count of questions, stored against scrambled (hashed) forms of a random ID your
                browser keeps and of your network address, so the daily limit works.
              </li>
              <li>
                <strong>With an account</strong>, your data is stored in a database where each account can read only its own
                data, enforced by the database itself.
              </li>
              <li>
                <strong>Sign-in is through Google</strong>, so Tickerwise never sees or stores a password.
              </li>
              <li>
                <strong>Indian CAS statements</strong> are read once in memory and thrown away with their password. Your PAN,
                address and folio numbers are never stored.
              </li>
              <li>
                <strong>Market data lookups</strong> send only ticker symbols to Yahoo Finance, never your questions or
                who you are.
              </li>
            </ul>
            <p>
              No service can promise perfect security, so don&apos;t type account numbers, passwords or other sensitive
              details into your questions. You don&apos;t need them to use Tickerwise.
            </p>
          </>
        ),
      },
      {
        q: "Is my data used to train AI?",
        a: (
          <p>
            No. Your questions go to the AI provider only to write your answer. It doesn&apos;t use them to train its
            models, and Tickerwise doesn&apos;t either.
          </p>
        ),
      },
      {
        q: "Do you sell my data or show ads?",
        a: (
          <p>
            No. There are no ads, no tracking cookies, and no selling or sharing of data for marketing. Visit statistics
            are counted without cookies and can&apos;t identify you.
          </p>
        ),
      },
      {
        q: "How do I delete my data?",
        a: (
          <p>
            Delete any thread from its ⋯ menu. In Settings › Data &amp; account you can download everything, or delete
            your account and all its data immediately. Without an account, &ldquo;Clear this device&rdquo; in the sidebar
            removes what your browser holds. The full details are in the <Link href="/privacy">privacy policy</Link>.
          </p>
        ),
      },
    ],
  },
  {
    title: "Getting in touch",
    faqs: [
      {
        q: "How do I report a problem or suggest a feature?",
        a: (
          <p>
            Use the <Link href="/feedback">Send feedback</Link> page. Tell us what you asked and what went wrong, but leave
            out personal or financial details. If you&apos;d like a reply, add a way to reach you.
          </p>
        ),
      },
    ],
  },
];

export default function Help() {
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.back}>
        ← Back to Tickerwise
      </Link>
      <h1>Help and FAQ</h1>
      <p className={styles.updated}>Last updated 17 October 2026</p>

      <nav aria-label="Sections" className={styles.toc}>
        {SECTIONS.map((s) => (
          <a key={s.title} href={`#${slug(s.title)}`}>
            {s.title}
          </a>
        ))}
      </nav>

      {SECTIONS.map((s) => (
        <section key={s.title} id={slug(s.title)}>
          <h2>{s.title}</h2>
          {s.faqs.map((f) => (
            <details key={f.q} className={styles.faq}>
              <summary>{f.q}</summary>
              <div className={styles.answer}>{f.a}</div>
            </details>
          ))}
        </section>
      ))}

      <p className={styles.footnote}>
        Tickerwise is for research and education, not financial advice. See the <Link href="/terms">terms</Link> and{" "}
        <Link href="/privacy">privacy policy</Link>.
      </p>
    </main>
  );
}

const slug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
