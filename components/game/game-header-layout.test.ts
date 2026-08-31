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
    expect(headerSource).toContain("grid-cols-4");
    expect(headerSource).toContain('label={isEnglish ? "Alerts" : "Alertes"}');
    expect(tutorialLauncherSource).toContain('"Open the tutorial centre"');
    expect(tutorialLauncherSource).toContain('"Ouvrir le centre des didacticiels"');
    expect(headerSource).toContain(
      "text-[0.52rem] font-extrabold leading-none",
    );
    expect(headerSource).toContain("lg:flex-nowrap");
  });

  it("ajoute une navigation de pouce réservée au téléphone", () => {
    expect(headerSource).toContain(
      "<MobileGameNavigation viewerEmail={simulatorEmail} />",
    );
    expect(headerSource).toContain('className="hidden sm:contents"');
  });

  it("sort le chat du rail mobile sous la forme d’une bulle", () => {
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
    const languagePosition = headerSource.indexOf("<LanguageSwitcher compact />");
    const logoutPosition = headerSource.indexOf("<LogoutButton isEnglish={isEnglish} />");

    expect(headerSource).toContain('data-mobile-app-name="true"');
    expect(searchPosition).toBeGreaterThan(0);
    expect(shortcutsPosition).toBeGreaterThan(searchPosition);
    expect(mobileActionsPosition).toBeGreaterThan(shortcutsPosition);
    expect(languagePosition).toBeGreaterThan(mobileActionsPosition);
    expect(logoutPosition).toBeGreaterThan(languagePosition);
    expect(headerSource).toContain("order-2 w-full min-w-0");
  });

  it("renders the shortcuts directly without a secondary actions menu", () => {
    const teamPosition = headerSource.indexOf('href="/jeu/equipe"');
    const profilePosition = headerSource.indexOf(
      'href="/jeu/directeur-sportif"',
    );
    const mailboxPosition = headerSource.indexOf("<DirectorMailboxShortcut");
    const chatPosition = headerSource.indexOf("<GlobalChatShortcut");
    const gazettePosition = headerSource.indexOf("<CyclogazetteShortcut");
    const searchPosition = headerSource.indexOf('data-global-header-search="true"');

    expect(teamPosition).toBeGreaterThan(0);
    expect(profilePosition).toBeGreaterThan(teamPosition);
    expect(mailboxPosition).toBeGreaterThan(profilePosition);
    expect(chatPosition).toBeGreaterThan(mailboxPosition);
    expect(gazettePosition).toBeGreaterThan(chatPosition);
    expect(searchPosition).toBeGreaterThan(0);
    expect(searchPosition).toBeLessThan(teamPosition);
    expect(headerSource).not.toContain("<TutorialCenterLauncher");
    expect(headerSource).not.toContain("GameHeaderActionsMenu");
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
