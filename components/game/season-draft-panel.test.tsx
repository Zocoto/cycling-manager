import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createDraftFixture } from "@/test/fixtures/season-draft";
import { SeasonDraftPanel } from "./season-draft-panel";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/jeu/draft/actions", () => ({ updateSeasonDraft: vi.fn() }));

const draftUi = vi.hoisted(() => ({ confirmation: null as string | null }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) => actual.useState(initial === null && draftUi.confirmation !== null ? draftUi.confirmation : initial),
  };
});
afterEach(() => { draftUi.confirmation = null; });

describe("page de draft", () => {
  it("prechecks automatic recruitment for a new preparation", () => {
    const html = renderToStaticMarkup(<SeasonDraftPanel view={createDraftFixture()} />);
    const checkbox = html.match(/<input\b[^>]*type="checkbox"[^>]*>/)?.[0];
    expect(checkbox).toBeDefined();
    expect(checkbox).toContain('checked=""');
  });

  it("keeps an already saved manual choice unchecked", () => {
    const fixture = createDraftFixture();
    fixture.mine!.autoEnabled = false;
    fixture.mine!.preferences = [fixture.riders![0].id];
    const html = renderToStaticMarkup(<SeasonDraftPanel view={fixture} />);
    const checkbox = html.match(/<input\b[^>]*type="checkbox"[^>]*>/)?.[0];
    expect(checkbox).toBeDefined();
    expect(checkbox).not.toContain('checked=""');
  });

  it("marks only saved preparation, independently of the viewer's automatic setting", () => {
    const fixture = createDraftFixture();
    fixture.participants![0].hasPreferences = true;
    fixture.participants![1].hasPreferences = false;
    fixture.mine!.autoEnabled = false;
    const html = renderToStaticMarkup(<SeasonDraftPanel view={fixture} />);
    const tiles = html.match(/<li\b[^>]*>[\s\S]*?<\/li>/g) ?? [];
    const ready = tiles.find(tile => tile.includes("Dodo Blue Finance"))!;
    const unready = tiles.find(tile => tile.includes("Kaffa Origins"))!;
    expect(ready).toContain("bg-[#E8F5EC]");
    expect(ready).toContain("✓ Liste de choix validée");
    expect(unready).not.toContain("Liste de choix validée");
    expect(unready).not.toContain("bg-[#E8F5EC]");
  });

  it("keeps a prepared current team's turn visible alongside its green status", () => {
    const fixture = createDraftFixture();
    fixture.edition!.status = "running";
    fixture.edition!.currentPosition = fixture.participants![0].position;
    fixture.participants![0].hasPreferences = true;
    const html = renderToStaticMarkup(<SeasonDraftPanel view={fixture} />);
    const tile = html.match(/<li\b[^>]*>[\s\S]*?<\/li>/g)?.find(item => item.includes("Dodo Blue Finance"));
    expect(tile).toContain("bg-[#E8F5EC]");
    expect(tile).toContain("ring-[#D5A54D]");
    expect(tile).toContain("À son tour");
  });

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
    expect(html).toContain("10 minutes par choix");
    expect(html).toContain("recrute immédiatement");
    expect(html).toContain("validez avant votre tour");
    expect(html).toContain("Seules les modifications validées sont prises en compte");
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
    fixture.serverNow = "2026-11-06T14:00:00+01:00";
    fixture.edition!.deadline = "2026-11-06T14:10:00+01:00";
    const html = renderToStaticMarkup(<SeasonDraftPanel view={fixture} />);
    expect(html).toContain("C’est votre tour !");
    expect(html).toContain(">Recruter</button>");
    expect(html).toContain("10:00");
  });

  it("allows the complete 100-rider pool in preferences while showing 20 cards per page", () => {
    const fixture = createDraftFixture();
    const rider = fixture.riders![0];
    fixture.riders = Array.from({ length: 100 }, (_, index) => ({ ...rider, id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, lastName: `Pool ${index + 1}`, poolRank: index + 1 }));
    fixture.edition!.poolCount = 100;
    fixture.mine!.preferences = fixture.riders.map((candidate) => candidate.id);
    const html = renderToStaticMarkup(<SeasonDraftPanel view={fixture} />);
    expect(html).toContain("100 choix");
    expect(html).toContain("Votre liste s’allonge à chaque ajout, jusqu’à tous les coureurs du vivier");
    expect(html.match(/<article/g)).toHaveLength(20);
    expect(html).toContain("1 / 5");
  });

  it.each([
    ["one second before", "2026-11-06T14:09:59+01:00", false],
    ["at the deadline", "2026-11-06T14:10:00+01:00", true],
    ["after the deadline", "2026-11-06T14:10:01+01:00", true],
  ])("guards an already open confirmation %s", (_description, time, blocked) => {
    const fixture = createDraftFixture();
    fixture.edition!.status = "running";
    fixture.edition!.currentPosition = fixture.mine!.position;
    fixture.edition!.deadline = "2026-11-06T14:10:00+01:00";
    fixture.serverNow = time as string;
    draftUi.confirmation = fixture.riders![0].id;
    const html = renderToStaticMarkup(<SeasonDraftPanel view={fixture} />);
    const confirm = html.match(/<button\b[^>]*>Confirmer<\/button>/)?.[0];
    expect(confirm).toBeDefined();
    expect(/\sdisabled(?:=|\s|>)/.test(confirm!)).toBe(blocked);
    expect(html).toContain("Vous pouvez annuler avant de confirmer. Après confirmation, ce choix est définitif");
    expect(html.includes("Ce recrutement n’est plus possible")).toBe(blocked);
    expect(html).toMatch(/<button\b(?![^>]*disabled)[^>]*>Annuler<\/button>/);
  });

  it.each(["turn ended", "rider taken"])("guards an open confirmation after %s", (reason) => {
    const fixture = createDraftFixture();
    fixture.edition!.status = "running";
    fixture.edition!.currentPosition = reason === "turn ended" ? fixture.mine!.position + 1 : fixture.mine!.position;
    fixture.edition!.deadline = "2026-11-06T14:10:00+01:00";
    fixture.serverNow = "2026-11-06T14:05:00+01:00";
    draftUi.confirmation = fixture.riders![0].id;
    if (reason === "rider taken") fixture.riders![0].selectedTeamId = "other-team";
    const html = renderToStaticMarkup(<SeasonDraftPanel view={fixture} />);
    const confirm = html.match(/<button\b[^>]*>Confirmer<\/button>/)?.[0];
    expect(confirm).toBeDefined();
    expect(confirm).toMatch(/\sdisabled(?:=|\s|>)/);
    expect(html).toContain("Ce recrutement n’est plus possible");
  });
});
