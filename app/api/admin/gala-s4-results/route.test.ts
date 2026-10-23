import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), import: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({}) }));
vi.mock("@/lib/supabase/authenticated-user", () => ({ getAuthenticatedUser: mocks.user }));
vi.mock("@/services/season-four-gala-results", () => ({ importSeasonFourGalaResults: mocks.import, GalaResultImportError: class extends Error {} }));
import { POST } from "./route";
import { GalaResultImportError } from "@/services/season-four-gala-results";
const owner = "58140add-54c6-40af-9528-f823d0051d0f";
const payload = () => ({ confirm: true, eventKey: "continental:sprint", results: Array.from({ length: 10 }, (_, i) => ({ rank:i+1,riderId:`00000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`,teamId:"00000000-0000-4000-8000-000000000100" })) });
const request = (body: unknown = payload(), origin = "https://cyclostratege.fr") => new Request("https://cyclostratege.fr/api/admin/gala-s4-results",{method:"POST",headers:{origin,"x-cs-requested-with":"gala-s4-results","content-type":"application/json"},body:JSON.stringify(body)});
beforeEach(() => {vi.clearAllMocks();mocks.user.mockResolvedValue({data:{user:{id:owner}},error:null});mocks.import.mockResolvedValue({alreadyImported:false});});
describe("import privé des résultats du gala", () => {
  it.each([null,{id:"other",user_metadata:{role:"owner",username:"Zocoto"}}])("refuse un autre compte avant toute attribution", async user => {
    mocks.user.mockResolvedValue({data:{user},error:null});expect((await POST(request())).status).toBe(user?404:401);expect(mocks.import).not.toHaveBeenCalled();
  });
  it("exige la même origine",async()=>{expect((await POST(request(payload(),"https://foreign.invalid"))).status).toBe(403);expect(mocks.import).not.toHaveBeenCalled();});
  it.each([{...payload(),confirm:false},{...payload(),results:[]},{...payload(),eventKey:"continental:cobbles"}])("refuse un import non confirmé ou incomplet",async body=>{expect((await POST(request(body))).status).toBe(400);expect(mocks.import).not.toHaveBeenCalled();});
  it("réserve l’attribution confirmée au propriétaire, sans cache",async()=>{const response=await POST(request());expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toContain("no-store");const {confirm,...expected}=payload();expect(confirm).toBe(true);expect(mocks.import).toHaveBeenCalledExactlyOnceWith(expected);});
  it("remonte un conflit métier sans succès trompeur",async()=>{mocks.import.mockRejectedValue(new GalaResultImportError("Classement déjà attribué"));expect((await POST(request())).status).toBe(409);});
  it("permet de réessayer la même demande après une issue incertaine",async()=>{mocks.import.mockRejectedValue(Error("timeout"));const response=await POST(request());expect(response.status).toBe(500);expect((await response.json()).error).toContain("même classement");});
});
