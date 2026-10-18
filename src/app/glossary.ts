// Plain-English explanations for investing terms in answers. The first time each term appears
// in an answer it gets a dotted underline; hovering, focusing, or tapping it shows the meaning.

export const GLOSSARY: { term: string; pattern: RegExp; meaning: string }[] = [
  // Longer names first, so "Lifetime ISA" wins over "ISA".
  { term: "Stocks and Shares ISA", pattern: /\bStocks (?:and|&) Shares ISAs?\b/, meaning: "A UK account for investing where growth and dividends are tax-free. You can put in up to the yearly ISA allowance." },
  { term: "Lifetime ISA", pattern: /\bLifetime ISAs?\b|\bLISAs?\b/, meaning: "A UK ISA for people aged 18 to 39 when opened. The government adds 25% to what you pay in, for a first home or for later life; other withdrawals are charged a penalty." },
  { term: "ISA", pattern: /\bISAs?\b/, meaning: "Individual Savings Account: a UK account where your savings or investments grow free of UK tax." },
  { term: "SIPP", pattern: /\bSIPPs?\b/, meaning: "Self-invested personal pension: a UK pension you manage yourself, with tax relief on what you pay in. You can't take money out until later life." },
  { term: "OCF", pattern: /\bOCF\b|\bongoing charges? figure\b/i, meaning: "Ongoing charges figure: a fund's yearly running cost as a percentage of your money, taken from the fund automatically." },
  { term: "gilt", pattern: /\bgilts?\b/, meaning: "A loan to the UK government that pays interest. Gilts are generally among the safer investments." },
  { term: "accumulation units", pattern: /\baccumulation (?:units|shares|class)\b|\bAcc\b/, meaning: "A version of a fund that automatically reinvests dividends instead of paying them out." },
  { term: "FTSE 100", pattern: /\bFTSE 100\b/, meaning: "A list of the 100 biggest companies on the London Stock Exchange, used to measure the UK market." },
  { term: "capital gains tax", pattern: /\bcapital gains tax\b|\bCGT\b/i, meaning: "Tax on the profit when you sell an investment for more than you paid, above a yearly tax-free amount. It doesn't apply inside an ISA or pension." },
  { term: "SIP", pattern: /\bSIPs?\b/, meaning: "Systematic investment plan: putting a fixed amount into a mutual fund every month, automatically." },
  { term: "NAV", pattern: /\bNAVs?\b/, meaning: "Net asset value: the price of one unit of a mutual fund, worked out once a day." },
  { term: "expense ratio", pattern: /\bexpense ratios?\b|\bTER\b/i, meaning: "A fund's yearly running cost as a percentage of your money, taken from the fund automatically." },
  { term: "direct plan", pattern: /\bdirect plans?\b/i, meaning: "The version of an Indian mutual fund bought without a distributor, so it has a lower expense ratio than the regular plan." },
  { term: "regular plan", pattern: /\bregular plans?\b/i, meaning: "The version of an Indian mutual fund sold through a distributor, who is paid a commission from your money every year." },
  { term: "ELSS", pattern: /\bELSS\b/, meaning: "Equity-linked savings scheme: an Indian share fund with a 3-year lock-in, which reduces tax under the old tax regime." },
  { term: "exit load", pattern: /\bexit loads?\b/i, meaning: "A fee some mutual funds charge if you sell within a set time, often within a year." },
  { term: "PPF", pattern: /\bPPF\b/, meaning: "Public Provident Fund: an Indian government savings scheme with a fixed interest rate, tax benefits, and a 15-year lock-in." },
  { term: "NPS", pattern: /\bNPS\b/, meaning: "National Pension System: an Indian retirement account with extra tax benefits; most of the money stays invested until 60." },
  { term: "EPF", pattern: /\bEPF\b/, meaning: "Employees' Provident Fund: retirement savings for salaried people in India, paid in by both you and your employer." },
  { term: "LTCG", pattern: /\bLTCG\b|\blong-term capital gains?\b/i, meaning: "Long-term capital gains: profit on investments held longer than a set period (a year for Indian shares and equity funds), taxed at a lower rate above a yearly tax-free amount." },
  { term: "STCG", pattern: /\bSTCG\b|\bshort-term capital gains?\b/i, meaning: "Short-term capital gains: profit on investments sold within the short-term period, usually taxed at a higher rate than long-term gains." },
  { term: "Nifty 50", pattern: /\bNifty 50\b/, meaning: "A list of 50 of the biggest companies on India's National Stock Exchange, used to measure the Indian market." },
  { term: "Sensex", pattern: /\bSensex\b/, meaning: "A list of 30 big companies on the Bombay Stock Exchange, another measure of the Indian market." },
  { term: "demat account", pattern: /\bdemat(?: accounts?)?\b/i, meaning: "An account that holds your shares and ETFs electronically in India, needed to buy them on the exchange." },
  { term: "XIRR", pattern: /\bXIRR\b/, meaning: "A yearly return that accounts for money going in at different times, like monthly SIP payments." },
  { term: "flexi-cap fund", pattern: /\bflexi-?cap(?: funds?)?\b/i, meaning: "An Indian fund that can invest in companies of any size: large, mid-sized, or small." },
  { term: "index fund", pattern: /\bindex funds?\b|\btrackers?\b/i, meaning: "A fund that buys every company in a list, such as the FTSE 100 or Nifty 50, instead of picking a few. Usually cheap and widely spread." },
  { term: "ETF", pattern: /\bETFs?\b/, meaning: "Exchange-traded fund: a fund you buy and sell on the stock exchange like a share, often tracking an index." },
  { term: "discount rate", pattern: /\bdiscount rates?\b/i, meaning: "The yearly return investors want for the risk of owning a share. Future cash is worth less today, and a higher discount rate means a lower value now." },
  { term: "free cash flow", pattern: /\bfree cash flows?\b/i, meaning: "Cash a company has left after paying its running costs and investing in the business: what it could pay out to shareholders." },
  { term: "intrinsic value", pattern: /\bintrinsic values?\b/i, meaning: "What a business is worth from the cash it will make in future, whatever the share price says today. It's always an estimate." },
  { term: "margin of safety", pattern: /\bmargins? of safety\b/i, meaning: "Buying well below your estimate of a share's value, so a mistake in the estimate doesn't cost you. The core idea of value investing." },
  { term: "moat", pattern: /\b(?:economic )?moats?\b/i, meaning: "A lasting advantage, such as a strong brand, low costs or a network, that keeps competitors from eating into a company's profits." },
  { term: "reverse DCF", pattern: /\breverse (?:DCF|discounted cash flow)\b/i, meaning: "Working backwards from today's share price to the growth it assumes, instead of guessing growth to reach a price." },
  { term: "DCF", pattern: /\bDCF\b|\bdiscounted cash flow\b/i, meaning: "Discounted cash flow: valuing a company by adding up the cash it will make in future, each year's worth less the further away it is." },
  { term: "equity risk premium", pattern: /\bequity risk premiums?\b/i, meaning: "The extra yearly return investors want for owning shares rather than safe government bonds, often taken as about 5%." },
  { term: "beta", pattern: /\bbetas?\b(?! version)/, meaning: "How much a share's price swings compared with the whole stock market: 1 moves with it, above 1 swings more, below 1 swings less." },
  { term: "return on equity", pattern: /\breturn on equity\b|\bROE\b/, meaning: "A year's profit as a percentage of the money shareholders have in the business. Steadily high ROE can be a sign of a moat." },
  { term: "price/book", pattern: /\bprice[- /]to[- ]book\b|\bprice\/book\b|\bP\/B\b/i, meaning: "A company's market value divided by its book value: what it owns minus what it owes." },
  { term: "book value", pattern: /\bbook values?\b/i, meaning: "What a company owns minus what it owes, as shown in its accounts." },
  { term: "EV/EBITDA", pattern: /\bEV\/EBITDA\b/, meaning: "The value of the whole business, debt included, divided by a year's operating profit before depreciation. Useful for comparing companies with different amounts of debt." },
  { term: "EBITDA", pattern: /\bEBITDA\b/, meaning: "Earnings before interest, tax, depreciation and amortisation: a rough measure of operating profit." },
  { term: "PEG", pattern: /\bPEG(?: ratio)?\b/, meaning: "The P/E divided by yearly profit growth. Around 1 means the price is in line with growth; well above 1 means paying more for each bit of growth." },
  { term: "earnings yield", pattern: /\bearnings yields?\b/i, meaning: "A year's profit as a percentage of the share price: the P/E turned upside down. Handy for comparing with bond yields." },
  { term: "payout ratio", pattern: /\bpayout ratios?\b/i, meaning: "The share of profit a company pays out as dividends." },
  { term: "REIT", pattern: /\bREITs?\b/, meaning: "Real estate investment trust: a company that owns property and must pay out most of its rental income as dividends." },
  { term: "value investing", pattern: /\bvalue investing\b|\bvalue investors?\b/i, meaning: "Buying shares for less than you estimate the business is worth, and holding while the price catches up. Associated with Benjamin Graham and Warren Buffett." },
  { term: "yield", pattern: /\bbond yields?\b/i, meaning: "The yearly return a lender gets from a bond at today's price. When yields rise, existing bond prices fall." },
  { term: "P/E", pattern: /\bP\/E\b/, meaning: "Price-to-earnings: the share price compared with a year of the company's profit per share. Higher means investors are paying more for each pound of profit." },
  { term: "dividend yield", pattern: /\bdividend yields?\b/i, meaning: "A year's dividends as a percentage of the share price." },
  { term: "market value", pattern: /\bmarket cap(?:italisation|italization)?\b/i, meaning: "What the whole company is worth on the stock market: the share price times the number of shares." },
  { term: "bond", pattern: /\bbonds?\b/i, meaning: "A loan to a government or company that pays interest. Usually steadier than shares." },
  { term: "rebalancing", pattern: /\brebalanc(?:e|ing)\b/i, meaning: "Moving money between investments now and then to get back to the mix you planned." },
  { term: "emerging markets", pattern: /\bemerging markets?\b/i, meaning: "Countries whose economies are still developing, such as India, Brazil, or China. Often faster-growing but bumpier." },
];

