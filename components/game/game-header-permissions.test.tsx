import type { AnchorHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameStaffRole } from "@/lib/game/game-product-news";

const indicators = vi.hoisted(() => ({ role: null as GameStaffRole, collectorAlbumAvailable: false }));
vi.mock("@/components/game/game-header-indicators-provider", () => ({
  useGameHeaderIndicators: () => ({ gameStaffRole: indicators.role, collectorAlbumAvailable: indicators.collectorAlbumAvailable }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname:()=>"/jeu" }));
vi.mock("@/app/jeu/actions", () => ({ logoutAccount: vi.fn() }));
vi.mock("@/components/game/game-user-menu", () => ({
  GameUserMenu: ({ collectorAlbumAvailable }: { collectorAlbumAvailable: boolean }) => (
    <span data-header-user-menu="true" data-album-opt-in={collectorAlbumAvailable} />
  ),
}));
vi.mock("@/components/game/mobile-game-navigation", () => ({ MobileGameNavigation: () => <nav data-mobile-game-navigation="true" /> }));
vi.mock("@/components/layout/site-presence", () => ({ SitePresenceIndicator: () => null }));
vi.mock("@/components/game/director-mailbox-shortcut", () => ({ DirectorMailboxShortcut: () => <a href="/jeu/messagerie">Messagerie</a> }));
vi.mock("@/components/game/global-chat-shortcut", () => ({ GlobalChatShortcut: () => <a href="/jeu/chat">Chat</a> }));
vi.mock("@/components/game/cyclogazette-shortcut", () => ({ CyclogazetteShortcut: () => <a href="/jeu/gazette">Gazette</a> }));
vi.mock("@/components/ui/app-link", () => ({
  default: ({ prefetchOnIntent, showPendingIndicator, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { prefetchOnIntent?: boolean; showPendingIndicator?: boolean }) => {
    void prefetchOnIntent; void showPendingIndicator;
    return <a {...props} />;
  },
}));

import { GameHeader } from "./game-header";

beforeEach(() => { indicators.role = null; indicators.collectorAlbumAvailable = false; });

describe("header game staff shortcuts", () => {
  it("moves the standalone album shortcut out of the main header", () => {
    indicators.collectorAlbumAvailable = true;
    const html = renderToStaticMarkup(<GameHeader displayName="Zocoto" />);
    expect(html).not.toContain('data-cyclo-stickers-shortcut="true"');
    expect(html).toContain('href="/jeu/gazette"');
  });
  it("passes standalone album availability to the account menu", () => {
    const preview = renderToStaticMarkup(<GameHeader displayName="Zocoto" collectorAlbumAvailable />);
    expect(preview).toContain('data-album-opt-in="true"');
  });
  it.each(["owner", "game_staff"] as const)("affiche le laboratoire à %s sans adresse privilégiée", (role) => {
    indicators.role = role;
    const html = renderToStaticMarkup(<GameHeader displayName="Staff" simulatorEmail="delivery@example.test" />);
    expect(html).toContain('href="/jeu/simulateur-course"');
    expect(html).toContain('data-header-user-menu="true"');
    expect(html).toContain('data-mobile-game-navigation="true"');
  });

  it("ne révèle pas le laboratoire au joueur ordinaire et garde les communications", () => {
    const html = renderToStaticMarkup(<GameHeader displayName="Joueur" simulatorEmail="player@example.test" />);
    expect(html).not.toContain('href="/jeu/simulateur-course"');
    expect(html).toContain('href="/jeu/messagerie"');
    expect(html).toContain('href="/jeu/chat"');
    expect(html).toContain('href="/jeu/gazette"');
    expect(html).toContain('role="search"');
    expect(html).toContain('aria-label="Se déconnecter"');
    expect(html).toContain("focus-visible:ring-2");
    expect(html).not.toContain('target="_blank"');
  });
});
