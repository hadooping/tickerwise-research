// Analyst ratings in plain colours. Firms use their own words for the same view ("Overweight" at one
// bank is "Outperform" at another), so each is sorted into one of five steps from strong buy to
// strong sell, each with a colour: greens for buy, amber for hold, oranges and reds for sell.

export type RatingStep = "strongBuy" | "buy" | "hold" | "sell" | "strongSell";

export const STEPS: { key: RatingStep; label: string; color: string; score: number }[] = [
  { key: "strongBuy", label: "Strong buy", color: "light-dark(#137333, #3fb950)", score: 5 },
  { key: "buy", label: "Buy", color: "light-dark(#5aa469, #2ea043)", score: 4 },
  { key: "hold", label: "Hold", color: "light-dark(#c98500, #d29922)", score: 3 },
  { key: "sell", label: "Sell", color: "light-dark(#e8590c, #db6d28)", score: 2 },
  { key: "strongSell", label: "Strong sell", color: "light-dark(#b42318, #f85149)", score: 1 },
];

const WORDS: [RegExp, RatingStep][] = [
  [/^(strong[ -]?buy|top pick|conviction buy)$/i, "strongBuy"],
  [/^(strong[ -]?sell)$/i, "strongSell"],
  [/^(buy|outperform|overweight|accumulate|positive|add|market outperform|sector outperform|outperformer)$/i, "buy"],
  [/^(hold|neutral|equal[ -]?weight|market perform|sector perform|peer perform|in[ -]line|market weight|sector weight|perform)$/i, "hold"],
  [/^(sell|underperform|underweight|reduce|negative|market underperform|sector underperform|underperformer)$/i, "sell"],
];

/** Which step a firm's rating word belongs to, or null if it isn't a rating. */
export function stepOf(rating: string | null | undefined): RatingStep | null {
  const word = (rating ?? "").trim();
  return WORDS.find(([re]) => re.test(word))?.[1] ?? null;
}

export const stepInfo = (key: RatingStep) => STEPS.find((s) => s.key === key)!;

// Whether a change in the number of analysts on a rating makes the overall view more positive:
// more buys or fewer sells is a step up, fewer buys or more sells a step down; holds are neutral.
export function changeTone(step: RatingStep, delta: number): "better" | "worse" | "flat" {
  if (delta === 0 || step === "hold") return "flat";
  const buySide = step === "strongBuy" || step === "buy";
  return (delta > 0) === buySide ? "better" : "worse";
}

type HastNode = { type: string; value?: string; tagName?: string; properties?: Record<string, unknown>; children?: HastNode[] };
const textOf = (n: HastNode): string => (n.type === "text" ? (n.value ?? "") : (n.children ?? []).map(textOf).join(""));
const CHANGE = /^([▲▼+−-])\s?(\d+)$/;

/** A rehype plugin for analysts' rating tables in answers: in a row whose first cell is a rating,
 *  a cell holding a change ("▲ 1", "▼ 2", "+1") is coloured by whether it makes the view more or
 *  less positive, so "▲ 1" on Sell shows as a step down. */
export function rehypeRatingChanges() {
  return (tree: HastNode) => {
    const walk = (node: HastNode) => {
      if (node.tagName === "tr") {
        const cells = (node.children ?? []).filter((c) => c.tagName === "td" || c.tagName === "th");
        const step = cells.length ? stepOf(textOf(cells[0]).trim()) : null;
        if (step) {
          for (const cell of cells.slice(1)) {
            const m = CHANGE.exec(textOf(cell).trim());
            if (!m) continue;
            const delta = Number(m[2]) * (m[1] === "▼" || m[1] === "−" || m[1] === "-" ? -1 : 1);
            cell.children = [
              { type: "element", tagName: "span", properties: { className: ["rating-change", `rating-${changeTone(step, delta)}`] }, children: cell.children ?? [] },
            ];
          }
        }
        return;
      }
      (node.children ?? []).forEach(walk);
    };
    walk(tree);
  };
}
