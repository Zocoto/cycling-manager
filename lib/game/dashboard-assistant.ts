import {
  isUnderfilledRaceRosterCorrectionOpen,
  type SeasonRaceCalendar,
} from "@/lib/game/race-calendar";
import { getRaceRegistrationHref } from "@/lib/game/race-navigation";

export const DASHBOARD_ASSISTANT_ENABLED = true;

export type DashboardJournalItem = {
  id: string;
  type: string;
  title: string;
  detail: string;
  href: string;
  important: boolean;
  sentAt: string;
  read: boolean;
};

export type DashboardAssistantSnapshot = {
  gameDate: string;
  minimumForm: number;
  untreatedInjuryCount: number;
  lowFormCount: number;
  completedScoutingCount: number;
  availableScoutCount: number;
  zeroTrainingCount: number;
  seniorSessionCount: number;
  seniorCompletedCount: number;
  seniorSkippedCount: number;
  seniorProgressCount: number;
  juniorRiderCount: number;
  juniorSessionCount: number;
  juniorProgressCount: number;
  juniorManualTrainingDueCount: number;
  juniorManualTrainingSlot: "manual_am" | "manual_pm" | null;
  auctionCount: number;
  dailyAuctionCount: number;
  directorAuctionCount: number;
  nextAuctionCloseAt: string | null;
  pendingSelectionCount: number;
  pendingDirectOfferCount: number;
  contractRenewalCount: number;
  youthAlertCount: number;
  watchedAuctionClosingCount: number;
  staffMarketCount: number;
  preparationReminderCount: number;
  riderRecruitmentMatchCount: number;
  staffRecruitmentMatchCount: number;
  journalItems: DashboardJournalItem[];
};

export type DashboardAssistantLine = {
  id: string;
  tone: "alert" | "info" | "success";
  metric: string;
  title: string;
  detail: string;
  href: string | null;
};

export type DashboardRaceRosterAlert = {
  id: string;
  raceName: string;
  title: string;
  detail: string;
  metric: string;
  href: string;
  dayNumber: number;
  prestigeRank: number;
};

const ALERT_PRIORITY = [
  "race-roster-alerts",
  "untreated-injuries",
  "junior-manual-training",
  "pending-selections",
  "pending-direct-offers",
  "rider-recruitment-matches",
  "staff-recruitment-matches",
  "completed-scouting",
  "available-scouts",
  "low-form",
  "zero-training",
  "contract-renewals",
  "youth-alerts",
] as const;

