import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import snapshotData from "@/data/collector-album-pilot.json";
import { createAlbumPilotState, getAlbumPilotPacks, updateAlbumPilot, type CollectorAlbumSnapshot } from "@/lib/game/collector-album";
import { CollectorAlbumBoosters, getAlbumPackDiscovery, getAlbumPackHistoryLabel, getAlbumPackPasteableCards } from "./collector-album-boosters";

const snapshot = snapshotData as CollectorAlbumSnapshot;

describe("private sachet discovery", () => {
  it("classifies the draw against possession before opening, without mutating inventory", () => {
    const before = [1, 8];
    expect(getAlbumPackDiscovery([9, 8], before, [])).toEqual(["new", "duplicate"]);
    expect(before).toEqual([1, 8]);
  });

  it("only calls the first unseen occurrence new when the sachet contains the same card twice", () => {
    expect(getAlbumPackDiscovery([9, 9], [1, 8], [])).toEqual(["new", "duplicate"]);
    expect(getAlbumPackDiscovery([8, 8], [1, 8], [])).toEqual(["duplicate", "duplicate"]);
  });

  it("distinguishes a card already pasted from a loose duplicate", () => {
    expect(getAlbumPackDiscovery([1, 8], [1, 8], [1])).toEqual(["pasted", "duplicate"]);
  });

  it("describes current possession for old packs instead of claiming rediscovered new cards", () => {
    const state = { ...createAlbumPilotState(), owned: [1, 8, 8, 9, 12], pasted: [1], pending: { give: [12], receive: 42, partnerId: "collector-demo" } };
    expect(getAlbumPackHistoryLabel(state, 1)).toBe("Déjà dans l’album");
    expect(getAlbumPackHistoryLabel(state, 8)).toBe("Doublon disponible");
    expect(getAlbumPackHistoryLabel(state, 9)).toBe("À coller dans l’album");
    expect(getAlbumPackHistoryLabel(state, 12)).toBe("Réservée pour un échange");
    expect(getAlbumPackHistoryLabel(state, 27)).toBe("Tirée dans ce sachet");
  });

  it("only proposes unique, currently available unpasted cards for direct collage", () => {
    const state = { ...createAlbumPilotState(), owned: [1, 8, 9, 9, 12], pasted: [1], pending: { give: [8], receive: 42, partnerId: "collector-demo" } };
    expect(getAlbumPackPasteableCards(state, [1, 8, 9, 9, 12, 27])).toEqual([9, 12]);
    expect(state.pasted).toEqual([1]);
  });

  it("renders unopened sachets without revealing future riders or dispatching actions", () => {
    const onAction = vi.fn();
    const html = renderToStaticMarkup(<CollectorAlbumBoosters state={createAlbumPilotState()} snapshot={snapshot} ready onAction={onAction} onViewAlbum={() => {}}/>);
    expect(html.match(/Déchirer le sachet/g)).toHaveLength(2);
    expect(html).not.toContain("data-album-card");
    expect(html).not.toContain("data-album-pack-mode");
    expect(onAction).not.toHaveBeenCalled();
  });

  it("revisits a saved sachet with both faces visible and no simulated new opening", () => {
    const initial = createAlbumPilotState();
    const pack = getAlbumPilotPacks(initial.season)[0];
    const state = updateAlbumPilot(initial, { type: "open-pack", id: pack.id, season: initial.season, cards: [9, 9] });
    const before = JSON.stringify(state);
    const onAction = vi.fn();
    const html = renderToStaticMarkup(<CollectorAlbumBoosters state={state} snapshot={snapshot} ready onAction={onAction} onViewAlbum={() => {}} onPasteCards={() => {}}/>);
    expect(html).toContain('data-album-pack-mode="history"');
    expect(html.match(/\bdata-album-card=/g)).toHaveLength(2);
    expect(html.match(/data-album-discovery-status="history"/g)).toHaveLength(2);
    expect(html).not.toContain("Nouvelle vignette");
    expect(html).not.toContain("Tout révéler");
    expect(html).toContain("Coller ces vignettes");
    expect(onAction).not.toHaveBeenCalled();
    expect(JSON.stringify(state)).toBe(before);
  });

  it("keeps all additional animation opt-in to ordinary motion preferences", () => {
    const css = readFileSync(path.join(process.cwd(), "components/game/collector-album-discovery.module.css"), "utf8");
    expect(css).toContain("@media (prefers-reduced-motion: no-preference)");
    const outsideMotion = css.slice(0, css.indexOf("@media (prefers-reduced-motion: no-preference)"));
    expect(outsideMotion).not.toMatch(/\banimation:|\btransition:/);
  });
});
