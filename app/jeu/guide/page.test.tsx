import type { AnchorHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  client: vi.fn(),
  auth: vi.fn(),
  header: vi.fn(),
  gameHeader: vi.fn(),
  signOut: vi.fn(),
  rpc: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`redirect:${url}`); }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
vi.mock("@/lib/supabase/authenticated-user", () => ({ getAuthenticatedUser: mocks.auth }));
vi.mock("@/services/game-header-data", () => ({ getGameHeaderData: mocks.header }));
vi.mock("@/components/game/game-header", () => ({
  GameHeader: (props: unknown) => { mocks.gameHeader(props); return <header data-game-header="true" />; },
}));
vi.mock("@/components/ui/app-link", () => ({
  default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}));

import ConnectedGuidePage, { metadata } from "./page";

const client = { auth: { signOut: mocks.signOut }, rpc: mocks.rpc };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.client.mockResolvedValue(client);
  mocks.auth.mockResolvedValue({ data: { user: { id: "player", email: "player@example.test" } }, error: null });
  mocks.header.mockResolvedValue({ displayName: "DS test", teamSponsorVisual: null });
});

describe("authenticated game guide", () => {
  it.each([
    { data: { user: null }, error: null },
    { data: { user: { id: "player" } }, error: { message: "Session expirée" } },
  ])("requires valid authentication before loading the header", async (authentication) => {
    mocks.auth.mockResolvedValue(authentication);
    await expect(ConnectedGuidePage()).rejects.toThrow("redirect:/connexion");
    expect(mocks.header).not.toHaveBeenCalled();
    expect(mocks.gameHeader).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("retains the connected chrome and session without adding gameplay writes", async () => {
    const html = renderToStaticMarkup(await ConnectedGuidePage());

    expect(mocks.client).toHaveBeenCalledTimes(1);
    expect(mocks.auth).toHaveBeenCalledExactlyOnceWith(client);
    expect(mocks.header).toHaveBeenCalledExactlyOnceWith(client, "player");
    expect(mocks.gameHeader).toHaveBeenCalledExactlyOnceWith({
      simulatorEmail: "player@example.test",
      displayName: "DS test",
      sponsor: null,
      maxWidth: "wide",
    });
    expect(html).toContain('data-game-header="true"');
    expect(html).toContain("Retour au bureau du DS");
    expect(html).toContain('id="demarrage"');
    expect(html).toContain('href="/jeu"');
    expect(html).not.toContain('href="/guide');
    expect(html).not.toContain("target=");
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("preserves bottom space for the mobile game navigation", async () => {
    const html = renderToStaticMarkup(await ConnectedGuidePage());
    expect(html).toContain("pb-24");
    expect(html).toContain("min-w-0");
    expect(metadata.alternates).toEqual({ canonical: "/guide" });
  });
});
