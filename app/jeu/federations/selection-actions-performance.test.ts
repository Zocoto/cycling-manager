import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, revalidatePath } = vi.hoisted(() => ({ rpc: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ rpc }) }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
import { publishFederationPreselectionAction, respondFederationPreselectionAction } from "./selection-actions";

describe("bounded federation selection actions", () => {
  beforeEach(() => { vi.clearAllMocks(); rpc.mockResolvedValue({data:4,error:null}); });
  it("publishes through the atomic targeted RPC without a global rebuild", async () => {
    const data=new FormData();data.set("countryCode","FR");data.set("slotKey","cc-pro-road");
    expect(await publishFederationPreselectionAction({status:"idle",message:""},data)).toEqual({status:"success",message:"4 DS notifié(s)."});
    expect(rpc.mock.calls).toEqual([["publish_national_federation_preselection",{p_country_code:"FR",p_slot_key:"cc-pro-road"}]]);
    expect(revalidatePath).toHaveBeenCalledWith("/jeu/calendrier");
  });
  it.each(["confirm","decline"])("answers %s without reprocessing other nations", async decision => {
    const data=new FormData();data.set("countryCode","FR");data.set("memberId","00000000-0000-4000-8000-000000000001");data.set("decision",decision);
    await respondFederationPreselectionAction(data);
    expect(rpc.mock.calls).toEqual([["respond_to_national_federation_preselection",{p_member_id:"00000000-0000-4000-8000-000000000001",p_accept:decision==="confirm"}]]);
    expect(revalidatePath).toHaveBeenCalledWith("/jeu/selections-internationales");
  });
  it("reports an invalidation after refreshing the federation without a global rebuild", async () => {
    rpc.mockResolvedValue({data:"ineligible",error:null});
    const data=new FormData();data.set("countryCode","FR");data.set("memberId","00000000-0000-4000-8000-000000000001");data.set("decision","confirm");
    await expect(respondFederationPreselectionAction(data)).rejects.toThrow(encodeURIComponent("Cette convocation n’est plus valable : le coureur n’est plus éligible."));
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/jeu/selections-internationales");
  });
});
