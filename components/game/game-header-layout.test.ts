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
  it("keeps every shortcut visible in a compact wrapping strip", () => {
    expect(headerSource).toContain(
      "flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3",
    );
    expect(headerSource).toContain(
      "order-3 ml-auto flex w-full flex-wrap items-center justify-end gap-px",
    );
    expect(headerSource).toContain("lg:flex-nowrap");
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
