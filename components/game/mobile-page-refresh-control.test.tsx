import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { MobilePageRefreshControl } from "./mobile-page-refresh-control";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("mobile page refresh control", () => {
  it("expose une commande compacte réservée au téléphone", () => {
    const markup = renderToStaticMarkup(
      <MobilePageRefreshControl isEnglish={false} />,
    );

    expect(markup).toContain('data-mobile-page-refresh="true"');
    expect(markup).toContain('aria-label="Actualiser la page"');
    expect(markup).toContain("sm:hidden");
  });

  it("rafraîchit la route Next sans rechargement complet de l’application", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "components/game/mobile-page-refresh-control.tsx",
      ),
      "utf8",
    );

    expect(source).toContain('import { useRouter } from "next/navigation"');
    expect(source).toContain("startRefreshTransition(() => {");
    expect(source).toContain("router.refresh()");
    expect(source).not.toContain("window.location.reload");
  });

  it("reste disponible dans la première ligne du bandeau du jeu", () => {
    const header = readFileSync(
      resolve(process.cwd(), "components/game/game-header.tsx"),
      "utf8",
    );
    const refreshPosition = header.indexOf("<MobilePageRefreshControl");
    const languagePosition = header.indexOf("<LanguageSwitcher compact />");
    const logoutPosition = header.indexOf("<LogoutButton isEnglish={isEnglish} />");

    expect(refreshPosition).toBeGreaterThan(0);
    expect(languagePosition).toBeGreaterThan(refreshPosition);
    expect(logoutPosition).toBeGreaterThan(languagePosition);
  });
});
