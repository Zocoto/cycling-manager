import { beforeEach, expect, it, vi } from "vitest";
import { INITIAL_SQUAD_STATUSES_SAVE_STATE } from "@/lib/game/squad-status-editor";
const mocks = vi.hoisted(() => ({ client: vi.fn(), user: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
vi.mock("@/services/empty-roster-recovery", () => ({ recoverCurrentEmptyTeamRoster: vi.fn() }));
import { updateRiderSquadStatusesAction } from "./actions";
const row = { riderId: "11111111-1111-4111-8111-111111111111", squadStatus: "co_leader", expectedStatus: null };
const form = (updates: unknown) => { const value = new FormData(); value.set("updates", JSON.stringify(updates)); return value; };
beforeEach(() => {
  vi.clearAllMocks(); mocks.user.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  mocks.rpc.mockResolvedValue({ data: 2, error: null });
  mocks.client.mockResolvedValue({ auth: { getUser: mocks.user }, rpc: mocks.rpc });
});
it("saves all valid role changes with one authorized RPC and bounded path invalidations", async () => {
  const rows = [row, { riderId: "22222222-2222-4222-8222-222222222222", squadStatus: null, expectedStatus: "domestique" }];
  const result = await updateRiderSquadStatusesAction(INITIAL_SQUAD_STATUSES_SAVE_STATE, form(rows));
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("set_current_team_rider_squad_statuses", { p_updates: rows });
  expect(result).toMatchObject({ status: "success", savedStatuses: rows.map(({ riderId, squadStatus }) => ({ riderId, squadStatus })) });
  expect(mocks.revalidate).toHaveBeenCalledWith("/jeu/effectif");
  expect(mocks.revalidate).toHaveBeenCalledWith("/jeu/coureurs/[identifiant]", "page");
  expect(mocks.revalidate).toHaveBeenCalledTimes(4);
});
it("rejects malformed, duplicated, oversized and unauthorized-shaped input before any network call", async () => {
  for (const rows of [[], [row, row], [{ ...row, squadStatus: "leader" }], [{ ...row, expectedStatus: undefined }], [{ ...row, teamId: row.riderId }], Array(201).fill(row)]) {
    expect((await updateRiderSquadStatusesAction(INITIAL_SQUAD_STATUSES_SAVE_STATE, form(rows))).status).toBe("error");
  }
  const bad = new FormData(); bad.set("updates", "{");
  expect((await updateRiderSquadStatusesAction(INITIAL_SQUAD_STATUSES_SAVE_STATE, bad)).status).toBe("error");
  bad.set("updates", " ".repeat(50_001));
  expect((await updateRiderSquadStatusesAction(INITIAL_SQUAD_STATUSES_SAVE_STATE, bad)).status).toBe("error");
  expect(mocks.client).not.toHaveBeenCalled();
});
it("keeps all pending choices unacknowledged after a conflict or database failure", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: "Ces statuts ont été modifiés ailleurs." } });
  expect(await updateRiderSquadStatusesAction(INITIAL_SQUAD_STATUSES_SAVE_STATE, form([row]))).toEqual({ status: "error", message: "Ces statuts ont été modifiés ailleurs.", savedStatuses: [] });
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
it("requires a signed-in session and never invokes the status RPC when it expires", async () => {
  mocks.user.mockResolvedValue({ data: { user: null }, error: null });
  await expect(updateRiderSquadStatusesAction(INITIAL_SQUAD_STATUSES_SAVE_STATE, form([row]))).rejects.toThrow("redirect:/connexion");
  expect(mocks.rpc).not.toHaveBeenCalled();
});
