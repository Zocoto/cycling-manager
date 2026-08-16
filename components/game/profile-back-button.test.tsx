import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({
  back: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

import {
  navigateBackToProfileSource,
  ProfileBackButton,
} from "./profile-back-button";

describe("bouton de retour des fiches publiques", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("revient à la page réellement consultée avant la fiche", () => {
    const result = navigateBackToProfileSource(router, 2, "/jeu/recherche");

    expect(result).toBe("history");
    expect(router.back).toHaveBeenCalledOnce();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("utilise la destination de secours quand la fiche est ouverte directement", () => {
    const result = navigateBackToProfileSource(router, 1, "/jeu/effectif");

    expect(result).toBe("fallback");
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/jeu/effectif");
  });

  it("offre une cible tactile explicite sur ordinateur et téléphone", () => {
    const markup = renderToStaticMarkup(
      <ProfileBackButton fallbackHref="/jeu/recherche" />,
    );

    expect(markup).toContain('type="button"');
    expect(markup).toContain('aria-label="Retour à la page précédente"');
    expect(markup).toContain("min-h-11");
    expect(markup).toContain("Retour");
  });
});
