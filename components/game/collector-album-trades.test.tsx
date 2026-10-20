import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import raw from "@/data/collector-album-pilot.json";
import { createAlbumPilotState, type CollectorAlbumSnapshot } from "@/lib/game/collector-album";
import { CollectorAlbumTradeDesk } from "./collector-album-trades";

const snapshot = raw as CollectorAlbumSnapshot;

describe("private collector trade discovery presentation", () => {
  it("opens the composer on the requested card without selecting a partner or reserving anything", () => {
    const onAction = vi.fn();
    const html = renderToStaticMarkup(<CollectorAlbumTradeDesk state={createAlbumPilotState()} snapshot={snapshot} ready onAction={onAction} requestedCard={42} />);
    expect(html).toContain('aria-label="Composer un échange"');
    expect(html).toContain('aria-pressed="true">Chercher une carte');
    expect(html).toMatch(/<option value="42" selected="">/);
    expect(html).toMatch(/aria-label="Les DS qui possèdent cette carte"[^>]*><option value="" selected="">/);
    expect(html).toMatch(/disabled="">Proposer cet échange de démonstration/);
    expect(onAction).not.toHaveBeenCalled();
  });

  it("lists only still-missing wanted cards and keeps a visible fictional-collector warning", () => {
    const html = renderToStaticMarkup(<CollectorAlbumTradeDesk state={createAlbumPilotState()} snapshot={snapshot} ready onAction={() => {}} wanted={[1, 9, 42, 999]} onToggleWanted={() => {}} />);
    expect(html).toContain("MES RECHERCHES · 2");
    expect(html).toContain("Toutes mes cartes manquantes · 48");
    expect(html).toContain("les trois collectionneurs sont fictifs");
    expect(html).toContain("aucun message ni e-mail n’est envoyé à un vrai joueur");
    expect(html).toContain("Pas encore de doublon libre à suggérer");
    expect(html).not.toContain("Préparer cette proposition");
  });

  it("renders bounded reciprocal suggestions with a separate explicit proposal action", () => {
    const onAction = vi.fn();
    const state = { ...createAlbumPilotState(), owned: [1, 8, 8] };
    const html = renderToStaticMarkup(<CollectorAlbumTradeDesk state={state} snapshot={snapshot} ready onAction={onAction} wanted={[42]} />);
    expect(html).toContain("Correspondance réciproque");
    expect(html.match(/>Préparer cette proposition</g)).toHaveLength(4);
    expect(html).toContain("Préparer une proposition ne réserve aucune carte");
    expect(onAction).not.toHaveBeenCalled();
    expect(state.pending).toBeNull();
  });

  it("handles an unknown requested card without opening a broken composer", () => {
    const html = renderToStaticMarkup(<CollectorAlbumTradeDesk state={createAlbumPilotState()} snapshot={snapshot} ready onAction={() => {}} requestedCard={999} />);
    expect(html).not.toContain('aria-label="Composer un échange"');
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("NaN");
  });

  it("keeps an unavailable requested card selected and explains the empty result", () => {
    const html = renderToStaticMarkup(<CollectorAlbumTradeDesk state={createAlbumPilotState()} snapshot={snapshot} ready onAction={() => {}} requestedCard={50} />);
    expect(html).toMatch(/<option value="50" selected="">/);
    expect(html).toContain("Aucun des collectionneurs fictifs ne possède cette carte");
  });
});