export function buildDashboardAssistantLines({
  snapshot,
  raceRosterAlerts = [],
  rewardCount,
  cashBalance,
}: {
  snapshot: DashboardAssistantSnapshot;
  raceRosterAlerts?: DashboardRaceRosterAlert[];
  rewardCount: number;
  cashBalance: number | null;
}): { alerts: DashboardAssistantLine[]; information: DashboardAssistantLine[] } {
  const alerts: DashboardAssistantLine[] = [];

  if (snapshot.untreatedInjuryCount > 0) {
    alerts.push({
      id: "untreated-injuries",
      tone: "alert",
      metric: String(snapshot.untreatedInjuryCount),
      title: pluralize(snapshot.untreatedInjuryCount, "blessé sans soins", "blessés sans soins"),
      detail: "Un protocole médical reste à choisir.",
      href: "/jeu/centre-de-soin?onglet=blessures",
    });
  }

  if (snapshot.lowFormCount > 0) {
    alerts.push({
      id: "low-form",
      tone: "alert",
      metric: String(snapshot.lowFormCount),
      title: pluralize(snapshot.lowFormCount, "coureur en forme basse", "coureurs en forme basse"),
      detail: `Sous votre seuil de ${snapshot.minimumForm} % de forme.`,
      href: "/jeu/centre-de-soin?onglet=forme",
    });
  }

  if (snapshot.completedScoutingCount > 0) {
    alerts.push({
      id: "completed-scouting",
      tone: "alert",
      metric: String(snapshot.completedScoutingCount),
      title: pluralize(snapshot.completedScoutingCount, "rapport de scouting prêt", "rapports de scouting prêts"),
      detail: "Les candidats peuvent être consultés.",
      href: "/jeu/centre-de-formation?onglet=scouting",
    });
  }

  if (snapshot.availableScoutCount > 0) {
    alerts.push({
      id: "available-scouts",
      tone: "alert",
      metric: String(snapshot.availableScoutCount),
      title: pluralize(
        snapshot.availableScoutCount,
        "scout disponible",
        "scouts disponibles",
      ),
      detail: "Une nouvelle mission de détection peut être lancée.",
      href: "/jeu/centre-de-formation?onglet=scouting",
    });
  }

  if (snapshot.juniorManualTrainingDueCount > 0) {
    const isMorning = snapshot.juniorManualTrainingSlot === "manual_am";
    alerts.push({
      id: "junior-manual-training",
      tone: "alert",
      metric: String(snapshot.juniorManualTrainingDueCount),
      title: pluralize(
        snapshot.juniorManualTrainingDueCount,
        "entraînement junior à réaliser",
        "entraînements juniors à réaliser",
      ),
      detail: `La séance manuelle du ${isMorning ? "matin" : "soir"} est toujours en attente.`,
      href: "/jeu/centre-de-formation?onglet=ecole",
    });
  }

  if (snapshot.pendingSelectionCount > 0) {
    alerts.push({
      id: "pending-selections",
      tone: "alert",
      metric: String(snapshot.pendingSelectionCount),
      title: pluralize(snapshot.pendingSelectionCount, "sélection à confirmer", "sélections à confirmer"),
      detail: "Une décision du DS est attendue.",
      href: "/jeu/selections-internationales",
    });
  }

  if (snapshot.pendingDirectOfferCount > 0) {
    alerts.push({
      id: "pending-direct-offers",
      tone: "alert",
      metric: String(snapshot.pendingDirectOfferCount),
      title: pluralize(snapshot.pendingDirectOfferCount, "offre de transfert à traiter", "offres de transfert à traiter"),
      detail: "Une autre équipe attend votre réponse.",
      href: "/jeu/transferts?onglet=offres",
    });
  }

  if (snapshot.riderRecruitmentMatchCount > 0) {
    alerts.push({
      id: "rider-recruitment-matches",
      tone: "alert",
      metric: String(snapshot.riderRecruitmentMatchCount),
      title: pluralize(
        snapshot.riderRecruitmentMatchCount,
        "coureur correspondant à votre recherche",
        "coureurs correspondant à votre recherche",
      ),
      detail: "Disponible aux enchères selon vos critères personnalisés.",
      href: "/jeu/transferts?onglet=quotidiennes",
    });
  }

  if (snapshot.staffRecruitmentMatchCount > 0) {
    alerts.push({
      id: "staff-recruitment-matches",
      tone: "alert",
      metric: String(snapshot.staffRecruitmentMatchCount),
      title: pluralize(
        snapshot.staffRecruitmentMatchCount,
        "profil de staff correspondant à votre recherche",
        "profils de staff correspondant à votre recherche",
      ),
      detail: "Disponible sur le marché selon vos critères personnalisés.",
      href: "/jeu/staff?onglet=marche",
    });
  }

  if (snapshot.contractRenewalCount > 0) {
    alerts.push({
      id: "contract-renewals",
      tone: "alert",
      metric: String(snapshot.contractRenewalCount),
      title: pluralize(snapshot.contractRenewalCount, "contrat à renouveler", "contrats à renouveler"),
      detail: "Aucun engagement n’est prévu pour la saison suivante.",
      href: "/jeu/effectif?vue=contrats",
    });
  }

  if (snapshot.youthAlertCount > 0) {
    alerts.push({
      id: "youth-alerts",
      tone: "alert",
      metric: String(snapshot.youthAlertCount),
      title: pluralize(
        snapshot.youthAlertCount,
        "junior de 18 ans à recruter",
        "juniors de 18 ans à recruter",
      ),
      detail: "Le passage professionnel doit être programmé avant la fin de saison.",
      href: "/jeu/centre-de-formation?onglet=ecole",
    });
  }

  if (cashBalance !== null && cashBalance < 0) {
    alerts.push({
      id: "negative-cash",
      tone: "alert",
      metric: "€",
      title: "Trésorerie négative",
      detail: "Consultez les échéances et les leviers disponibles.",
      href: "/jeu/finances",
    });
  }

  if (snapshot.zeroTrainingCount > 0) {
    alerts.push({
      id: "zero-training",
      tone: "alert",
      metric: String(snapshot.zeroTrainingCount),
      title: pluralize(snapshot.zeroTrainingCount, "coureur à 0 % d’entraînement", "coureurs à 0 % d’entraînement"),
      detail: "Aucun travail programmé au prochain passage.",
      href: "/jeu/entrainement",
    });
  }

  if (raceRosterAlerts.length > 0) {
    const prioritizedAlert = raceRosterAlerts[0]!;
    const actionableCount = raceRosterAlerts.length;

    alerts.push({
      id: "race-roster-alerts",
      tone: "alert",
      metric: String(actionableCount),
      title: pluralize(
        actionableCount,
        "start-list à corriger",
        "start-lists à corriger",
      ),
      detail: `Prochaine : ${prioritizedAlert.raceName} · ${prioritizedAlert.detail}`,
      href: prioritizedAlert.href,
    });
  }

  alerts.sort(
    (left, right) => getAlertPriority(left.id) - getAlertPriority(right.id),
  );

  if (!alerts.length) {
    alerts.push({
      id: "all-clear",
      tone: "success",
      metric: "✓",
      title: "Aucune alerte prioritaire",
      detail: "Votre équipe est à jour sur les points suivis.",
      href: null,
    });
  }

  const information: DashboardAssistantLine[] = [
    {
      id: "senior-training",
      tone: "info",
      metric: String(snapshot.seniorCompletedCount),
      title: "Rapport quotidien des seniors",
      detail:
        snapshot.seniorSessionCount > 0
          ? `${snapshot.seniorCompletedCount}/${snapshot.seniorSessionCount} séances · ${formatProgressCount(snapshot.seniorProgressCount)}`
          : "La séance du jour n’a pas encore été traitée.",
      href: "/jeu/entrainement/rapport",
    },
  ];

  if (snapshot.juniorRiderCount > 0) {
    information.push({
      id: "junior-training",
      tone: "info",
      metric: String(snapshot.juniorSessionCount),
      title: "Rapport quotidien des juniors",
      detail: `${snapshot.juniorSessionCount}/${snapshot.juniorRiderCount} entraînés · ${formatProgressCount(snapshot.juniorProgressCount)}`,
      href: "/jeu/centre-de-formation/rapport-entrainement",
    });
  }

  information.push({
    id: "auctions",
    tone: "info",
    metric: String(snapshot.auctionCount),
    title: pluralize(snapshot.auctionCount, "coureur actuellement aux enchères", "coureurs actuellement aux enchères"),
    detail: buildAuctionDetail(snapshot),
    href: "/jeu/transferts?onglet=quotidiennes",
  });

  if (snapshot.watchedAuctionClosingCount > 0) {
    information.push({
      id: "watched-auctions-closing",
      tone: "info",
      metric: String(snapshot.watchedAuctionClosingCount),
      title: pluralize(snapshot.watchedAuctionClosingCount, "enchère suivie bientôt clôturée", "enchères suivies bientôt clôturées"),
      detail: "Clôture dans moins de deux heures.",
      href: "/jeu/transferts?onglet=quotidiennes",
    });
  }

  if (snapshot.staffMarketCount > 0) {
    information.push({
      id: "staff-market",
      tone: "info",
      metric: String(snapshot.staffMarketCount),
      title: "Profils disponibles sur le marché du staff",
      detail: "Le marché commun a été actualisé aujourd’hui.",
      href: "/jeu/staff?onglet=marche",
    });
  }

  if (snapshot.preparationReminderCount > 0) {
    information.push({
      id: "race-preparation-reminder",
      tone: "info",
      metric: String(snapshot.preparationReminderCount),
      title: pluralize(snapshot.preparationReminderCount, "course proche à préparer", "courses proches à préparer"),
      detail: "Rappel : vérifiez stratégie, rôles et matériel.",
      href: "/jeu/preparation-course",
    });
  }

  if (rewardCount > 0) {
    information.push({
      id: "rewards",
      tone: "info",
      metric: String(rewardCount),
      title: pluralize(rewardCount, "récompense disponible", "récompenses disponibles"),
      detail: "Objectifs, trophées ou gain quotidien à récupérer.",
      href: "/jeu/objectifs",
    });
  }

  return { alerts, information };
}

