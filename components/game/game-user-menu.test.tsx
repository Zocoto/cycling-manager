import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { GameUserMenu } from "@/components/game/game-user-menu";

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
    expect(markup).toContain('role="switch"');
    expect(markup).toContain('href="/guide"');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noopener noreferrer"');
    expect(markup).toContain('data-user-menu-language="true"');
    expect(markup).toContain("Langue de l’interface");
  });
});
