import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc, getUser } = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getUser }, rpc }) }));
import { publishNationalFederationJersey } from "./actions";
import { initialNationalJerseyPublishState } from "@/lib/game/federation-action-states";
import { NATIONAL_JERSEY_ELEMENT_SHAPES, normalizeNationalJerseyDraft } from "@/lib/game/national-jersey-preview";

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "test-user" } }, error: null });
  rpc.mockResolvedValue({ data: [{ version: 2, activation_game_year: 4 }], error: null });
});

function form(shape: string, border: unknown = false, kind = "national_team") {
  const data = new FormData();
  const design = normalizeNationalJerseyDraft({ elements: [{ id: "layer", kind: "shape", shape }] as never });
  data.set("countryCode", "FR"); data.set("jerseyKind", kind);
  data.set("design", JSON.stringify({ ...design, elements: [{ ...design.elements[0], border }] }));
  return data;
}

describe("publication des nouvelles compositions", () => {
  it.each(NATIONAL_JERSEY_ELEMENT_SHAPES)("transmet %s et le choix sans contour au stockage officiel", async shape => {
    const state = await publishNationalFederationJersey(initialNationalJerseyPublishState, form(shape));
    expect(state.status).toBe("success");
    expect(rpc).toHaveBeenCalledWith("publish_national_federation_jersey", expect.objectContaining({ p_country_code: "FR", p_jersey_kind: "national_team", p_design: expect.objectContaining({ elements: [expect.objectContaining({ shape, border: false })] }) }));
    expect(state.publishedDesign?.elements[0].border).toBe(false);
  });
  it("conserve le choix de contour pour le maillot des champions aussi", async () => {
    const state = await publishNationalFederationJersey(initialNationalJerseyPublishState, form("star", true, "national_champion"));
    expect(state.status).toBe("success");
    expect(rpc).toHaveBeenCalledWith("publish_national_federation_jersey", expect.objectContaining({ p_jersey_kind: "national_champion" }));
    expect(state.publishedDesign?.elements[0].border).toBe(true);
  });
  it("rejette un faux booléen au lieu d’enregistrer un contour différent", async () => {
    expect((await publishNationalFederationJersey(initialNationalJerseyPublishState, form("star", "false"))).status).toBe("error");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("ne transmet aucune publication sans session authentifiée", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await publishNationalFederationJersey(initialNationalJerseyPublishState, form("stripes"))).status).toBe("error");
    expect(rpc).not.toHaveBeenCalled();
  });
});
