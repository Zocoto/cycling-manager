import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = read(
  "supabase/migrations/20260814150000_add_roster_aid_and_cash_based_recruitment.sql",
);
const transferService = read("services/transfer-market.ts");
const transferPage = read("app/jeu/transferts/page.tsx");
const staffService = read("services/team-staff.ts");
const calendarService = read("services/race-calendar.ts");
const dashboardCalendarService = read("services/dashboard-race-calendar.ts");
const calendarComponent = read("components/game/season-calendar.tsx");
const dashboardRaces = read("components/game/dashboard-eligible-races.tsx");
const registrationPage = read(
  "app/jeu/courses/[slug]/race-profile-content.tsx",
);
const equipmentMobile = read("components/game/team-equipment-bulk-editor.tsx");
const equipmentDesktop = read(
  "components/game/team-equipment-desktop-table.tsx",
);

describe("ajustements de gestion demandés", () => {
  it("verse une seule aide de 100 000 € au DS qui commence avec moins de cinq coureurs", () => {
    expect(migration).toContain("grant_understaffed_team_starting_aid");
    expect(migration).toContain(") < 5");
    expect(migration).toContain("and director.status = 'active'");
    expect(migration).toContain("100000");
    expect(migration).toContain("understaffed-roster-aid:");
    expect(migration).toContain("sporting_director_messages");
    expect(migration).toContain(
      "on conflict (team_season_id, source_reference) do nothing",
    );
  });

  it("autorise les recrutements selon la trésorerie instantanée sans réserver les salaires futurs", () => {
    expect(migration).toContain("bid.amount as reserved_amount");
    expect(migration).toContain("v_available := v_context.cash_balance;");
    expect(migration).toContain("v_available >= v_bid.amount");
    expect(migration).toContain(
      "team_season.currency, team_season.cash_balance",
    );
    expect(migration).toContain("where team_season.id = v_buyer_team_season_id");
    expect(migration).toContain("v_definition := overlay(");
    expect(transferService).toContain(
      "availableBudget: Math.max(0, cashBalance - reservedBudget)",
    );
    expect(transferService).toContain(
      "total + toNumber(offer.offered_amount)",
    );
    expect(staffService).not.toContain(
      "projectedBudget < member.signingFee + member.salaryPerSeason",
    );
    expect(transferPage).toContain(
      "disabled={bidCapacity < listing.minimumNextBid}",
    );
  });

  it("identifie clairement l’équipe et le montant de la meilleure enchère", () => {
    expect(transferService).toContain("leaderTeamId: leader?.team_id ?? null");
    expect(transferPage).toContain("SponsorLogoMark");
    expect(transferPage).toContain("Meilleure enchère");
    expect(transferPage).toContain("listing.leaderTeamName");
    expect(transferPage).toContain("formatMoney(listing.currentBid");
  });

  it("propage et met en évidence les objectifs sponsor dans les calendriers", () => {
    expect(migration).toContain("get_current_team_sponsor_objective_races");
    expect(migration).toContain("race_objective.objective_id = objective.id");
    expect(calendarService).toContain(
      'rpc("get_current_team_sponsor_objective_races")',
    );
    expect(dashboardCalendarService).toContain(
      "isSponsorObjective: sponsorObjectiveEditionIds.has(edition.id)",
    );
    expect(calendarComponent).toContain('aria-label="Objectif sponsor"');
    expect(dashboardRaces).toContain('aria-label="Objectif sponsor"');
  });

  it("affiche les drapeaux d’équipe et de coureur dans le résumé des inscrits", () => {
    expect(migration).toContain("team_country_iso_alpha2 text");
    expect(calendarService).toContain(
      "teamCountryCode: rider.team_country_iso_alpha2",
    );
    expect(registrationPage).toContain(
      "fi-${team.teamCountryCode.toLowerCase()}",
    );
    expect(registrationPage).toContain("fi-${rider.countryCode.toLowerCase()}");
  });

  it("relie chaque nom à la fiche coureur dans les deux vues du matériel", () => {
    for (const source of [equipmentMobile, equipmentDesktop]) {
      expect(source).toContain("href={`/jeu/coureurs/${rider.id}`}");
      expect(source).toContain('target="_blank"');
    }
  });
});

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}