export function formatDashboardAssistantDate(value: string): string {
  const formatted = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  }).format(new Date(`${value}T12:00:00Z`));

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function getDashboardRaceRosterAlerts(
  calendar: SeasonRaceCalendar | null,
  now = new Date(),
): DashboardRaceRosterAlert[] {
  if (!calendar) return [];

  return calendar.editions
    .flatMap((edition): DashboardRaceRosterAlert[] => {
      const registration = edition.currentTeamRegistration;
      const firstDepartureStage = [...edition.stages]
        .filter((stage) => stage.status !== "cancelled")
        .sort(
          (left, right) =>
            left.dayNumber - right.dayNumber ||
            left.stageNumber - right.stageNumber,
        )[0];

      if (
        edition.competitionType !== "standard" ||
        registration?.status !== "accepted" ||
        registration.rosterCount >= edition.minimumRosterSize ||
        !firstDepartureStage ||
        !isUnderfilledRaceRosterCorrectionOpen({
          edition,
          currentDayNumber: calendar.currentDayNumber,
          now,
        })
      ) {
        return [];
      }

      const missingCount = edition.minimumRosterSize - registration.rosterCount;
      const dayNumber = firstDepartureStage.dayNumber;

      return [
        {
          id: `race-roster-alert:${edition.id}`,
          raceName: edition.name,
          metric: `${registration.rosterCount}/${edition.minimumRosterSize}`,
          title: `Start-list à corriger · ${edition.name}`,
          detail: `${pluralize(missingCount, "1 coureur manque", `${missingCount} coureurs manquent`)} avant le départ à J${dayNumber}.`,
          href: getRaceRegistrationHref(edition.slug),
          dayNumber,
          prestigeRank: edition.prestigeRank,
        },
      ];
    })
    .sort(
      (left, right) =>
        left.dayNumber - right.dayNumber ||
        left.prestigeRank - right.prestigeRank ||
        left.raceName.localeCompare(right.raceName, "fr") ||
        left.id.localeCompare(right.id),
    );
}

