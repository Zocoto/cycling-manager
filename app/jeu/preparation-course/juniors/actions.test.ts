import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  authenticate: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((path: string): never => { throw new Error(`REDIRECT:${path}`); }),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/authenticated-user", () => ({ getAuthenticatedUser: mocks.authenticate }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ rpc: mocks.rpc }) }));

import { saveJuniorRacePreparationAction } from "./actions";

const stageId = "bb593586-7adb-4419-8ec9-57e98eb029c0";
const registrationId = "acd19797-70f9-4e45-8d17-1285b7194a8f";
const riderId = "a088b2a2-959c-41bd-8a68-b8b6458e56bb";
const secondRiderId = "d5f29794-73b6-4523-847a-4911d599e689";

function makeForm(stageType: string, scope = "club") {
  const payload = new FormData();
  payload.set("stageId", stageId);
  payload.set("registrationId", registrationId);
  payload.set("stageType", stageType);
  payload.set("scope", scope);
  return payload;
}

describe("junior race preparation action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticate.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
    mocks.rpc.mockResolvedValue({ error: null });
  });

  it("preserves a full Dev Team plan including explicit neutral resets", async () => {
    const payload = makeForm("road");
    payload.append(`rider:${riderId}`, "leader");
    payload.append(`rider:${secondRiderId}`, "free");
    const assignments = [{ riderId, instruction: "leader" }, { riderId: secondRiderId, instruction: "free" }];

    await expect(saveJuniorRacePreparationAction({ status: "ready" }, payload)).resolves.toEqual({ status: "saved", assignments });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("save_current_junior_race_preparation", {
      p_stage_id: stageId,
      p_registration_id: registrationId,
      p_scope: "club",
      p_instructions: assignments,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledExactlyOnceWith("/jeu/preparation-course/juniors");
  });

  it("sends a time trial effort only for the authorized federation scope", async () => {
    const payload = makeForm("individual_time_trial", "federation");
    payload.append(`rider:${riderId}`, "progressive");

    await expect(saveJuniorRacePreparationAction({ status: "ready" }, payload)).resolves.toMatchObject({ status: "saved" });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("save_current_junior_race_preparation", expect.objectContaining({
      p_scope: "federation",
      p_instructions: [{ riderId, instruction: "progressive" }],
    }));
  });

  it("rejects duplicate leaders, riders and instructions for another discipline", async () => {
    const twoLeaders = makeForm("road");
    twoLeaders.append(`rider:${riderId}`, "leader");
    twoLeaders.append(`rider:${secondRiderId}`, "leader");
    const duplicateRider = makeForm("road");
    duplicateRider.append(`rider:${riderId}`, "leader");
    duplicateRider.append(`rider:${riderId}`, "attack");
    const wrongStage = makeForm("individual_time_trial");
    wrongStage.append(`rider:${riderId}`, "attack");

    for (const payload of [twoLeaders, duplicateRider, wrongStage]) {
      await expect(saveJuniorRacePreparationAction({ status: "ready" }, payload)).resolves.toMatchObject({ status: "error" });
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("leaves the editor open when the RPC refuses a stale or unavailable entry", async () => {
    const payload = makeForm("road");
    payload.append(`rider:${riderId}`, "attack");
    mocks.rpc.mockResolvedValue({ error: { message: "rejected" } });
    await expect(saveJuniorRacePreparationAction({ status: "ready" }, payload)).resolves.toMatchObject({ status: "error" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