type HastNode = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

// Inside these, terms are left alone: links, code, headings, and terms already marked.
const SKIP = new Set(["a", "code", "pre", "h1", "h2", "h3", "h4", "h5", "h6", "abbr"]);

/** A rehype plugin that wraps the first use of each glossary term in <span class="gloss">. */
export function rehypeGlossary() {
  return (tree: HastNode) => {
    const used = new Set<string>();

    const split = (text: string): HastNode[] => {
      // The earliest unused term in this text.
      let best: { index: number; length: number; term: string } | null = null;
      for (const g of GLOSSARY) {
        if (used.has(g.term)) continue;
        const m = g.pattern.exec(text);
        if (m && (!best || m.index < best.index)) best = { index: m.index, length: m[0].length, term: g.term };
      }
      if (!best) return [{ type: "text", value: text }];
      used.add(best.term);
      const word = text.slice(best.index, best.index + best.length);
      return [
        ...(best.index ? [{ type: "text", value: text.slice(0, best.index) }] : []),
        {
          type: "element",
          tagName: "span",
          properties: { className: ["gloss"], dataTerm: best.term },
          children: [{ type: "text", value: word }],
        },
        ...split(text.slice(best.index + best.length)),
      ];
    };

    const walk = (node: HastNode) => {
      if (!node.children || (node.tagName && SKIP.has(node.tagName))) return;
      node.children = node.children.flatMap((child) => {
        if (child.type === "text" && child.value) return split(child.value);
        walk(child);
        return [child];
      });
    };
    walk(tree);
  };
}

export const meaningOf = (term: string) => GLOSSARY.find((g) => g.term === term)?.meaning;
