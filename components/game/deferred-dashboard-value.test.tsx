import { renderToReadableStream } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DeferredDashboardValue } from "./deferred-dashboard-value";

describe("optional dashboard streaming", () => {
  it("renders the usable shell before a slow optional read, then fills the existing slot", async () => {
    let finish!: (value: string) => void;
    const pending = new Promise<string>(resolve => { finish=resolve; });
    const stream = await renderToReadableStream(<main>
      <a href="/jeu/effectif">Effectif disponible</a>
      <DeferredDashboardValue promise={pending} fallback={<span>Réputation : 87 points</span>}>
        {value => <span>Détail de réputation : {value}</span>}
      </DeferredDashboardValue>
    </main>);
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    const initial = decoder.decode((await reader.read()).value);
    expect(initial).toContain("Effectif disponible");
    expect(initial).toContain("87 points");
    expect(initial).not.toContain("Détail de réputation");
    finish("87 points, détail chargé");
    let remaining="";
    for (;;) { const chunk=await reader.read(); if(chunk.done) break; remaining+=decoder.decode(chunk.value); }
    expect(remaining).toContain("Détail de réputation");
    expect(remaining).toContain("détail chargé");
  });
});
