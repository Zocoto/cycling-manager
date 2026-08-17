import type { GameObjective } from "@/lib/game/objectives";
import type { TeamFinanceTransaction } from "@/services/team-finances";

export type DashboardEventCategory =
  | "health"
  | "race"
  | "finance"
  | "objective"
  | "scouting"
  | "training"
  | "academy"
  | "infrastructure"
  | "contract";

export type DashboardEventPriority = "critical" | "action" | "update";

export type DashboardEvent = {
  id: string;
  category: DashboardEventCategory;
  priority: DashboardEventPriority;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  badgeLabel?: string;
  dayNumber: number | null;
  happenedAt: string | null;
};

export type DashboardContractReminderRider = {
  riderId: string;
  firstName: string;
  lastName: string;
  hasNextSeasonContract: boolean;
};

export function buildDashboardEventFeed({
  currentDayNumber,
  currency,
  operationalEvents,
  transactions,
  objectives,
  trophyRewardStatus = { alphaTesterAvailable: false },
  limit = 10,
}: {
  currentDayNumber: number;
  currency: string;
  operationalEvents: DashboardEvent[];
  transactions: TeamFinanceTransaction[];
  objectives: GameObjective[];
  trophyRewardStatus?: { alphaTesterAvailable: boolean };
  limit?: number;
}): DashboardEvent[] {
  const events = [
    ...operationalEvents,
    ...buildSponsorPaymentEvents({
      currentDayNumber,
      currency,
      transactions,
    }),
    ...buildObjectiveRewardEvents(objectives, currentDayNumber, currency),
    ...buildTrophyRewardEvents(trophyRewardStatus, currentDayNumber),
    ...buildNationalChampionshipReminders(currentDayNumber),
  ];

  return events
    .sort(compareDashboardEvents)
    .slice(0, Math.max(0, limit));
}

export function buildContractRenewalReminderEvents({
  currentDayNumber,
  riders,
}: {
  currentDayNumber: number;
  riders: DashboardContractReminderRider[];
}): DashboardEvent[] {
  if (currentDayNumber < 21) return [];

  return riders
    .filter((rider) => !rider.hasNextSeasonContract)
    .map((rider) => {
      const riderName = `${rider.firstName} ${rider.lastName}`.trim();

      return {
        id: `contract-expiry:${rider.riderId}`,
        category: "contract",
        priority: "action",
        title: `Contrat de ${riderName || "ce coureur"} à renouveler`,
        description:
          "Ce coureur n’a aucun contrat pour la saison suivante. Consultez sa fiche pour préparer son avenir.",
        href: `/jeu/coureurs/${rider.riderId}`,
        actionLabel: "Voir le contrat",
        badgeLabel: "Contrat",
        dayNumber: 21,
        happenedAt: null,
      };
    });
}

function buildSponsorPaymentEvents({
  currentDayNumber,
  currency,
  transactions,
}: {
  currentDayNumber: number;
  currency: string;
  transactions: TeamFinanceTransaction[];
}): DashboardEvent[] {
  return transactions
    .filter(
      (transaction) =>
        transaction.category === "sponsor" &&
        transaction.status === "posted" &&
        transaction.dayNumber >= Math.max(1, currentDayNumber - 2)
    )
    .map((transaction) => ({
      id: `sponsor-payment:${transaction.id}`,
      category: "finance",
      priority: "update",
      title: "Versement sponsor reçu",
      description: `${transaction.description} · ${formatCurrency(
        transaction.amount,
        currency
      )} crédités.`,
      href: "/jeu/finances",
      actionLabel: "Voir les finances",
      dayNumber: transaction.dayNumber,
      happenedAt: transaction.postedAt,
    }));
}

function buildObjectiveRewardEvents(
  objectives: GameObjective[],
  currentDayNumber: number,
  currency: string
): DashboardEvent[] {
  return objectives
    .filter((objective) => objective.completed && !objective.claimedAt)
    .map((objective) => ({
      id: `objective:${objective.key}`,
      category: "objective",
      priority: "action",
      title: "Récompense d’objectif disponible",
      description: `${objective.title} est terminé. ${formatObjectiveReward(
        objective,
        currency
      )}`,
      href: "/jeu/objectifs",
      actionLabel: "Récupérer",
      dayNumber: currentDayNumber,
      happenedAt: null,
    }));
}

function buildTrophyRewardEvents(
  status: { alphaTesterAvailable: boolean },
  currentDayNumber: number
): DashboardEvent[] {
  if (!status.alphaTesterAvailable) {
    return [];
  }

  return [
    {
      id: "trophy:alpha-tester",
      category: "objective",
      priority: "action",
      title: "Un nouveau trophée vous attend",
      description:
        "Le trophée Alphatesteur est disponible dans votre galerie. Ouvrez votre cadeau pour révéler cette distinction exclusive.",
      href: "/jeu/objectifs?onglet=trophees#trophee-alpha-tester",
      actionLabel: "Ouvrir le cadeau",
      badgeLabel: "Nouveau trophée",
      dayNumber: currentDayNumber,
      happenedAt: null,
    },
  ];
}
function buildNationalChampionshipReminders(
  currentDayNumber: number
): DashboardEvent[] {
  const reminders: DashboardEvent[] = [];

  if (currentDayNumber >= 5 && currentDayNumber <= 8) {
    reminders.push({
      id: "national-championship:registrations",
      category: "race",
      priority: "action",
      title: "Inscriptions aux championnats nationaux",
      description:
        "Une seule grille regroupe le CN contre-la-montre et le CN en ligne de J8. Vérifiez les choix de tout votre effectif avant les départs.",
      href: "/jeu/championnats-nationaux",
      actionLabel: "Gérer les inscriptions",
      badgeLabel: "Rappel",
      dayNumber: 8,
      happenedAt: null,
    });
  }

  return reminders;
}

function compareDashboardEvents(
  left: DashboardEvent,
  right: DashboardEvent
): number {
  const priorityWeight: Record<DashboardEventPriority, number> = {
    critical: 0,
    action: 1,
    update: 2,
  };
  const priorityDifference =
    priorityWeight[left.priority] - priorityWeight[right.priority];
  if (priorityDifference !== 0) return priorityDifference;

  const dayDifference = (right.dayNumber ?? 0) - (left.dayNumber ?? 0);
  if (dayDifference !== 0) return dayDifference;

  const timeDifference =
    toTimestamp(right.happenedAt) - toTimestamp(left.happenedAt);
  if (timeDifference !== 0) return timeDifference;

  return left.id.localeCompare(right.id);
}

function formatObjectiveReward(
  objective: GameObjective,
  currency: string
): string {
  const rewards = [
    objective.reward.cash > 0
      ? formatCurrency(objective.reward.cash, currency)
      : null,
    objective.reward.experience > 0
      ? `${objective.reward.experience} XP`
      : null,
    objective.reward.reputation > 0
      ? `${objective.reward.reputation} réputation`
      : null,
    objective.reward.itemName,
  ].filter(Boolean);

  return rewards.length > 0
    ? `Récompense : ${rewards.join(" · ")}.`
    : "La récompense peut être récupérée.";
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function toTimestamp(value: string | null): number {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}
