import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const headerSource = readFileSync(
  join(process.cwd(), "components/game/game-header.tsx"),
  "utf8",
);
const searchToggleSource = readFileSync(
  join(process.cwd(), "components/game/game-header-search-toggle.tsx"),
  "utf8",
);

describe("game header responsive layout", () => {
  it("présente les raccourcis essentiels dans un rail mobile nommé", () => {
    expect(headerSource).toContain('data-mobile-header-shortcuts="true"');
    expect(headerSource).toContain("grid-cols-4");
    expect(headerSource).toContain('label={isEnglish ? "Alerts" : "Alertes"}');
    expect(headerSource).toContain('label={isEnglish ? "Help" : "Aide"}');
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

  it("place le nom, la recherche, la langue et la déconnexion sur la première ligne mobile", () => {
    const mobileActionsPosition = headerSource.indexOf(
      'data-mobile-header-primary-actions="true"',
    );
    const mobileSearchPosition = headerSource.indexOf(
      'id="game-global-search-mobile"',
    );
    const languagePosition = headerSource.indexOf("<LanguageSwitcher compact />");
    const logoutPosition = headerSource.indexOf("<LogoutButton isEnglish={isEnglish} />");

    expect(headerSource).toContain('data-mobile-app-name="true"');
    expect(mobileSearchPosition).toBeGreaterThan(mobileActionsPosition);
    expect(languagePosition).toBeGreaterThan(mobileSearchPosition);
    expect(logoutPosition).toBeGreaterThan(languagePosition);
  });

  it("renders the shortcuts directly without a secondary actions menu", () => {
    const teamPosition = headerSource.indexOf('href="/jeu/equipe"');
    const profilePosition = headerSource.indexOf(
      'href="/jeu/directeur-sportif"',
    );
    const mailboxPosition = headerSource.indexOf("<DirectorMailboxShortcut");
    const chatPosition = headerSource.indexOf("<GlobalChatShortcut");
    const gazettePosition = headerSource.indexOf("<CyclogazetteShortcut");
    const tutorialPosition = headerSource.indexOf("<TutorialCenterMenu");
    const searchPosition = headerSource.indexOf('id="game-global-search"');

    expect(teamPosition).toBeGreaterThan(0);
    expect(profilePosition).toBeGreaterThan(teamPosition);
    expect(mailboxPosition).toBeGreaterThan(profilePosition);
    expect(chatPosition).toBeGreaterThan(mailboxPosition);
    expect(gazettePosition).toBeGreaterThan(chatPosition);
    expect(tutorialPosition).toBeGreaterThan(gazettePosition);
    expect(searchPosition).toBeGreaterThan(tutorialPosition);
    expect(headerSource).not.toContain("GameHeaderActionsMenu");
  });

  it("opens the global search from a single magnifying-glass button", () => {
    expect(headerSource).toContain("<GameHeaderSearchToggle isEnglish={isEnglish}>");
    expect(searchToggleSource).toContain('? "Close search"');
    expect(searchToggleSource).toContain(': "Ouvrir la recherche"');
    expect(headerSource).toContain('role="search"');
    expect(searchToggleSource).toContain('querySelector("input")?.focus()');
  });
});
