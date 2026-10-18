import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FREE_AGENT_RIDER_JERSEY } from "@/lib/rider-jersey";

vi.mock("@/components/game/game-header", () => ({ GameHeader: () => null }));
vi.mock("@/components/game/back-to-office-link", () => ({ BackToOfficeLink: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({}) }));
vi.mock("@/lib/supabase/authenticated-user", () => ({ getAuthenticatedUser: async () => ({ data: { user: { id: "viewer" } }, error: null }) }));
vi.mock("@/services/game-header-data", () => ({ getGameHeaderData: async () => ({}) }));
vi.mock("@/services/uci-rankings", () => ({ getUciRankings: async () => ({
  seasonId: "s4", seasonName: "Saison 4", teams: [], rookies: [], nations: [],
  riders: Array.from({ length: 1232 }, (_, i) => ({ rank: i + 1, riderId: `rider-${i + 1}`, riderName: i === 12 ? "Heinrich Schröder" : `Coureur ${i + 1}`, avatarProfileKey: "europe_west", avatarSeed: `${i}`, age: 22, jersey: FREE_AGENT_RIDER_JERSEY, teamId: null, teamName: null, countryCode: "CH", countryName: "Suisse", points: i === 12 ? 840 : 1 })),
}) }));
import UciRankingsPage from "./page";

describe("pages du classement individuel complet", () => {
  it("affiche Heinrich dans les 100 premiers et propose la page suivante du circuit UCI", async () => {
    const html = renderToStaticMarkup(await UciRankingsPage({ searchParams: Promise.resolve({ vue: "individuel" }) }));
    expect(html.match(/<tr /g)).toHaveLength(100);
    expect(html).toContain("Heinrich Schröder");
    expect(html).toContain("840");
    expect(html).toContain("/jeu/classements?circuit=uci&amp;vue=individuel&amp;page=2");
    expect(html).toContain('aria-label="Pagination du classement individuel"');
  });
  it("permet d’atteindre le dernier des 1 232 coureurs sans changer ses rangs", async () => {
    const html = renderToStaticMarkup(await UciRankingsPage({ searchParams: Promise.resolve({ vue: "individuel", page: "13" }) }));
    expect(html.match(/<tr /g)).toHaveLength(32);
    expect(html).toContain("#1201");
    expect(html).toContain("#1232");
    expect(html).toContain("/jeu/classements?circuit=uci&amp;vue=individuel&amp;page=12");
  });
});
