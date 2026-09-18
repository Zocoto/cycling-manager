import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const resultsPage = read(
  "app/jeu/resultats/championnats-nationaux/[discipline]/page.tsx",
);
const legacyPage = read("app/jeu/championnats-nationaux/resultats/page.tsx");
const countryRankingPage = read(
  "app/jeu/resultats/[slug]/[stageNumber]/page.tsx",
);
const registrationPage = read("app/jeu/championnats-nationaux/page.tsx");
const generalResultsPage = read("app/jeu/resultats/page.tsx");
const resultsDirectory = read(
  "components/game/national-championship-results-directory.tsx",
);
const service = read("services/national-championships.ts");
const mailboxMigration = read(
  "supabase/migrations/20260919080000_link_national_championship_mails_to_exact_results.sql",
);

describe("résultats des championnats nationaux", () => {
  it("affiche une page par discipline avec le pays, les places et le classement", () => {
    expect(resultsPage).toContain('requestedDiscipline !== "route"');
    expect(resultsPage).toContain('requestedDiscipline !== "contre-la-montre"');
    expect(resultsPage).toContain("getNationalChampionshipRiderResultLabel");
    expect(resultsPage).toContain("getNationalChampionshipResultHref");
    expect(resultsPage).toContain("includeCancelledEditions: true");
    expect(resultsPage).toContain('edition.status === "completed"');
    expect(service).toContain('entry.enteredRiderCount > 0');
    expect(service).toContain('"did_not_start"');
  });

  it("est accessible depuis Résultats / Live et archive les tuiles dès J9", () => {
    expect(registrationPage).toContain(
      'href="/jeu/resultats"',
    );
    expect(generalResultsPage).toContain("NationalChampionshipResultsDirectory");
    expect(resultsDirectory).toContain(
      "return group.dayNumber < currentDayNumber;",
    );
    expect(legacyPage).toContain('redirect("/jeu/resultats")');
    expect(countryRankingPage).toContain(
      "`/jeu/resultats/championnats-nationaux/${nationalDiscipline}`",
    );
  });

  it("lie les courriers existants et futurs au classement exact sans changer leur lecture", () => {
    expect(mailboxMigration).toContain(
      "message.message_type = 'national_championship_result'",
    );
    expect(mailboxMigration).toContain(
      "notification.notification_type = 'results'",
    );
    expect(mailboxMigration).toContain(
      "'/jeu/resultats/' || race.slug || '/' || stage.stage_number::text",
    );
    expect(mailboxMigration).not.toContain("set read_at =");
  });
});
