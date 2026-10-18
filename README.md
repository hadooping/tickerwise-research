# Tickerwise

**Investment research in plain English, for UK beginners, Indian SIP investors and US investors.**

Ask a question about a share, a fund, bonds, a mortgage, an account such as an ISA or a SIP, or a tax rule. Tickerwise researches it with live market data and official guidance, then answers in everyday words with charts, tables and cited sources. It explains trade-offs; it never tells anyone what to buy or sell.

**Try it:** [tickerwise-research.vercel.app](https://tickerwise-research.vercel.app)

This repository is the Tickerwise **website**: the chat, the cards and charts, the planners, and the pages around them. The research service it talks to (the `/api` routes) is run separately and isn't part of this repository.

## What's here

- **Chat** (`src/app/chat.tsx`): questions and streamed answers, with sources, glossary hover-meanings, and ups and downs in colour.
- **Cards and charts:** company valuation (what the price assumes, a value investing view, analysts' views at a glance and in full, the price in context against its own past, its competitors and its home market, peers), competitor and dividend panels, bond yields with the world events behind past moves, bond scenarios, and charts that open larger.
- **Planners:** retirement, overpay the mortgage or invest, inheritance tax, the ISA allowance tracker, and direct vs regular mutual fund plans. Their maths runs in the browser (`retirement.ts`, `mortgage.ts`, `inheritance.ts`, `valuation.ts`, `bond-scenarios.ts`), so you can see exactly how each figure is worked out.
- **Your own money** (with a free account): portfolio, watchlist, reminders and alerts, and settings. Anyone can share a thread by link.
- **Pages:** Help & FAQ, Privacy, Terms, Send feedback, and shared threads.

## Running it locally

You need Node.js 20.9 or later.

```bash
npm install
npm run dev   # http://localhost:3000
```

The pages and planners work on their own. Answers, market data and accounts need the research service: set `BACKEND_URL` to its address (it's where `/api/*` requests go), and for sign-in, `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

```bash
npm run lint
npx tsc --noEmit
```

Built with Next.js (App Router), React and TypeScript, with plain CSS modules and hand-drawn SVG charts. Deployed on Vercel from this repository's `main` branch.

## Reporting a problem or suggesting an idea

Please [open an issue](../../issues/new/choose). Say what you asked and what happened, but **leave out personal or financial details** such as account numbers, holdings or income: issues are public. You can also use [Send feedback](https://tickerwise-research.vercel.app/feedback) in the app, which is private.

## Important

Tickerwise is a research and education tool, not financial advice. Answers can be wrong or out of date; check figures before you invest, and speak to a regulated adviser about your own situation (in India, a SEBI-registered investment adviser). Market data may be delayed.
