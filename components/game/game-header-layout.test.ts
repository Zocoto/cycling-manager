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
  it("conserve les raccourcis essentiels dans un rail mobile compact", () => {
    expect(headerSource).toContain(
      "flex-nowrap items-center justify-start gap-1 overflow-x-auto",
    );
    expect(headerSource).toContain(
      "sm:flex-wrap sm:justify-end sm:gap-2 sm:overflow-visible",
    );
    expect(headerSource).toContain("lg:flex-nowrap");
  });

  it("ajoute une navigation de pouce réservée au téléphone", () => {
    expect(headerSource).toContain(
      "<MobileGameNavigation viewerEmail={simulatorEmail} />",
    );
    expect(headerSource).toContain('className="hidden sm:contents"');
  });

  it("places language and logout on the mobile top row with logout at the far right", () => {
    const searchPosition = headerSource.indexOf("<GameHeaderSearchToggle");
    const languagePosition = headerSource.indexOf("<LanguageSwitcher compact />");
    const logoutPosition = headerSource.indexOf("<LogoutButton isEnglish={isEnglish} />");

    expect(headerSource).toContain(
      "ml-auto flex shrink-0 items-center gap-1 sm:gap-2 lg:ml-0",
    );
    expect(languagePosition).toBeGreaterThan(searchPosition);
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
    const searchPosition = headerSource.indexOf("<GameHeaderSearchToggle");

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
    expect(headerSource).toContain(
      "<GameHeaderSearchToggle>",
    );
    expect(searchToggleSource).toContain('aria-label={open ? "Fermer la recherche" : "Ouvrir la recherche"}');
    expect(headerSource).toContain('role="search"');
    expect(searchToggleSource).toContain('querySelector("input")?.focus()');
  });
});
