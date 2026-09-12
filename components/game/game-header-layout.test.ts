import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const headerSource = readFileSync(
  join(process.cwd(), "components/game/game-header.tsx"),
  "utf8",
);
const tutorialLauncherSource = readFileSync(
  join(process.cwd(), "components/tutorial/tutorial-center-launcher.tsx"),
  "utf8",
);

describe("game header responsive layout", () => {
  it("présente les raccourcis essentiels dans un rail mobile nommé", () => {
    expect(headerSource).toContain('data-mobile-header-shortcuts="true"');
    expect(headerSource).toContain("grid-cols-2");
    expect(headerSource).not.toContain('label={isEnglish ? "Alerts" : "Alertes"}');
    expect(tutorialLauncherSource).toContain('"Open the tutorial centre"');
    expect(tutorialLauncherSource).toContain('"Ouvrir le centre des didacticiels"');
    expect(headerSource).toContain(
      "text-[0.52rem] font-extrabold leading-none",
    );
    expect(headerSource).toContain("lg:flex-nowrap");
  });

  it("ajoute une navigation de pouce réservée au téléphone", () => {
    expect(headerSource).toContain(
      "<MobileGameNavigation",
    );
    expect(headerSource).toContain(
      "federationCountryCode={federationCountryCode}",
    );
    expect(headerSource).toContain('className="hidden sm:contents"');
  });

  it("restaure la bulle de chat mobile et conserve son raccourci sur desktop", () => {
    expect(headerSource).toContain("<GlobalChatShortcut");
    expect(headerSource).toContain("floatingOnMobile");
  });

  it("place une recherche compacte entre la ligne principale et les raccourcis sur mobile", () => {
    const mobileActionsPosition = headerSource.indexOf(
      'data-mobile-header-primary-actions="true"',
    );
    const searchPosition = headerSource.indexOf(
      'data-global-header-search="true"',
    );
    const shortcutsPosition = headerSource.indexOf(
      'data-mobile-header-shortcuts="true"',
    );
    const userMenuPosition = headerSource.indexOf("<GameUserMenu");
    const logoutPosition = headerSource.indexOf("<LogoutButton isEnglish={isEnglish} />");

    expect(headerSource).toContain('data-mobile-app-name="true"');
    expect(searchPosition).toBeGreaterThan(0);
    expect(shortcutsPosition).toBeGreaterThan(searchPosition);
    expect(mobileActionsPosition).toBeGreaterThan(shortcutsPosition);
    expect(userMenuPosition).toBeGreaterThan(mobileActionsPosition);
    expect(logoutPosition).toBeGreaterThan(userMenuPosition);
    expect(headerSource).toContain("order-2 w-full min-w-0");
  });

  it("renders the shortcuts directly without a secondary actions menu", () => {
    const teamPosition = headerSource.indexOf('href="/jeu/equipe"');
    const mailboxPosition = headerSource.indexOf("<DirectorMailboxShortcut");
    const chatPosition = headerSource.indexOf("<GlobalChatShortcut");
    const gazettePosition = headerSource.indexOf("<CyclogazetteShortcut");
    const searchPosition = headerSource.indexOf('data-global-header-search="true"');

    expect(teamPosition).toBeGreaterThan(0);
    expect(mailboxPosition).toBeGreaterThan(teamPosition);
    expect(chatPosition).toBeGreaterThan(mailboxPosition);
    expect(gazettePosition).toBeGreaterThan(chatPosition);
    expect(searchPosition).toBeGreaterThan(0);
    expect(searchPosition).toBeLessThan(teamPosition);
    expect(headerSource).not.toContain("<TutorialCenterLauncher");
    expect(headerSource).not.toContain("GameHeaderActionsMenu");
    expect(headerSource).not.toContain('href="/jeu/directeur-sportif"');
    expect(headerSource).not.toContain('href="/guide"');
    expect(headerSource).not.toContain("<PushNotificationControl");
    expect(headerSource).not.toContain("<LanguageSwitcher");
    expect(headerSource).toContain("<GameUserMenu displayName={displayName} />");
  });

  it("keeps the global search visibly expanded without querying while typing", () => {
    expect(headerSource).not.toContain("GameHeaderSearchToggle");
    expect(headerSource).toContain('role="search"');
    expect(headerSource).toContain('method="get"');
    expect(headerSource).toContain('placeholder={');
    expect(headerSource).toContain('"Rechercher joueur / équipe / coureur"');
    expect(headerSource).toContain("xl:flex-1");
  });
});
