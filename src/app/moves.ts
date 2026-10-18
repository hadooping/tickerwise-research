// Colours ups and downs in answers so they stand out in long text: words that describe a move
// ("rose", "fell"), levels reached ("highest since 2007", "a record low", "new highs"), and changes
// with a number ("+1.2%", "−7.3%", "up 5%", "down £120") are wrapped
// in <span class="move-up"> or <span class="move-down">. Numbers also get class "move-num", which
// adds ▲ or ▼ in CSS, so the direction doesn't rely on colour alone (and isn't copied with the text).
// Colour shows direction, not good or bad: rising yields are green even though borrowers pay more.

type HastNode = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

const UP_WORDS = [
  "rise", "rises", "rising", "rose", "risen", "jump", "jumped", "jumps", "surge", "surged", "surging", "soared", "soaring",
  "climb", "climbed", "climbing", "climbs", "gained", "increased", "rallied", "rebounded", "higher",
];
const DOWN_WORDS = [
  "fall", "falls", "falling", "fell", "fallen", "drop", "dropped", "drops", "slump", "slumped", "plunge", "plunged", "plunging", "tumbled",
  "declined", "declining", "sank", "slid", "lost", "crashed", "decreased", "lower",
];
// A number with a currency or a unit that shows it's a change: 5%, 1.2 points, £120, 30 bps.
const AMOUNT = String.raw`[£$₹]?\d[\d,]*(?:\.\d+)?\s?(?:%|percentage points?\b|points?\b|pts?\b|bps\b|basis points\b|lakh\b|crore\b)?`;
const MOVE = new RegExp(
  [
    // A sign in front: +1.2%, −7.3%, -£120 (not ranges like 1994-2008, where a digit comes first).
    String.raw`(?<![\w.,/–-])(?<sign>[+−-])\s?(?<signed>[£$₹]?\d[\d,]*(?:\.\d+)?\s?(?:%|percentage points?\b|points?\b|pts?\b|bps\b|basis points\b)|[£$₹]\d[\d,]*(?:\.\d+)?)`,
    // An arrow and an amount, as in a change column: "▲ 1.2 points", "▼ 3%", "▲ £120", "▼ 2".
    String.raw`(?<arrow>[▲▼])\s?(?<arrowAmount>${AMOUNT})(?=[\s.,;:)]|$)`,
    // "up 5%", "down by £120".
    String.raw`\b(?<dir>up|down)\s+(?:by\s+)?(?<dirAmount>${AMOUNT})(?=[\s.,;:)]|$)`,
    // A level reached: "highest since", "lowest ever", "lows", "a record high", "the 52-week low", "a high
    // of", "low since". A plain "the highest dividend yield" ranks companies, so it stays uncoloured.
    String.raw`\b(?<level>(?:(?:record|all-time|52-week|multi-year|new|year|decade|\d+-(?:year|month|week))[\s-]+(?:high|low)s?|(?:highest|lowest)(?=\s+(?:since|ever|on record|in (?:\d|a|over|decades|years|months))\b|\s+level\b)|highs|lows|(?:high|low)(?=\s+(?:of|since)\b)))\b`,
    // A movement word on its own.
    String.raw`\b(?<word>${[...UP_WORDS, ...DOWN_WORDS].join("|")})\b`,
  ].join("|"),
  "gi"
);
const UP = new Set(UP_WORDS);
// Words that look like moves but aren't, judged by the word before ("free fall" stays plain).
const NOT_A_MOVE = /\b(?:free|night)\s+$/i;

// Inside these, text is left alone: links, code, headings, and terms already marked.
const SKIP = new Set(["a", "code", "pre", "h1", "h2", "h3", "h4", "h5", "h6"]);
// Changes in analysts' rating tables are coloured by meaning (ratings.ts), so they're left alone.
const skipClass = (node: HastNode) => {
  const cls = node.properties?.className;
  return Array.isArray(cls) && cls.includes("rating-change");
};

function span(text: string, up: boolean, number: boolean): HastNode {
  return {
    type: "element",
    tagName: "span",
    properties: { className: [up ? "move-up" : "move-down", ...(number ? ["move-num"] : [])] },
    children: [{ type: "text", value: text }],
  };
}

function split(text: string): HastNode[] {
  const out: HastNode[] = [];
  let last = 0;
  for (const m of text.matchAll(MOVE)) {
    const g = m.groups ?? {};
    const start = m.index ?? 0;
    let node: HastNode | null = null;
    if (g.sign) node = span(m[0], g.sign === "+", true);
    else if (g.arrow) node = span(m[0], g.arrow === "▲", false); // the arrow is already in the text
    else if (g.dir) node = span(m[0], g.dir.toLowerCase() === "up", true);
    else if (g.level) node = span(m[0], /high/i.test(g.level), false);
    else if (g.word && !NOT_A_MOVE.test(text.slice(0, start))) node = span(m[0], UP.has(g.word.toLowerCase()), false);
    if (!node) continue;
    if (start > last) out.push({ type: "text", value: text.slice(last, start) });
    out.push(node);
    last = start + m[0].length;
  }
  if (!out.length) return [{ type: "text", value: text }];
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}

/** A rehype plugin that colours ups and downs (see above). Run it after rehypeGlossary. */
export function rehypeMoves() {
  return (tree: HastNode) => {
    const walk = (node: HastNode) => {
      if (!node.children || (node.tagName && SKIP.has(node.tagName)) || skipClass(node)) return;
      node.children = node.children.flatMap((child) => {
        if (child.type === "text" && child.value) return split(child.value);
        walk(child);
        return [child];
      });
    };
    walk(tree);
  };
}