function buildAuctionDetail(snapshot: DashboardAssistantSnapshot): string {
  if (snapshot.auctionCount === 0) return "Aucune vente ouverte pour le moment.";

  const categories = [
    snapshot.dailyAuctionCount > 0
      ? `${snapshot.dailyAuctionCount} quotidiennes`
      : null,
    snapshot.directorAuctionCount > 0
      ? `${snapshot.directorAuctionCount} entre DS`
      : null,
  ].filter((entry): entry is string => Boolean(entry));
  const closeLabel = snapshot.nextAuctionCloseAt
    ? ` · prochaine clôture ${new Intl.DateTimeFormat("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Paris",
      }).format(new Date(snapshot.nextAuctionCloseAt))}`
    : "";

  return `${categories.join(" · ")}${closeLabel}`;
}

function formatProgressCount(count: number): string {
  return pluralize(count, "1 progression", `${count} progressions`);
}

function getAlertPriority(id: string): number {
  if (id.startsWith("race-roster-alert:")) {
    return ALERT_PRIORITY.indexOf("race-roster-alerts");
  }
  const priority = ALERT_PRIORITY.indexOf(
    id as (typeof ALERT_PRIORITY)[number],
  );
  return priority === -1 ? ALERT_PRIORITY.length : priority;
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}
