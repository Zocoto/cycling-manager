import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const resultsPage = read("app/jeu/championnats-nationaux/resultats/page.tsx");
const registrationPage = read("app/jeu/championnats-nationaux/page.tsx");
const generalResultsPage = read("app/jeu/resultats/page.tsx");
const mailboxMigration = read(
  "supabase/migrations/20260919070000_link_national_championship_mail_to_results.sql",
);

describe("résultats des championnats nationaux", () => {
  it("montre les deux disciplines, les places de l'équipe et le classement officiel", () => {
    expect(resultsPage).toContain('discipline: "contre-la-montre"');
    expect(resultsPage).toContain('discipline: "route"');
    expect(resultsPage).toContain("getNationalChampionshipRiderResultLabel");
    expect(resultsPage).toContain("getNationalChampionshipResultHref");
    expect(resultsPage).toContain("includeCancelledEditions: true");
    expect(resultsPage).toContain('edition.status === "completed"');
  });

  it("est accessible depuis les inscriptions et les résultats généraux", () => {
    expect(registrationPage).toContain(
      'href="/jeu/championnats-nationaux/resultats"',
    );
    expect(generalResultsPage).toContain(
      'redirect("/jeu/championnats-nationaux/resultats")',
    );
    expect(generalResultsPage).toContain(
      'href="/jeu/championnats-nationaux/resultats"',
    );
  });

  it("redirige les courriers de résultats existants sans modifier leur lecture", () => {
    expect(mailboxMigration).toContain(
      "where message_type = 'national_championship_result'",
    );
    expect(mailboxMigration).toContain(
      "notification.notification_type = 'results'",
    );
    expect(mailboxMigration).toContain(
      "set action_href = '/jeu/championnats-nationaux/resultats'",
    );
    expect(mailboxMigration).not.toContain("set read_at =");
  });
});
