import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameStaffActionState } from "@/lib/game/game-product-news";

const mocks = vi.hoisted(() => ({
  client: vi.fn(), auth: vi.fn(), role: vi.fn(), rpc: vi.fn(),
  tag: vi.fn(), path: vi.fn(), members: vi.fn(),
}));
vi.mock("next/cache", () => ({ updateTag: mocks.tag, revalidatePath: mocks.path }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
vi.mock("@/lib/supabase/authenticated-user", () => ({ getAuthenticatedUser: mocks.auth }));
vi.mock("@/services/game-staff-access", () => ({ getCurrentGameStaffRole: mocks.role }));
vi.mock("@/services/game-product-news", () => ({ getGameStaffMembers: mocks.members }));

import { searchGameStaffAction, setGameStaffRoleAction } from "./actions";

const id = "00000000-0000-4000-8000-000000000100";
const userId = "00000000-0000-4000-8000-000000000200";
const initial: GameStaffActionState = { status: "idle", message: null };
function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.client.mockResolvedValue({ rpc: mocks.rpc });
  mocks.auth.mockResolvedValue({ data: { user: { id: userId, email: "member@example.invalid" } }, error: null });
  mocks.role.mockResolvedValue("owner");
  mocks.rpc.mockResolvedValue({ data: [], error: null });
  mocks.members.mockResolvedValue([]);
});

describe("founder-only team management actions", () => {
  it.each(["anonymous", "auth-error", "ordinary", "game-staff", "revoked", "role-error"])("rejects both direct actions for %s", async scenario => {
    if (scenario === "anonymous") mocks.auth.mockResolvedValue({ data: { user: null }, error: null });
    if (scenario === "auth-error") mocks.auth.mockResolvedValue({ data: { user: { id: userId } }, error: { message: "invalid session" } });
    if (scenario === "ordinary" || scenario === "revoked") mocks.role.mockResolvedValue(null);
    if (scenario === "game-staff") mocks.role.mockResolvedValue("game_staff");
    if (scenario === "role-error") mocks.role.mockRejectedValue(new Error("Role lookup unavailable"));

    expect((await setGameStaffRoleAction(initial, form({ user_id: userId, enabled: "true" }))).status).toBe("error");
    expect((await searchGameStaffAction(initial, form({ query: "membre" }))).status).toBe("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.members).not.toHaveBeenCalled();
    expect(mocks.tag).not.toHaveBeenCalled();
    expect(mocks.path).not.toHaveBeenCalled();
    if (scenario === "anonymous" || scenario === "auth-error") expect(mocks.role).not.toHaveBeenCalled();
  });

  it("does not trust founder identity or roles supplied in the form", async () => {
    mocks.role.mockResolvedValue("game_staff");
    const forged = form({ user_id: userId, enabled: "true", query: "membre", role: "owner", username: "Zocoto" });
    expect((await setGameStaffRoleAction(initial, forged)).status).toBe("error");
    expect((await searchGameStaffAction(initial, forged)).status).toBe("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("checks the live founder role again after a previous authorised action", async () => {
    expect((await searchGameStaffAction(initial, form({ query: "membre" }))).status).toBe("success");
    mocks.rpc.mockClear();
    mocks.role.mockResolvedValue("game_staff");
    expect((await setGameStaffRoleAction(initial, form({ user_id: userId, enabled: "false" }))).status).toBe("error");
    expect(mocks.auth).toHaveBeenCalledTimes(2);
    expect(mocks.role).toHaveBeenCalledTimes(2);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("searches names using a bounded query and result size", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ user_id: userId, director_id: id, display_name: "Membre", username: "member" }], error: null });
    const result = await searchGameStaffAction(initial, form({ query: "  mem  " }));
    expect(result).toMatchObject({ status: "success", candidates: [{ userId, directorId: id, displayName: "Membre", username: "member" }] });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("search_game_staff_candidates", { p_query: "mem", p_limit: 10 });
    expect(mocks.role).toHaveBeenCalledOnce();
    expect(mocks.tag).not.toHaveBeenCalled();
    expect(mocks.path).not.toHaveBeenCalled();
  });

  it.each(["", "a", "x".repeat(61)])("rejects invalid staff search length", async query => {
    expect((await searchGameStaffAction(initial, form({ query }))).status).toBe("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not leak SQL errors or return unconfirmed search results", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ user_id: userId }], error: { code: "42501", message: "internal table details" } });
    const result = await searchGameStaffAction(initial, form({ query: "membre" }));
    expect(result.status).toBe("error");
    expect(result.candidates).toBeUndefined();
    expect(result.message).not.toContain("internal table details");
  });

  it.each(["true", "false"])("changes staff access only and refreshes its dedicated page: %s", async enabled => {
    mocks.members.mockResolvedValue([{ userId, directorId: id, displayName: "Membre", role: "game_staff" }]);
    const result = await setGameStaffRoleAction(initial, form({ user_id: userId, enabled }));
    expect(result.status).toBe("success");
    expect(result.members).toHaveLength(1);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("set_game_staff_role", { p_auth_user_id: userId, p_enabled: enabled === "true" });
    expect(mocks.tag).toHaveBeenCalledExactlyOnceWith("game-staff-directory");
    expect(mocks.path).toHaveBeenCalledExactlyOnceWith("/jeu/administration/equipe");
    expect(mocks.tag).not.toHaveBeenCalledWith("game-product-news");
    expect(mocks.path).not.toHaveBeenCalledWith("/jeu/administration/actualites");
  });

  it.each([{ user_id: "bad", enabled: "true" }, { user_id: userId, enabled: "owner" }, { user_id: userId, enabled: "" }])("rejects forged role fields: %j", async values => {
    expect((await setGameStaffRoleAction(initial, form(values))).status).toBe("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each(["role change denied", "founder is immutable"])("does not claim success or clear caches when SQL rejects: %s", async message => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message } });
    const result = await setGameStaffRoleAction(initial, form({ user_id: userId, enabled: "false" }));
    expect(result.status).toBe("error");
    expect(mocks.tag).not.toHaveBeenCalled();
    expect(mocks.path).not.toHaveBeenCalled();
    expect(mocks.members).not.toHaveBeenCalled();
    expect(result.message).not.toContain(message);
  });

  it("does not deny a confirmed role change when only the refreshed member list fails", async () => {
    mocks.members.mockRejectedValue(new Error("list temporarily unavailable"));
    const result = await setGameStaffRoleAction(initial, form({ user_id: userId, enabled: "true" }));
    expect(result.status).toBe("success");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("set_game_staff_role", { p_auth_user_id: userId, p_enabled: true });
    expect(mocks.tag).toHaveBeenCalledExactlyOnceWith("game-staff-directory");
    expect(mocks.path).toHaveBeenCalledExactlyOnceWith("/jeu/administration/equipe");
    expect(result.members).toBeUndefined();
    expect(result.message).not.toContain("n’a pas pu être modifié");
  });
});
