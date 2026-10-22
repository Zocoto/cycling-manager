import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createDraftFixture } from "@/test/fixtures/season-draft";
import { SeasonDraftPanel } from "./season-draft-panel";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/jeu/draft/actions", () => ({ updateSeasonDraft: vi.fn() }));

describe("page de draft", () => {
  it("reste concise, révèle les stats et limite les portraits à 20 par page", () => {
    const html = renderToStaticMarkup(<SeasonDraftPanel view={createDraftFixture()} />);
    expect(html).toContain("Sélections à 14 h");
    expect(html).toContain("Ma liste de préférences");
    expect(html).toContain("Kaffa Origins");
    expect(html).toContain("MON");
    expect(html).toContain("SPR");
    expect(html).toContain("VAL");
    expect(html).not.toContain("fourchette");
    expect(html).not.toContain("Exemple 21");
    expect(html.match(/<article/g)).toHaveLength(20);
    expect(html).toContain("Autoriser le recrutement automatique");
    expect(html).not.toContain(">Recruter</button>");
  });
  it("présente les horaires avant l’ouverture sans dévoiler de faux coureurs", () => {
    const fixture = createDraftFixture();
    fixture.edition!.status = "scheduled";
    const html = renderToStaticMarkup(<SeasonDraftPanel view={fixture} />);
    expect(html).toContain("Rendez-vous à J1 dès 8 h");
    expect(html).not.toContain("Exemple 1");
    expect(html).not.toContain("Valider ma sélection");
  });
  it("n’offre le recrutement qu’au joueur dont c’est le tour", () => {
    const fixture = createDraftFixture();
    fixture.edition!.status = "running";
    fixture.edition!.currentPosition = fixture.mine!.position;
    fixture.edition!.deadline = "2026-11-06T13:15:00+01:00";
    const html = renderToStaticMarkup(<SeasonDraftPanel view={fixture} />);
    expect(html).toContain("C’est votre tour !");
    expect(html).toContain(">Recruter</button>");
    expect(html).toContain("5:00");
  });
});
