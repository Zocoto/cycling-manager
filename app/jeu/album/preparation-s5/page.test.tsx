import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), getHeader: vi.fn(), rpc: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("not-found"); },
  redirect: (url: string) => { throw new Error(`redirect:${url}`); },
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/supabase/authenticated-user", () => ({ getAuthenticatedUser: mocks.getUser }));
vi.mock("@/services/game-header-data", () => ({ getGameHeaderData: mocks.getHeader }));
vi.mock("@/components/game/game-header", () => ({ GameHeader: () => null }));

import Page, { metadata } from "./page";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getHeader.mockResolvedValue({ displayName: "Zocoto" });
});

describe("owner-only S5 album preparation route", () => {
  it("requires a signed-in account before loading the preparation", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(Page()).rejects.toThrow("redirect:/connexion");
    expect(mocks.getHeader).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not expose the preparation to a player or staff account", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "another-account", role: "admin" } }, error: null });
    await expect(Page()).rejects.toThrow("not-found");
    expect(mocks.getHeader).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("shows only the empty mockup to the owner without loading or creating a collection", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "58140add-54c6-40af-9528-f823d0051d0f" } }, error: null });
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain('data-album-preparation="s5"');
    expect(html).toContain("S5 à collectionner en S6");
    expect(html).toContain('href="/jeu/album"');
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
