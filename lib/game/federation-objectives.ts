export type FederationObjective = {
  id: "members" | "naturalizations" | "international" | "championships" | "selections"
    | "continental" | "junior_championships" | "cycling_school" | "team_uci" | "rider_uci";
  eyebrow: string;
  title: string;
  detail: string;
  currentLabel: string;
  targetLabel: string;
  progressPercentage: number;
  completed: boolean;
};

export type FederationObjectiveInput = {
  countryId: string;
  gameYear: number;
  nationRank: number | null;
  referenceMemberTeamCount: number;
  currentMemberTeamCount: number;
  naturalizationCount: number;
  manuallySubmittedSelectionCount: number;
  nationsCupRank: number | null;
  nationsCupOverallRank: number | null;
  nationsCupDivision: number | null;
  nationsCupGroup: string | null;
  nationsCupPoolSize: number;
  worldRank: number | null;
  worldGameYear: number | null;
  continentalRank: number | null;
  continentalGameYear: number | null;
  juniorChampionshipRank: number | null;
  cyclingSchoolCount: number;
  teamUciRank: number | null;
  riderUciRank: number | null;
};

const FUTURE_OBJECTIVE_VARIANTS = [
  "naturalizations", "championships", "continental", "junior_championships",
  "cycling_school", "team_uci", "rider_uci",
] as const;

export function getFederationSeasonObjectiveVariants(
  countryId: string,
  gameYear: number,
): readonly [typeof FUTURE_OBJECTIVE_VARIANTS[number], typeof FUTURE_OBJECTIVE_VARIANTS[number]] {
  const seed = Number.parseInt(countryId.slice(0, 2), 16) || 0;
  const first = (seed + gameYear) % FUTURE_OBJECTIVE_VARIANTS.length;
  return [
    FUTURE_OBJECTIVE_VARIANTS[first],
    FUTURE_OBJECTIVE_VARIANTS[(first + 3) % FUTURE_OBJECTIVE_VARIANTS.length],
  ];
}

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
  const worldRank = input.worldGameYear === input.gameYear ? input.worldRank : null;
  const quadriennial = input.gameYear % 4 === 0;
  const nationsCupTarget = Math.max(1, Math.min(5, Math.ceil(input.nationsCupPoolSize * 0.6)));
  const nationsCupLocation = input.nationsCupDivision == null
    ? "de la Nations Cup seniors"
    : input.nationsCupGroup
      ? `du groupe ${input.nationsCupGroup} (division ${input.nationsCupDivision}) de la Nations Cup seniors`
      : `de la division ${input.nationsCupDivision} de la Nations Cup seniors`;

  const objectives: FederationObjective[] = [
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
      title: quadriennial
        ? `Atteindre le top ${rankTarget} aux Jeux quadriennaux`
        : `Atteindre le top ${nationsCupTarget} ${nationsCupLocation}`,
      detail: quadriennial
        ? "Le classement cumulé du programme professionnel quadriennal de J24 est retenu."
        : "Le classement cumulé des cinq épreuves professionnelles de J24 est retenu.",
      currentRank: quadriennial ? input.nationsCupOverallRank : input.nationsCupRank,
      targetRank: quadriennial ? rankTarget : nationsCupTarget,
    }),
    rankObjective({
      id: "championships",
      eyebrow: "Championnats du monde",
      title: `Signer un top ${rankTarget} aux Championnats du monde`,
      detail:
        "Seule une performance individuelle des Mondiaux de la saison en cours valide l’objectif.",
      currentRank: worldRank,
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

  if (input.gameYear <= 3) return objectives;

  const variants: Record<typeof FUTURE_OBJECTIVE_VARIANTS[number], FederationObjective> = {
    naturalizations: objectives[1],
    championships: objectives[3],
    continental: rankObjective({
      id: "continental",
      eyebrow: "Championnats continentaux",
      title: `Signer un top ${rankTarget} aux Championnats continentaux`,
      detail: "Seuls les championnats continentaux de la saison en cours comptent.",
      currentRank: input.continentalGameYear === input.gameYear ? input.continentalRank : null,
      targetRank: rankTarget,
    }),
    junior_championships: rankObjective({
      id: "junior_championships",
      eyebrow: "Relève internationale",
      title: `Signer un top ${rankTarget} aux CC ou CM juniors`,
      detail: "La meilleure place junior des championnats continentaux ou mondiaux de cette saison compte.",
      currentRank: input.juniorChampionshipRank,
      targetRank: rankTarget,
    }),
    cycling_school: countObjective({
      id: "cycling_school",
      eyebrow: "Formation",
      title: "Faire construire une école de cyclisme par une équipe affiliée",
      detail: "Un centre de formation international achevé dans le pays pendant cette saison valide l’objectif.",
      current: input.cyclingSchoolCount,
      target: 1,
      noun: "écoles",
    }),
    team_uci: rankObjective({
      id: "team_uci",
      eyebrow: "Classement UCI",
      title: `Placer une équipe affiliée dans le top ${getTeamUciTarget(input.nationRank)} UCI`,
      detail: "La meilleure place UCI d’une équipe affiliée pendant cette saison compte.",
      currentRank: input.teamUciRank,
      targetRank: getTeamUciTarget(input.nationRank),
      emptyLabel: "Aucune équipe classée",
    }),
    rider_uci: rankObjective({
      id: "rider_uci",
      eyebrow: "Classement UCI",
      title: `Placer un coureur national dans le top ${getRiderUciTarget(input.nationRank)} UCI`,
      detail: "La meilleure place UCI individuelle d’un coureur national pendant cette saison compte.",
      currentRank: input.riderUciRank,
      targetRank: getRiderUciTarget(input.nationRank),
      emptyLabel: "Aucun coureur classé",
    }),
  };
  const [first, second] = getFederationSeasonObjectiveVariants(input.countryId, input.gameYear);
  return [objectives[0], objectives[2], objectives[4], variants[first], variants[second]];
}

function getTeamUciTarget(nationRank: number | null): number {
  return nationRank != null && nationRank <= 16 ? 20 : 35;
}

function getRiderUciTarget(nationRank: number | null): number {
  if (nationRank != null && nationRank <= 16) return 50;
  if (nationRank != null && nationRank <= 48) return 100;
  return 200;
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
  emptyLabel = "Pas encore disputé",
}: {
  id: FederationObjective["id"];
  eyebrow: string;
  title: string;
  detail: string;
  currentRank: number | null;
  targetRank: number;
  emptyLabel?: string;
}): FederationObjective {
  const completed = currentRank != null && currentRank <= targetRank;
  return {
    id,
    eyebrow,
    title,
    detail,
    currentLabel: currentRank == null ? emptyLabel : `Meilleure place #${currentRank}`,
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
