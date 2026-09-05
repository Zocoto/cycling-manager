export type FederationObjective = {
  id: "members" | "naturalizations" | "international" | "championships" | "selections";
  eyebrow: string;
  title: string;
  detail: string;
  currentLabel: string;
  targetLabel: string;
  progressPercentage: number;
  completed: boolean;
};

export type FederationObjectiveInput = {
  gameYear: number;
  nationRank: number | null;
  referenceMemberTeamCount: number;
  currentMemberTeamCount: number;
  naturalizationCount: number;
  manuallySubmittedSelectionCount: number;
  nationsCupRank: number | null;
  worldRank: number | null;
  continentalRank: number | null;
};

export function buildFederationObjectives(
  input: FederationObjectiveInput,
): FederationObjective[] {
  const memberTarget = getFederationMemberTeamTarget(
    input.referenceMemberTeamCount,
  );
  const naturalizationTarget = Math.min(
    3,
    Math.max(1, Math.ceil(Math.max(1, input.referenceMemberTeamCount) / 4)),
  );
  const rankTarget = getInternationalRankTarget(input.nationRank);
  const championshipRank = bestRank(input.worldRank, input.continentalRank);
  const quadriennial = input.gameYear % 4 === 0;

  return [
    countObjective({
      id: "members",
      eyebrow: "Développement",
      title: `Avoir ${memberTarget} équipe${memberTarget > 1 ? "s" : ""} dans la fédération`,
      detail:
        "Cible figée d’après l’effectif de référence de la saison, afin de récompenser un recrutement réaliste.",
      current: input.currentMemberTeamCount,
      target: memberTarget,
      noun: "équipes",
    }),
    countObjective({
      id: "naturalizations",
      eyebrow: "Intégration",
      title: `Naturaliser ${naturalizationTarget} coureur${naturalizationTarget > 1 ? "s" : ""}`,
      detail: "Les naturalisations professionnelles et juniors sont cumulées sur la saison.",
      current: input.naturalizationCount,
      target: naturalizationTarget,
      noun: "naturalisations",
    }),
    rankObjective({
      id: "international",
      eyebrow: quadriennial ? "Jeux quadriennaux" : "Nations Cup",
      title: `Atteindre le top ${rankTarget} ${quadriennial ? "aux Jeux quadriennaux" : "à la Nations Cup"}`,
      detail: quadriennial
        ? "La campagne quadriennale remplace l’objectif Nations Cup cette saison."
        : "La meilleure place de la campagne Nations Cup est retenue.",
      currentRank: input.nationsCupRank,
      targetRank: rankTarget,
    }),
    rankObjective({
      id: "championships",
      eyebrow: "Grands championnats",
      title: `Signer un top ${rankTarget} mondial ou continental`,
      detail:
        "La meilleure performance individuelle enregistrée valide l’objectif.",
      currentRank: championshipRank,
      targetRank: rankTarget,
    }),
    countObjective({
      id: "selections",
      eyebrow: "Responsabilité",
      title:
        "Soumettre des convocations pour 5 événements internationaux (manuellement)",
      detail:
        "Chaque événement distinct soumis manuellement aux DS compte une fois. Les sélections automatiques ne comptent pas.",
      current: input.manuallySubmittedSelectionCount,
      target: 5,
      noun: "événements",
    }),
  ];
}

export function getFederationMemberTeamTarget(referenceCount: number): number {
  const baseline = Math.max(0, Math.trunc(referenceCount));
  return baseline + (baseline >= 8 ? 2 : 1);
}

function getInternationalRankTarget(nationRank: number | null): number {
  if (nationRank != null && nationRank <= 16) return 8;
  if (nationRank != null && nationRank <= 48) return 16;
  return 24;
}

function countObjective({
  id,
  eyebrow,
  title,
  detail,
  current,
  target,
  noun,
}: {
  id: FederationObjective["id"];
  eyebrow: string;
  title: string;
  detail: string;
  current: number;
  target: number;
  noun: string;
}): FederationObjective {
  const normalizedCurrent = Math.max(0, Math.trunc(current));
  const completed = normalizedCurrent >= target;
  return {
    id,
    eyebrow,
    title,
    detail,
    currentLabel: `${normalizedCurrent} ${noun}`,
    targetLabel: `Objectif ${target}`,
    progressPercentage: completed
      ? 100
      : Math.round((normalizedCurrent / Math.max(1, target)) * 100),
    completed,
  };
}

function rankObjective({
  id,
  eyebrow,
  title,
  detail,
  currentRank,
  targetRank,
}: {
  id: FederationObjective["id"];
  eyebrow: string;
  title: string;
  detail: string;
  currentRank: number | null;
  targetRank: number;
}): FederationObjective {
  const completed = currentRank != null && currentRank <= targetRank;
  return {
    id,
    eyebrow,
    title,
    detail,
    currentLabel: currentRank == null ? "Pas encore disputé" : `Meilleure place #${currentRank}`,
    targetLabel: `Top ${targetRank}`,
    progressPercentage:
      currentRank == null
        ? 0
        : completed
          ? 100
          : Math.max(5, Math.min(99, Math.round((targetRank / currentRank) * 100))),
    completed,
  };
}

function bestRank(...ranks: Array<number | null>): number | null {
  const available = ranks.filter((rank): rank is number => rank != null);
  return available.length > 0 ? Math.min(...available) : null;
}
