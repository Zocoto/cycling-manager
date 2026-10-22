import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(path); } }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getUser: mocks.auth }, rpc: mocks.rpc }) }));
import { saveRacePreparationAction } from "./actions";
import { saveFederationRacePreparationAction } from "../federations/equipment-actions";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function form(order?: string) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ editionId: id(1), stageId: id(2), stageNumber: "1", slug: "course-test", countryCode: "MU",
    objective: "sprint", collectivePosture: "balanced", breakawayPolicy: "avoid", chasePolicy: "dangerous_breakaway", attackOrders: "[]" })) data.set(key, value);
  for (let n = 3; n <= 10; n++) data.append("stageRoles", `${id(n)}:${n === 3 ? "sprinter" : "leadout"}`);
  if (order !== undefined) data.set("sprintTrainOrder", order);
  return data;
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ error: null });
  mocks.auth.mockResolvedValue({ data: { user: { id: "authenticated" } }, error: null });
});
describe.each([
  ["team", saveRacePreparationAction, "save_current_team_race_preparation_with_sprint"],
  ["federation", saveFederationRacePreparationAction, "save_national_federation_race_preparation_with_sprint"],
] as const)("atomic sprint preparation action — %s", (_, action, rpc) => {
  it("submits all seven pilots and other instructions through one atomic RPC", async () => {
    const order = Array.from({ length: 7 }, (_, i) => id(10 - i));
    await expect(action(form(JSON.stringify(order)))).rejects.toThrow("enregistrement=confirme");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith(rpc, expect.objectContaining({ p_strategy: expect.objectContaining({ sprintTrainOrder: order, attackOrders: [] }), p_roles: expect.any(Array) }));
    expect(mocks.rpc.mock.calls[0][1].p_roles).toHaveLength(8);
  });
  it.each([undefined, "broken json", '{"wrong":true}'])("falls back to automatic for an absent / malformed optional order: %s", async order => {
    await expect(action(form(order))).rejects.toThrow("enregistrement=confirme");
    expect(mocks.rpc).toHaveBeenCalledWith(rpc, expect.objectContaining({ p_strategy: expect.objectContaining({ sprintTrainOrder: [] }) }));
  });
});
