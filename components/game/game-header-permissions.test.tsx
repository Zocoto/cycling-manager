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
vi.mock("@/components/game/game-user-menu", () => ({ GameUserMenu: () => <span data-header-user-menu="true" /> }));
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
  it("shows the account-bound album on ordinary pages without a route opt-in",()=>{
    indicators.collectorAlbumAvailable = true;
    const html=renderToStaticMarkup(<GameHeader displayName="Zocoto"/>);
    expect(html).toContain('data-cyclo-stickers-shortcut="true"');
    expect(html).toContain('data-cyclo-stickers-icon="portrait-sticker"');
    expect(html).toContain('<rect x="3" y="1" width="14" height="18"');
    expect(html.indexOf('href="/jeu/album"')).toBeGreaterThan(html.indexOf('href="/jeu/gazette"'));
  });
  it.each(["owner","game_staff",null] as const)("does not enable the album by role, display name or email alone: %s",role=>{
    indicators.role=role;
    expect(renderToStaticMarkup(<GameHeader displayName="Zocoto" simulatorEmail="paul.leblanc22@gmail.com"/>)).not.toContain('data-cyclo-stickers-shortcut="true"');
  });
  it("keeps the album off by default and shows the opt-in icon immediately beside Gazette",()=>{
    const standard=renderToStaticMarkup(<GameHeader displayName="Joueur"/>);
    expect(standard).not.toContain('data-cyclo-stickers-shortcut="true"');
    const preview=renderToStaticMarkup(<GameHeader displayName="Zocoto" collectorAlbumAvailable/>);
    expect(preview).toContain('data-cyclo-stickers-shortcut="true"');
    expect(preview.indexOf('href="/jeu/album"')).toBeGreaterThan(preview.indexOf('href="/jeu/gazette"'));
    expect(preview).toContain("max-[360px]:hidden");
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
