import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SEASON_FIVE_GALA } from "@/lib/game/season-five-gala";

const mocks = vi.hoisted(() => ({
  client: vi.fn(),
  auth: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  admin: vi.fn(),
  header: vi.fn(),
  fetch: vi.fn(),
  preview: vi.fn(),
  redirect: vi.fn(),
  notFound: vi.fn(),
  context: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
vi.mock("@/lib/supabase/authenticated-user", () => ({ getAuthenticatedUser: mocks.auth }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
vi.mock("@/services/game-header-data", () => ({ getGameHeaderData: mocks.header }));
vi.mock("@/components/game/season-five-gala-preview", () => ({ SeasonFiveGalaPreview: mocks.preview }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock("@/services/season-five-gala-registration", () => ({ getCurrentSeasonFiveGalaContext: mocks.context }));

import SeasonFiveGalaPreviewPage, { dynamic, metadata } from "./page";

const allowedUsers = [
  ["Zocoto", "58140add-54c6-40af-9528-f823d0051d0f"],
  ["Gouille", "ee244935-5722-4626-a28f-dc3cf63aa6f4"],
] as const;
const loginPath = "/connexion?returnTo=%2Fapercus%2Fgala-saison-5";
const client = { from: mocks.from, rpc: mocks.rpc };

function expectNoGameReads() {
  expect(mocks.from).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.admin).not.toHaveBeenCalled();
  expect(mocks.header).not.toHaveBeenCalled();
  expect(mocks.fetch).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.client.mockResolvedValue(client);
  mocks.auth.mockResolvedValue({ data: { user: null }, error: null });
  mocks.context.mockResolvedValue({ isOpen: true, closesAt: SEASON_FIVE_GALA.registrationClosesAt,
    team: null, program: null, selections: {}, riders: [] });
  mocks.preview.mockImplementation(() => <article data-gala-s5-preview>Private S5 review</article>);
  mocks.redirect.mockImplementation((path: string) => { throw new Error(`REDIRECT:${path}`); });
  mocks.notFound.mockImplementation(() => { throw new Error("NOT_FOUND"); });
  vi.stubGlobal("fetch", mocks.fetch);
  for (const trap of [mocks.from, mocks.rpc, mocks.admin, mocks.header, mocks.fetch]) {
    trap.mockImplementation(() => { throw new Error("Unexpected gameplay read"); });
  }
});

afterEach(() => { vi.unstubAllGlobals(); });

describe("private season-five gala page access", () => {
  it.each(allowedUsers)("renders only the static preview for the verified %s account", async (_name, id) => {
    mocks.auth.mockResolvedValue({ data: { user: { id, email: "unrelated@example.test" } }, error: null });

    const html = renderToStaticMarkup(await SeasonFiveGalaPreviewPage());

    expect(html).toContain("data-gala-s5-preview");
    expect(mocks.preview).toHaveBeenCalledOnce();
    expect(mocks.client).toHaveBeenCalledOnce();
    expect(mocks.auth).toHaveBeenCalledExactlyOnceWith(client);
    expect(mocks.context).toHaveBeenCalledExactlyOnceWith(client);
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.notFound).not.toHaveBeenCalled();
    expectNoGameReads();
  });

  it("redirects an anonymous session to the exact safe local return path", async () => {
    await expect(SeasonFiveGalaPreviewPage()).rejects.toThrow(`REDIRECT:${loginPath}`);
    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith(loginPath);
    const destination = new URL(loginPath, "https://cyclostratege.fr");
    expect(destination.origin).toBe("https://cyclostratege.fr");
    expect(destination.searchParams.get("returnTo")).toBe(SEASON_FIVE_GALA.route);
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(mocks.context).not.toHaveBeenCalled();
    expectNoGameReads();
  });

  it.each([
    "ordinary-player",
    "f4a4c24e-b534-4a5f-adbc-8f259189b86c", // Unused namesake Gouille account.
    "Zocoto",
    "Gouille",
    "admin",
    "game_staff",
  ])("returns 404 for unapproved identity %s regardless of labels", async (id) => {
    mocks.auth.mockResolvedValue({ data: { user: {
      id, email: "owner@example.test", user_metadata: { username: "Zocoto", display_name: "Gouille", role: "admin" },
    } }, error: null });

    await expect(SeasonFiveGalaPreviewPage()).rejects.toThrow("NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(mocks.context).not.toHaveBeenCalled();
    expectNoGameReads();
  });

  it("fails closed on an authentication error even when an allowed subject was returned", async () => {
    mocks.auth.mockResolvedValue({ data: { user: { id: allowedUsers[0][1] } }, error: new Error("Expired session") });

    await expect(SeasonFiveGalaPreviewPage()).rejects.toThrow("NOT_FOUND");
    expect(mocks.preview).not.toHaveBeenCalled();
    expectNoGameReads();
  });

  it("redirects an expired session without exposing the preview", async () => {
    mocks.auth.mockResolvedValue({ data: { user: null }, error: new Error("Expired session") });

    await expect(SeasonFiveGalaPreviewPage()).rejects.toThrow(`REDIRECT:${loginPath}`);
    expect(mocks.preview).not.toHaveBeenCalled();
    expectNoGameReads();
  });

  it("fails closed when verification throws", async () => {
    mocks.auth.mockRejectedValue(new Error("Authentication unavailable"));

    await expect(SeasonFiveGalaPreviewPage()).rejects.toThrow(`REDIRECT:${loginPath}`);
    expect(mocks.preview).not.toHaveBeenCalled();
    expectNoGameReads();
  });

  it("fails closed when creating the authenticated client rejects", async () => {
    mocks.client.mockRejectedValue(new Error("Session client unavailable"));

    await expect(SeasonFiveGalaPreviewPage()).rejects.toThrow(`REDIRECT:${loginPath}`);
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.preview).not.toHaveBeenCalled();
    expectNoGameReads();
  });

  it("keeps authenticated preview responses dynamic and excluded from indexing", () => {
    expect(dynamic).toBe("force-dynamic");
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it("keeps the gala visible with an unavailable registration panel when its single read fails", async () => {
    mocks.auth.mockResolvedValue({ data: { user: { id: allowedUsers[0][1] } }, error: null });
    mocks.context.mockRejectedValue(new Error("Database unavailable"));
    const html = renderToStaticMarkup(await SeasonFiveGalaPreviewPage());
    expect(html).toContain("data-gala-s5-preview");
    expect(mocks.preview.mock.calls.at(-1)?.[0]).toMatchObject({ registrationContext: { unavailable: true, isOpen: false } });
    expectNoGameReads();
  });
});
