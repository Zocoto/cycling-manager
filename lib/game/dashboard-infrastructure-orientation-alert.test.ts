import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  buildDashboardAssistantLines,
  getPendingInfrastructureOrientations,
  type DashboardAssistantSnapshot,
} from "@/lib/game/dashboard-assistant";

const quietSnapshot = {
  gameDate: "2026-10-03",
  minimumForm: 50,
  untreatedInjuryCount: 0,
  lowFormCount: 0,
  completedScoutingCount: 0,
  availableScoutCount: 0,
  zeroTrainingCount: 0,
  seniorSessionCount: 0,
  seniorCompletedCount: 0,
  seniorSkippedCount: 0,
  seniorProgressCount: 0,
  juniorRiderCount: 0,
  juniorSessionCount: 0,
  juniorProgressCount: 0,
  juniorManualTrainingDueCount: 0,
  juniorManualTrainingSlot: null,
  auctionCount: 0,
  dailyAuctionCount: 0,
  directorAuctionCount: 0,
  nextAuctionCloseAt: null,
  pendingSelectionCount: 0,
  federationSelectionReminderCount: 0,
  federationSelectionReminderNextLabel: null,
  federationSelectionReminderNextClosesAt: null,
  federationSelectionReminderCountryCode: null,
  pendingDirectOfferCount: 0,
  contractRenewalCount: 0,
  youthAlertCount: 0,
  nextSeasonRosterProjectedCount: 0,
  nextSeasonRosterOverflowCount: 0,
  watchedAuctionClosingCount: 0,
  staffMarketCount: 0,
  preparationReminderCount: 0,
  riderRecruitmentMatchCount: 0,
  staffRecruitmentMatchCount: 0,
  sponsorSignatureAvailable: false,
  sponsorRenewalAvailable: false,
  sponsorJerseyChangeAvailable: false,
  sponsorTargetSeasonName: null,
  equipmentPartnerSignatureAvailable: false,
  federationEquipmentSelectionRequired: false,
  federationEquipmentCountryCode: null,
  developmentTeamSetupRequired: false,
  developmentTeamSetupCurrentDayNumber: 0,
  developmentRaceRegistrationReminderCount: 0,
  developmentRaceRegistrationReminderNextName: null,
  developmentRaceRegistrationReminderNextEditionId: null,
  constructionContext: null,
  pendingInfrastructureOrientations: [],
  fanClubShopLevel: 0,
  fanClubStockCount: 0,
  fanClubSalesProcessedToday: false,
  fanClubTodayUnitsSold: 0,
  fanClubTodayRevenue: 0,
  journalItems: [],
} satisfies DashboardAssistantSnapshot;

describe("alertes d’orientation des infrastructures", () => {
  it("retient chaque bâtiment de niveau 3 ou plus sans orientation", () => {
    const pending = getPendingInfrastructureOrientations({
      infrastructureLevels: [
        { infrastructureCode: "training_center", level: 3 },
        { infrastructureCode: "wind_tunnel", level: 5 },
        { infrastructureCode: "weather_center", level: 2 },
        { infrastructureCode: "staff_academy", level: 5 },
      ],
      selectedInfrastructureCodes: ["wind_tunnel"],
    });

    expect(pending).toEqual([
      {
        infrastructureCode: "training_center",
        buildingName: "Centre d’entraînement",
        level: 3,
      },
    ]);
  });

  it("crée une alerte nominative et un lien ancré par bâtiment", () => {
    const groups = buildDashboardAssistantLines({
      snapshot: {
        ...quietSnapshot,
        pendingInfrastructureOrientations: [
          {
            infrastructureCode: "training_center",
            buildingName: "Centre d’entraînement",
            level: 3,
          },
          {
            infrastructureCode: "wind_tunnel",
            buildingName: "Soufflerie",
            level: 4,
          },
        ],
      },
      rewardCount: 0,
      cashBalance: 100_000,
    });

    expect(groups.alerts).toEqual([
      {
        id: "infrastructure-orientation:training_center",
        tone: "alert",
        metric: "N3",
        title: "Centre d’entraînement · orientation à choisir",
        detail: expect.stringContaining("niveau 3"),
        href: "/jeu/infrastructures#batiment-training_center",
      },
      {
        id: "infrastructure-orientation:wind_tunnel",
        tone: "alert",
        metric: "N4",
        title: "Soufflerie · orientation à choisir",
        detail: expect.stringContaining("niveau 3"),
        href: "/jeu/infrastructures#batiment-wind_tunnel",
      },
    ]);
  });

  it("charge les niveaux et les choix existants avec les règles RLS", () => {
    const service = readFileSync(
      new URL("../../services/dashboard-assistant.ts", import.meta.url),
      "utf8",
    );

    expect(service).toContain('.from("team_infrastructures")');
    expect(service).toContain('.gte("level", INFRASTRUCTURE_SPECIALIZATION_UNLOCK_LEVEL)');
    expect(service).toContain('.from("team_infrastructure_specializations")');
    expect(service).toContain('selectedInfrastructureCodes: (');
  });
});
