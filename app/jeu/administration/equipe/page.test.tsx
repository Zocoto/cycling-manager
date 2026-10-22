import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  client: vi.fn(),
  auth: vi.fn(),
  role: vi.fn(),
  header: vi.fn(),
  members: vi.fn(),
  management: vi.fn(),
  searchAction: vi.fn(),
  roleAction: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
  notFound: vi.fn(() => { throw new Error("not-found"); }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
vi.mock("@/lib/supabase/authenticated-user", () => ({ getAuthenticatedUser: mocks.auth }));
vi.mock("@/services/game-staff-access", () => ({ getCurrentGameStaffRole: mocks.role }));
vi.mock("@/services/game-header-data", () => ({ getGameHeaderData: mocks.header }));
vi.mock("@/services/game-product-news", () => ({ getGameStaffMembers: mocks.members }));
vi.mock("@/components/game/game-header", () => ({ GameHeader: () => <div>En-tête connecté</div> }));
vi.mock("@/components/game/back-to-office-link", () => ({ BackToOfficeLink: () => <a href="/jeu">Retour au bureau</a> }));
vi.mock("@/components/game/game-staff-management", () => ({
  GameStaffManagement: (props: unknown) => {
    mocks.management(props);
    return <div>Gestion des membres habilités</div>;
  },
}));
vi.mock("./actions", () => ({
  searchGameStaffAction: mocks.searchAction,
  setGameStaffRoleAction: mocks.roleAction,
}));

import Page from "./page";

const client = { session: "authenticated-server-client" };
const members = [
  { userId: "founder-user", directorId: "founder-director", displayName: "Zocoto", role: "owner" },
  { userId: "staff-user", directorId: "staff-director", displayName: "Équipier", role: "game_staff" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.client.mockResolvedValue(client);
  mocks.auth.mockResolvedValue({ data: { user: { id: "founder-user", email: "founder@example.invalid" } }, error: null });
  mocks.role.mockResolvedValue("owner");
  mocks.header.mockResolvedValue({ displayName: "Zocoto", teamSponsorVisual: null });
  mocks.members.mockResolvedValue(members);
});

const render = async () => renderToStaticMarkup(await Page());

function expectNoPrivateReads() {
  expect(mocks.header).not.toHaveBeenCalled();
  expect(mocks.members).not.toHaveBeenCalled();
  expect(mocks.management).not.toHaveBeenCalled();
}

describe("founder-only in-game staff management page", () => {
  it.each(["missing", "expired"])("redirects %s sessions before verifying a role or reading members", async (state) => {
    mocks.auth.mockResolvedValue({
      data: { user: state === "missing" ? null : { id: "stale-user" } },
      error: state === "expired" ? { message: "expired" } : null,
    });
    await expect(render()).rejects.toThrow("redirect:/connexion");
    expect(mocks.role).not.toHaveBeenCalled();
    expectNoPrivateReads();
  });

  it.each([
    { label: "ordinary player", role: null },
    { label: "delegated admin", role: "game_staff" },
    { label: "revoked founder", role: null },
    { label: "unknown role", role: "admin" },
  ])("rejects a $label before any private lookup", async ({ role }) => {
    mocks.role.mockResolvedValue(role);
    await expect(render()).rejects.toThrow("not-found");
    expect(mocks.role).toHaveBeenCalledExactlyOnceWith(client);
    expectNoPrivateReads();
  });

  it("fails closed when the current server-side role cannot be verified", async () => {
    mocks.role.mockRejectedValue(new Error("role service unavailable"));
    await expect(render()).rejects.toThrow();
    expectNoPrivateReads();
  });

  it("never treats a forged founder name, email or user metadata as authority", async () => {
    mocks.auth.mockResolvedValue({
      data: { user: {
        id: "other-user", email: "paul.leblanc22@gmail.com",
        user_metadata: { display_name: "Zocoto", role: "owner", game_role: "owner" },
      } }, error: null,
    });
    mocks.header.mockResolvedValue({ displayName: "Zocoto", teamSponsorVisual: null });
    mocks.role.mockResolvedValue("game_staff");
    await expect(render()).rejects.toThrow("not-found");
    expectNoPrivateReads();
  });

  it("renders the dedicated management page for the confirmed founder, with its own actions", async () => {
    const html = await render();
    expect(html).toContain("Gérer les admins");
    expect(html).toContain("En-tête connecté");
    expect(html).toContain("Retour au bureau");
    expect(html).toContain("Gestion des membres habilités");
    expect(html).not.toContain("Éditeur de nouveauté");
    expect(mocks.header).toHaveBeenCalledExactlyOnceWith(client, "founder-user");
    expect(mocks.members).toHaveBeenCalledExactlyOnceWith(client);
    expect(mocks.management).toHaveBeenCalledExactlyOnceWith({
      members,
      searchAction: mocks.searchAction,
      roleAction: mocks.roleAction,
    });
    expect(mocks.auth.mock.invocationCallOrder[0]).toBeLessThan(mocks.role.mock.invocationCallOrder[0]);
    expect(mocks.role.mock.invocationCallOrder[0]).toBeLessThan(mocks.header.mock.invocationCallOrder[0]);
    expect(mocks.role.mock.invocationCallOrder[0]).toBeLessThan(mocks.members.mock.invocationCallOrder[0]);
  });

  it("rechecks the role for every request and blocks a just-revoked founder", async () => {
    await render();
    mocks.header.mockClear();
    mocks.members.mockClear();
    mocks.management.mockClear();
    mocks.role.mockResolvedValue(null);
    await expect(render()).rejects.toThrow("not-found");
    expect(mocks.role).toHaveBeenCalledTimes(2);
    expectNoPrivateReads();
  });
});
