import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CyclogazetteJerseyReveal } from "./cyclogazette-jersey-reveal";
import { RiderAvatar } from "./rider-avatar";
import type { CyclogazetteJerseyReveal as Reveal } from "@/lib/game/cyclogazette-jerseys";
import { normalizeNationalJerseyDraft } from "@/lib/game/national-jersey-preview";

const reveal: Reveal = { countryCode: "FR", countryName: "France", kind: "national_champion", design: normalizeNationalJerseyDraft({ baseColor: "#12AB34", elements: [{ kind: "text", text: "AU BAS", y: 118, border: false }] as never }), version: 2, publishedAt: "2026-10-18T09:00:00Z", rider: { id: "rider", name: "Jean Martin", avatarProfileKey: "europe_west", avatarSeed: "123", championshipType: "road" } };

describe("portrait de présentation d’un nouveau maillot", () => {
  it("affiche le visage et la totalité du maillot, y compris les éléments du bas", () => {
    const html = renderToStaticMarkup(<CyclogazetteJerseyReveal reveal={reveal} isEnglish={false} />);
    expect(html).toContain('viewBox="0 0 96 178"');
    expect(html).toContain('data-full-jersey-artwork="true"');
    expect(html).toContain("AU BAS");
    expect(html).toContain("Jean Martin porte le nouveau maillot");
    expect(html).toContain("Champion national sur route");
    expect(html).not.toContain('data-avatar-jersey-viewport="upper-body"');
  });
  it("présente un coureur du pays sans lui attribuer de titre pour la sélection", () => {
    const html = renderToStaticMarkup(<CyclogazetteJerseyReveal reveal={{ ...reveal, kind: "national_team" }} isEnglish={false} />);
    expect(html).toContain("Coureur de la nation");
    expect(html).not.toContain("Champion national sur route");
  });
  it("utilise le maillot seul si aucun champion actuel n’est disponible", () => {
    const html = renderToStaticMarkup(<CyclogazetteJerseyReveal reveal={{ ...reveal, rider: null }} isEnglish={false} />);
    expect(html).toContain('data-federation-jersey-kind="national_champion"');
    expect(html).not.toContain("Champion national sur route");
  });
  it("conserve l’avatar carré habituel dans toutes les autres pages", () => {
    const html = renderToStaticMarkup(<RiderAvatar seed="123" profileKey="europe_west" />);
    expect(html).toContain('viewBox="0 0 96 96"');
    expect(html).not.toContain('data-full-jersey-artwork="true"');
  });
  it("localise le libellé du champion du contre-la-montre", () => {
    const html = renderToStaticMarkup(<CyclogazetteJerseyReveal reveal={{ ...reveal, rider: { ...reveal.rider!, championshipType: "time_trial" } }} isEnglish />);
    expect(html).toContain("National time trial champion");
    expect(html).toContain("wearing the new jersey");
  });
});
