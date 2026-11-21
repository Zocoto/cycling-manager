import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FREE_AGENT_RIDER_JERSEY } from "@/lib/rider-jersey";

const roster = vi.hoisted(() => ({ rpc: vi.fn(), select: vi.fn() }));
vi.mock("next/navigation", async (original) => ({
  ...await original<typeof import("next/navigation")>(),
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("@/components/game/game-header", () => ({ GameHeader: () => null }));
vi.mock("@/components/game/back-to-office-link", () => ({ BackToOfficeLink: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ rpc: roster.rpc }) }));
vi.mock("@/lib/supabase/authenticated-user", () => ({ getAuthenticatedUser: async () => ({ data: { user: { id: "viewer" } }, error: null }) }));
vi.mock("@/services/game-header-data", () => ({ getGameHeaderData: async () => ({ teamId: "viewer-team" }) }));
vi.mock("@/services/uci-rankings", () => ({ getUciRankings: async () => ({
  seasonId: "s4", seasonName: "Saison 4", teams: [], rookies: [], nations: [],
  riders: Array.from({ length: 1232 }, (_, i) => ({ rank: i + 1, riderId: `rider-${i + 1}`, riderName: i === 12 ? "Heinrich Schröder" : `Coureur ${i + 1}`, avatarProfileKey: "europe_west", avatarSeed: `${i}`, age: 22, jersey: FREE_AGENT_RIDER_JERSEY, teamId: null, teamName: null, countryCode: "CH", countryName: "Suisse", points: i === 12 ? 840 : 1 })),
}) }));
import UciRankingsPage from "./page";

describe("pages du classement individuel complet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    roster.rpc.mockReturnValue({ select: roster.select });
    roster.select.mockResolvedValue({ data: [{ rider_id: "rider-13" }, { rider_id: "rider-1201" }], error: null });
  });

  it("affiche Heinrich dans les 100 premiers et propose la page suivante du circuit UCI", async () => {
    const html = renderToStaticMarkup(await UciRankingsPage({ searchParams: Promise.resolve({ vue: "individuel" }) }));
    expect(html.match(/<tr /g)).toHaveLength(100);
    expect(html).toContain("Heinrich Schröder");
    expect(html).toContain("840");
    expect(html).toContain("/jeu/classements?circuit=uci&amp;vue=individuel&amp;page=2");
    expect(html).toContain('aria-label="Pagination du classement individuel"');
    expect(html).toContain("Mes coureurs");
    expect(html).not.toContain('checked=""');
    expect(roster.rpc).not.toHaveBeenCalled();
  });
  it("permet d’atteindre le dernier des 1 232 coureurs sans changer ses rangs", async () => {
    const html = renderToStaticMarkup(await UciRankingsPage({ searchParams: Promise.resolve({ vue: "individuel", page: "13" }) }));
    expect(html.match(/<tr /g)).toHaveLength(32);
    expect(html).toContain("#1201");
    expect(html).toContain("#1232");
    expect(html).toContain("/jeu/classements?circuit=uci&amp;vue=individuel&amp;page=12");
  });

  it("filtre l’effectif actuel sur toutes les pages en conservant ses rangs UCI", async () => {
    const html = renderToStaticMarkup(await UciRankingsPage({ searchParams: Promise.resolve({ vue: "individuel", mes_coureurs: "1", page: "13" }) }));
    expect(roster.rpc).toHaveBeenCalledWith("get_current_team_roster");
    expect(roster.select).toHaveBeenCalledWith("rider_id");
    expect(html.match(/<tr /g)).toHaveLength(2);
    expect(html).toContain("Heinrich Schröder");
    expect(html).toContain("#13");
    expect(html).toContain("#1201");
    expect(html).not.toContain("#1</td>");
    expect(html).not.toContain("Coureur 1202");
    expect(html).toContain('checked=""');
    // The ranking fixture has no team affiliation; current roster IDs are authoritative.
    expect(html).toContain("Les rangs UCI globaux sont conservés.");
  });

  it("conserve le filtre dans une pagination éventuelle", async () => {
    roster.select.mockResolvedValue({ data: Array.from({ length: 105 }, (_, i) => ({ rider_id: `rider-${i + 101}` })), error: null });
    const html = renderToStaticMarkup(await UciRankingsPage({ searchParams: Promise.resolve({ vue: "individuel", mes_coureurs: "1" }) }));
    expect(html.match(/<tr /g)).toHaveLength(100);
    expect(html).toContain("#101");
    expect(html).toContain("/jeu/classements?circuit=uci&amp;vue=individuel&amp;page=2&amp;mes_coureurs=1");
  });

  it("affiche un état vide lorsque les coureurs de l’équipe ne sont pas classés", async () => {
    roster.select.mockResolvedValue({ data: [{ rider_id: "not-ranked" }], error: null });
    const html = renderToStaticMarkup(await UciRankingsPage({ searchParams: Promise.resolve({ vue: "individuel", mes_coureurs: "1" }) }));
    expect(html).toContain("Aucun coureur de votre effectif n’a encore marqué de points UCI.");
    expect(html).not.toContain("Heinrich Schröder");
  });

  it("ne revient pas au classement complet si le chargement de l’effectif échoue", async () => {
    roster.select.mockResolvedValue({ data: null, error: { message: "roster unavailable" } });
    await expect(UciRankingsPage({ searchParams: Promise.resolve({ vue: "individuel", mes_coureurs: "1" }) })).rejects.toThrow("Impossible de charger votre effectif");
  });

  it("ignore le filtre hors du classement individuel UCI", async () => {
    const html = renderToStaticMarkup(await UciRankingsPage({ searchParams: Promise.resolve({ vue: "equipes", mes_coureurs: "1" }) }));
    expect(roster.rpc).not.toHaveBeenCalled();
    expect(html).not.toContain("Mes coureurs");
  });
});
