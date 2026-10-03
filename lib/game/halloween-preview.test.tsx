import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { HALLOWEEN_PREVIEW_BOARDS, HALLOWEEN_PREVIEW_ITEMS, isHalloweenPreviewBoard } from "./halloween-preview";
import { PRIVATE_ADMIN_EMAIL } from "./private-admin-access";
import { HalloweenChild, HalloweenItemIllustration, NativeAvatarPreview } from "@/components/halloween-preview/halloween-art";

const auth = vi.hoisted(() => ({ user: null as null | { id: string; email?: string }, error: null as Error | null, claims: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/authenticated-user", () => ({ getAuthenticatedUser: auth.claims }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("PRIVATE_404"); } }));
vi.mock("@/components/halloween-preview/halloween-preview", () => ({ HalloweenPreview: () => null }));

import Page from "@/app/apercus/halloween/[planche]/page";

beforeEach(() => {
  auth.user = null;
  auth.error = null;
  auth.claims.mockReset().mockImplementation(async () => ({ data: { user: auth.user }, error: auth.error }));
});

describe("planches Halloween privées", () => {
  it("limite les routes aux quatre planches connues", () => {
    expect(HALLOWEEN_PREVIEW_BOARDS).toHaveLength(4);
    expect(isHalloweenPreviewBoard("bureau")).toBe(true);
    expect(isHalloweenPreviewBoard("../jeu")).toBe(false);
    expect(isHalloweenPreviewBoard("inconnu")).toBe(false);
  });
  it("ne rend aucun aperçu pour une session absente", async () => {
    await expect(Page({ params: Promise.resolve({ planche: "bureau" }) })).rejects.toThrow("PRIVATE_404");
  });
  it("refuse un joueur même authentifié", async () => {
    auth.user = { id: "another-player", email: "joueur@example.com" };
    for (const board of HALLOWEEN_PREVIEW_BOARDS) {
      await expect(Page({ params: Promise.resolve({ planche: board.slug }) })).rejects.toThrow("PRIVATE_404");
    }
  });
  it("refuse une erreur d’authentification même avec le bon email", async () => {
    auth.user = { id: "test-account", email: PRIVATE_ADMIN_EMAIL };
    auth.error = new Error("invalid claims");
    await expect(Page({ params: Promise.resolve({ planche: "bureau" }) })).rejects.toThrow("PRIVATE_404");
  });
  it("échoue en accès fermé si le service d’authentification lève une erreur", async () => {
    auth.claims.mockRejectedValueOnce(new Error("authentication unavailable"));
    await expect(Page({ params: Promise.resolve({ planche: "bureau" }) })).rejects.toThrow("PRIVATE_404");
  });
  it("refuse un email manquant ou un alias non autorisé", async () => {
    for (const email of [undefined, "paul.leblanc22+autre@gmail.com"]) {
      auth.user = { id: "test-account", email };
      await expect(Page({ params: Promise.resolve({ planche: "bureau" }) })).rejects.toThrow("PRIVATE_404");
    }
  });
  it("autorise le compte privé sur chacune des planches", async () => {
    auth.user = { id: "test-account", email: PRIVATE_ADMIN_EMAIL };
    for (const board of HALLOWEEN_PREVIEW_BOARDS) {
      const result = await Page({ params: Promise.resolve({ planche: board.slug }) });
      expect(result.props.board).toBe(board.slug);
    }
  });
  it("conserve l’ancien lien des bonbons sous le même contrôle d’accès", async () => {
    await expect(Page({ params: Promise.resolve({ planche: "trick-or-treat" }) })).rejects.toThrow("PRIVATE_404");
    auth.user = { id: "test-account", email: PRIVATE_ADMIN_EMAIL };
    const result = await Page({ params: Promise.resolve({ planche: "trick-or-treat" }) });
    expect(result.props.board).toBe("cycliste-sans-tete");
  });
  it("rejette une route inconnue sans accès Supabase", async () => {
    await expect(Page({ params: Promise.resolve({ planche: "inconnu" }) })).rejects.toThrow("PRIVATE_404");
    expect(auth.claims).not.toHaveBeenCalled();
  });
  it("désactive indexation et prérendu partagé", () => {
    const source = readSource("app/apercus/halloween/[planche]/page.tsx");
    expect(source).toContain('dynamic = "force-dynamic"');
    expect(source).toContain("index: false");
    expect(source.indexOf("canAccessPrivateAdmin(user.email)")).toBeLessThan(source.indexOf("return <HalloweenPreview"));
  });
  it("n’a ni action serveur ni écriture ni persistance des choix", () => {
    for (const path of ["app/apercus/halloween/[planche]/page.tsx", "components/halloween-preview/halloween-preview.tsx", "components/halloween-preview/halloween-runner.tsx", "components/halloween-preview/halloween-runner-art.ts", "lib/game/halloween-runner-preview.ts", "lib/game/halloween-preview.ts"]) {
      const source = readSource(path);
      expect(source).not.toMatch(/\.rpc\(|\.insert\(|\.update\(|\.delete\(|localStorage|sessionStorage|\bfetch\(/);
      expect(source).not.toContain('"use server"');
    }
    expect(readSource("app/apercus/halloween/[planche]/page.tsx")).not.toContain("getGameHeaderData");
  });
  it("n’ajoute aucun lien aux menus ni au bureau réel", () => {
    for (const path of ["components/game/game-navigation-menu.tsx", "components/game/mobile-game-navigation.tsx", "app/jeu/page.tsx", "app/sitemap.ts"]) {
      expect(readSource(path)).not.toContain("/apercus/halloween");
    }
  });
  it("scopie le thème et place le bouton avant la fédération et l’assistant", () => {
    const source = readSource("components/halloween-preview/halloween-preview.tsx");
    expect(source.indexOf("data-preview-event-banner")).toBeLessThan(source.indexOf("data-preview-federation"));
    expect(source.indexOf("data-preview-federation")).toBeLessThan(source.indexOf("data-preview-assistant"));
    const css = readSource("components/halloween-preview/halloween-preview.css");
    expect(css).not.toMatch(/(^|\n)\s*(body|:root|html)[\s.{:#]/);
    expect(css).not.toMatch(/url\(|animation\s*:/);
    expect(css).toContain("max-width: 360px");
  });
});

describe("catalogue et dessins natifs", () => {
  it("propose huit cosmétiques, six consommables et quatre mauvaises pioches", () => {
    expect(HALLOWEEN_PREVIEW_ITEMS.filter((item) => item.kind === "cosmetic")).toHaveLength(8);
    expect(HALLOWEEN_PREVIEW_ITEMS.filter((item) => item.kind === "consumable")).toHaveLength(6);
    expect(HALLOWEEN_PREVIEW_ITEMS.filter((item) => item.kind === "trick")).toHaveLength(4);
    expect(new Set(HALLOWEEN_PREVIEW_ITEMS.map((item) => item.id)).size).toBe(18);
  });
  it("ne vend aucune farce et propose un antidote gratuit", () => {
    for (const item of HALLOWEEN_PREVIEW_ITEMS.filter((item) => item.kind === "trick")) {
      expect(item.price).toBeNull();
      expect(item.status).toBe("Farce sans malus en jeu");
    }
    expect(HALLOWEEN_PREVIEW_ITEMS.find((item) => item.id === "anti-curse-salt")?.price).toBeNull();
  });
  it("rend chacun des objets en SVG sans image générée ou externe", () => {
    for (const item of HALLOWEEN_PREVIEW_ITEMS) {
      const html = renderToStaticMarkup(<HalloweenItemIllustration art={item.art} name={item.name} />);
      expect(html).toContain("viewBox=\"0 0 320 112\"");
      expect(html).toContain(`data-halloween-art="${item.art}"`);
      expect(html).not.toContain("<image");
      expect(html).not.toContain("<img");
    }
  });
  it("réutilise le composant de portrait du jeu et ne modifie pas ses données", () => {
    expect(readSource("components/halloween-preview/halloween-art.tsx")).toContain("SportingDirectorAvatar({ avatarKey })");
    for (const item of HALLOWEEN_PREVIEW_ITEMS.filter((item) => item.kind === "cosmetic")) {
      const html = renderToStaticMarkup(<NativeAvatarPreview art={item.art} avatarKey="director_f_03" />);
      expect(html).toContain(`data-halloween-portrait="${item.art}"`);
      expect(html).toContain("clipPath");
    }
  });
  it("dessine exactement deux bonbons dans les mains de l’enfant", () => {
    const html = renderToStaticMarkup(<HalloweenChild />);
    expect(html.match(/viewBox="0 0 64 40"/g)).toHaveLength(2);
    expect(html).toContain("un dans chaque main");
  });
});

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8").replace(/\r\n/g, "\n");
}
