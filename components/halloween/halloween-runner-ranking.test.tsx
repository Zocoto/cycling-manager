import { readFileSync, writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HalloweenRunnerRanking } from "./halloween-runner-ranking";
import type { HalloweenState } from "@/lib/game/halloween-event";

const state = { ranking: [
  { userId: "1", name: "Le cycliste de minuit", score: 2418, distance: 1368, coins: 42, attempts: 7 },
  { userId: "2", name: "La sorcière du peloton", score: 2050, distance: 1050, coins: 40, attempts: 3 },
  { userId: "3", name: "Le cavalier sans tête", score: 1725, distance: 950, coins: 31, attempts: 5 },
  { userId: "4", name: "Un nom de directeur sportif particulièrement long", score: 1200, distance: 700, coins: 20, attempts: 1 },
], dailyRanking: [] } as unknown as HalloweenState;

describe("Halloween rankings", () => {
  it("shows validated attempt counts and highlights the podium", () => {
    const html = renderToStaticMarkup(<HalloweenRunnerRanking state={state} />);
    expect(html).toContain("<th>Essais</th>");
    expect(html).toContain('class="halloween-ranking-attempts">7</span>');
    for (const rank of [1, 2, 3]) expect(html).toContain(`data-podium="${rank}"`);
    expect(html).not.toContain('data-podium="4"');
    expect(html).toContain("essais validés sur l’événement");
    if (process.env.HALLOWEEN_RANKING_PREVIEW_PATH) {
      const css = readFileSync("components/halloween/halloween.css", "utf8");
      writeFileSync(process.env.HALLOWEEN_RANKING_PREVIEW_PATH, `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}body{margin:0;background:#f6f2e9;font-family:Arial,sans-serif}.halloween-preview{padding:24px;max-width:1250px;margin:auto;box-sizing:border-box}@media(max-width:600px){.halloween-preview{padding:12px}}</style><main class="halloween-preview">${html}</main></html>`);
    }
  });
  it("handles an empty ranking", () => {
    expect(renderToStaticMarkup(<HalloweenRunnerRanking state={{ ...state, ranking: [] }} />)).toContain("La nuit attend ses premiers records");
  });
  it("exposes the same ranking on the event home and the rankings tab", () => {
    const event = readFileSync("components/halloween/halloween-event.tsx", "utf8");
    expect(event).toContain('<HalloweenEventHome onSelect={selectActivity} /><HalloweenRunnerRanking state={state} />');
    expect(readFileSync("components/halloween/halloween-runner-overview.tsx", "utf8")).toContain("<HalloweenRunnerRanking state={state} showPrizes />");
  });
});
