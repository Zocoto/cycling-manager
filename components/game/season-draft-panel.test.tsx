import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createDraftFixture } from "@/test/fixtures/season-draft";
import { SeasonDraftPanel } from "./season-draft-panel";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/jeu/draft/actions", () => ({ updateSeasonDraft: vi.fn() }));

const draftUi = vi.hoisted(() => ({ confirmation: null as string | null, localPreferences: null as string[] | null }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      if (typeof initial === "function") {
        const value = initial();
        if (value && typeof value === "object" && "saved" in value && draftUi.localPreferences) {
          return actual.useState({ ...value, preferences: draftUi.localPreferences });
        }
        return actual.useState(value);
      }
      return actual.useState(initial === null && draftUi.confirmation !== null ? draftUi.confirmation : initial);
    },
  };
});
afterEach(() => { draftUi.confirmation = null; draftUi.localPreferences = null; });

describe("page de draft", () => {
  it("allows a draft choice with a negative projected budget and explains the salary",()=>{
    const view=createDraftFixture();view.finance!.budget=-10000;view.edition!.status="running";
    view.edition!.currentPosition=view.mine!.position;view.edition!.deadline="2026-11-06T14:20:00+01:00";
    view.serverNow="2026-11-06T14:10:00+01:00";
    const html=renderToStaticMarkup(<SeasonDraftPanel view={view} />);
    expect(html).toContain("Un budget projeté négatif ne bloque pas le recrutement de draft");
    const button=html.match(/<button\b[^>]*>Recruter<\/button>/)?.[0];
    expect(button).toBeDefined();expect(button).not.toMatch(/\sdisabled(?:=|\s|>)/);
  });
  it("shows the current choice and exact pending count near the countdown", () => {
    const view=createDraftFixture();view.edition!.status="running";view.edition!.currentPosition=1;
    const html=renderToStaticMarkup(<SeasonDraftPanel view={view} />);
    expect(html).toContain("Choix en cours : n°");expect(html).toContain("DS avant votre tour");
  });
  it("exposes the picked rider and team immediately, as well as in full history",()=>{
    const view=createDraftFixture();view.participants![0].status="picked";
    view.participants![0].selectedRiderId=view.riders![0].id;view.participants![0].selectedName="Alex Dernier choix";
    const html=renderToStaticMarkup(<SeasonDraftPanel view={view} />);
    const live=html.match(/<section\b[^>]*aria-label="Derniers choix de la draft"[\s\S]*?<\/section>/)?.[0];
    expect(live).toContain("Alex Dernier choix");expect(live).toContain("Dodo Blue Finance");expect(live).toContain("Voir tous les choix");
    expect(html).toContain('id="draft-order"');
  });
  it("keeps passed turns distinct from a rider recruitment in recent choices",()=>{
    const view=createDraftFixture();view.participants![0].status="passed";view.participants![0].reason="timeout";
    const html=renderToStaticMarkup(<SeasonDraftPanel view={view} />);
    const live=html.match(/<section\b[^>]*aria-label="Derniers choix de la draft"[\s\S]*?<\/section>/)?.[0];
    expect(live).toContain("Délai écoulé");expect(live).not.toContain("Coureur sélectionné");
  });
  it("keeps validation inside the preference card, including before any edit", () => {
    const html = renderToStaticMarkup(<SeasonDraftPanel view={createDraftFixture()} />);
    const card = html.match(/<aside\b[^>]*>[\s\S]*?<\/aside>/)?.[0];
    expect(card).toContain("Valider ma sélection");
    expect(card).toContain("Ajoutez vos choix, puis validez votre liste.");
    expect(card).toContain("Votre liste reste modifiable après 14 h");
  });

  it("keeps unsaved mobile validation clear of navigation and the help launcher", () => {
    const fixture = createDraftFixture();
    draftUi.localPreferences = [fixture.riders![0].id];
    const html = renderToStaticMarkup(<SeasonDraftPanel view={fixture} />);
    const dock = html.match(/<div\b[^>]*aria-label="Validation de la liste"[^>]*>/)?.[0];
    expect(dock).toContain("mobile-dock-clearance");
    expect(dock).toContain("max-sm:right-[4.5rem]");
    expect(dock).toContain("env(safe-area-inset-bottom)");
    expect(dock).not.toContain("bottom-0");
    expect(html).toContain("Modifications non enregistrées.");
    const buttons = html.match(/<button\b[^>]*>Valider ma sélection<\/button>/g) ?? [];
    expect(buttons).toHaveLength(2);
    expect(buttons.every(button => !/\sdisabled(?:=|\s|>)/.test(button))).toBe(true);
  });

  it("keeps preferences editable after 14 h while an earlier participant is choosing", () => {
    const fixture = createDraftFixture();
    fixture.edition!.status = "running";
    fixture.edition!.currentPosition = fixture.mine!.position - 1;
    fixture.edition!.deadline = "2026-11-06T14:10:00+01:00";
    fixture.serverNow = "2026-11-06T14:15:00+01:00";
    const html = renderToStaticMarkup(<SeasonDraftPanel view={fixture} />);
    expect(html).toContain("Valider ma sélection");
    expect(html).toContain("+ Ajouter à ma liste");
    expect(html).not.toContain(">Recruter</button>");
  });

  it("keeps a pending list editable between processing bursts after 14 h", () => {
    const fixture = createDraftFixture();
    fixture.edition!.status = "running";
    fixture.edition!.currentPosition = null;
    fixture.edition!.deadline = null;
    fixture.serverNow = "2026-11-06T14:15:00+01:00";
    const html = renderToStaticMarkup(<SeasonDraftPanel view={fixture} />);
    expect(html).toContain("Valider ma sélection");
    expect(html).toContain("+ Ajouter à ma liste");
    expect(html).not.toContain("Les sélections commencent à 14 h");
  });

  it.each(["picked", "passed", "expired", "already passed position"])("locks preference editing after %s", reason => {
    const fixture = createDraftFixture();
    fixture.edition!.status = "running";
    fixture.edition!.currentPosition = reason === "already passed position" ? fixture.mine!.position + 1 : fixture.mine!.position;
    fixture.edition!.deadline = "2026-11-06T14:10:00+01:00";
    fixture.serverNow = reason === "expired" ? "2026-11-06T14:10:00+01:00" : "2026-11-06T14:05:00+01:00";
    if (reason === "picked" || reason === "passed") fixture.mine!.status = reason;
    const html = renderToStaticMarkup(<SeasonDraftPanel view={fixture} />);
    expect(html).not.toContain("Valider ma sélection");
    expect(html).not.toContain("+ Ajouter à ma liste");
  });

  it("keeps the current S5 selection rule visible", () => {
    const html = renderToStaticMarkup(<SeasonDraftPanel view={createDraftFixture()} />);
    expect(html).toContain("leur spécialité (60 %)");
    expect(html).not.toContain("leur moyenne hors plaine (10 %)");
  });

  it.each([6, 7])("explains the performance rule only from S%s", (gameYear) => {
    const fixture = createDraftFixture();
    fixture.edition!.gameYear = gameYear;
    const html = renderToStaticMarkup(<SeasonDraftPanel view={fixture} />);
    expect(html).toContain("MON, VAL, CLM, PAV ou SPR (90 %)");
    expect(html).toContain("leur moyenne hors plaine (10 %)");
    expect(html).toContain("Le potentiel départage les égalités ; l’âge n’intervient pas");
    expect(html).not.toContain("leur potentiel et leur âge (25 %)");
  });

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
