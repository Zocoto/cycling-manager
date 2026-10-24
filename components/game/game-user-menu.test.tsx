import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameStaffRole } from "@/lib/game/game-product-news";

const indicators = vi.hoisted(() => ({ role: null as GameStaffRole }));
vi.mock("./game-header-indicators-provider", () => ({
  useGameHeaderIndicators: () => ({ gameStaffRole: indicators.role }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { GameUserMenu } from "@/components/game/game-user-menu";

beforeEach(() => { indicators.role = null; });

describe("GameUserMenu", () => {
  it("regroupe les préférences du joueur dans un menu unique", () => {
    const markup = renderToStaticMarkup(
      <GameUserMenu displayName="Paul Leblanc" />,
    );

    expect(markup).toContain('data-game-user-menu="true"');
    expect(markup).toContain('aria-label="Ouvrir le menu utilisateur"');
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain("Paul Leblanc");
    expect(markup).toContain('href="/jeu/directeur-sportif"');
    expect(markup).toContain('href="/jeu/parrainage"');
    expect(markup).toContain("Parrainage");
    expect(markup).toContain("Invitez des DS et débloquez vos récompenses");
    expect(markup).toContain('data-user-menu-notifications="true"');
    expect(markup).toContain('data-user-menu-email-updates="true"');
    expect(markup).toContain("E-mails d’actualité");
    expect(markup).toContain("Nouveautés majeures de Cyclo Stratège");
    expect(markup).toContain('role="switch"');
    expect(markup).toContain('href="/jeu/guide"');
    expect(markup).toContain('href="/jeu/nouveautes"');
    expect(markup).toContain("sans quitter votre partie");
    expect(markup).not.toContain('href="/guide"');
    expect(markup).not.toContain('target="_blank"');
    expect(markup).not.toContain('href="/connexion"');
    expect(markup).toContain('data-user-menu-language="true"');
    expect(markup).toContain("Langue de l’interface");
    expect(markup).not.toContain('href="/jeu/export-pcm"');
  });

  it.each(["game_staff", "owner"] as const)("donne les trois outils à %s sans dépendre de son adresse e-mail", (role) => {
    indicators.role = role;
    const markup = renderToStaticMarkup(<GameUserMenu displayName="Membre du staff" viewerEmail="delivery@example.test" />);
    expect(markup).toContain('href="/jeu/export-pcm"');
    expect(markup).toContain('href="/jeu/simulateur-course"');
    expect(markup).toContain('href="/jeu/administration/actualites"');
    expect(markup).toContain("Gérer les actualités");
    expect(markup).toContain('data-game-staff-badge="true"');
    expect(markup).toContain('href="/jeu/nouveautes"');
    expect(markup).toContain('href="/jeu/guide"');
    expect(markup).not.toContain('target="_blank"');
  });

  it("masque les outils réservés tant qu’aucun rôle serveur n’est connu", () => {
    const markup = renderToStaticMarkup(<GameUserMenu displayName="Joueur" viewerEmail="player@example.test" />);
    expect(markup).not.toContain('href="/jeu/export-pcm"');
    expect(markup).not.toContain('href="/jeu/simulateur-course"');
    expect(markup).not.toContain('href="/jeu/administration/actualites"');
    expect(markup).not.toContain('href="/jeu/administration/equipe"');
    expect(markup).not.toContain('data-game-staff-badge="true"');
  });

  it.each([null, "game_staff", "owner"] as const)("réserve la gestion des admins au rôle Fondateur, pas au nom ni à l’e-mail : %s", (role) => {
    indicators.role = role;
    const markup = renderToStaticMarkup(<GameUserMenu displayName="Zocoto" viewerEmail="paul.leblanc22@gmail.com" />);
    if (role === "owner") {
      expect(markup).toContain('href="/jeu/administration/equipe"');
      expect(markup).toContain("Gérer les admins");
      expect(markup).toContain("Nominations et accès réservés au Fondateur");
    } else {
      expect(markup).not.toContain('href="/jeu/administration/equipe"');
    }
  });

  it("conserve le dialogue accessible et scrollable sur petit écran", () => {
    const markup = renderToStaticMarkup(<GameUserMenu />);
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('aria-controls=');
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('hidden=""');
    expect(markup).toContain("overflow-y-auto");
    expect(markup).toContain("fixed inset-x-3");
    expect(markup).toContain("focus-visible:ring-2");
  });

  it("affiche l’export PCM26 uniquement au compte administrateur autorisé", () => {
    const authorizedMarkup = renderToStaticMarkup(
      <GameUserMenu
        displayName="Roger Letesteur"
        viewerEmail="paul.leblanc22@gmail.com"
      />,
    );
    const unauthorizedMarkup = renderToStaticMarkup(
      <GameUserMenu
        displayName="Autre directeur"
        viewerEmail="manager@example.com"
      />,
    );

    expect(authorizedMarkup).toContain('href="/jeu/export-pcm"');
    expect(authorizedMarkup).toContain("Export PCM26");
    expect(authorizedMarkup).toContain(
      "Générez la base et le pack d’installation",
    );
    expect(unauthorizedMarkup).not.toContain('href="/jeu/export-pcm"');
  });
});
