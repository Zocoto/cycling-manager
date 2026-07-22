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
  | "infrastructure";

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

export function buildDashboardEventFeed({
  currentDayNumber,
  currency,
  operationalEvents,
  transactions,
  objectives,
  limit = 10,
}: {
  currentDayNumber: number;
  currency: string;
  operationalEvents: DashboardEvent[];
  transactions: TeamFinanceTransaction[];
  objectives: GameObjective[];
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
    ...buildNationalChampionshipReminders(currentDayNumber),
  ];

  return events
    .sort(compareDashboardEvents)
    .slice(0, Math.max(0, limit));
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

function buildNationalChampionshipReminders(
  currentDayNumber: number
): DashboardEvent[] {
  const reminders: DashboardEvent[] = [];

  if (currentDayNumber >= 5 && currentDayNumber <= 8) {
    reminders.push({
      id: "national-championship:time-trial",
      category: "race",
      priority: "action",
      title: "Inscriptions CN contre-la-montre",
      description:
        "Le contre-la-montre national a lieu en J8. Vérifiez les engagements de chaque nationalité représentée dans votre effectif.",
      href: "/jeu/championnats-nationaux/contre-la-montre",
      actionLabel: "Vérifier les inscriptions",
      badgeLabel: "Rappel",
      dayNumber: 8,
      happenedAt: null,
    });
  }

  if (currentDayNumber >= 6 && currentDayNumber <= 9) {
    reminders.push({
      id: "national-championship:road",
      category: "race",
      priority: "action",
      title: "Inscriptions CN sur route",
      description:
        "La course en ligne nationale a lieu en J9. Seuls les coureurs de la nationalité du championnat peuvent y participer.",
      href: "/jeu/championnats-nationaux/route",
      actionLabel: "Vérifier les inscriptions",
      badgeLabel: "Rappel",
      dayNumber: 9,
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
