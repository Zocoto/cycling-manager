export const PARALLEL_CONSTRUCTION_TALENT_CODE =
  "architect_parallel_construction" as const;

type ConstructionArchitect = {
  contractId: string;
  hasParallelConstructionTalent: boolean;
};

type ActiveConstructionProject = {
  architectContractId: string | null;
};

export function getInfrastructureConstructionOptions<
  TArchitect extends ConstructionArchitect,
>({
  architects,
  activeProjects,
}: {
  architects: TArchitect[];
  activeProjects: ActiveConstructionProject[];
}) {
  const busyArchitectIds = new Set(
    activeProjects.flatMap((project) =>
      project.architectContractId ? [project.architectContractId] : [],
    ),
  );
  const existingProjectUsesParallelTalent = activeProjects.some((project) =>
    architects.some(
      (architect) =>
        architect.contractId === project.architectContractId &&
        architect.hasParallelConstructionTalent,
    ),
  );
  const hasCapacity = activeProjects.length < 2;
  const needsParallelArchitect =
    activeProjects.length === 1 && !existingProjectUsesParallelTalent;
  const eligibleArchitects = hasCapacity
    ? architects.filter(
        (architect) =>
          !busyArchitectIds.has(architect.contractId) &&
          (!needsParallelArchitect || architect.hasParallelConstructionTalent),
      )
    : [];
  const canStartWithoutArchitect =
    activeProjects.length === 0 ||
    (activeProjects.length === 1 && existingProjectUsesParallelTalent);

  let capacityBlockReason: string | null = null;
  if (!hasCapacity) {
    capacityBlockReason = "Deux chantiers sont déjà en cours.";
  } else if (
    needsParallelArchitect &&
    !eligibleArchitects.some(
      (architect) => architect.hasParallelConstructionTalent,
    )
  ) {
    capacityBlockReason =
      "Le second chantier exige un architecte disponible doté du talent « Double chantier ».";
  }

  return {
    eligibleArchitects,
    canStartWithoutArchitect,
    capacityBlockReason,
    selectionBlockReason:
      !capacityBlockReason &&
      needsParallelArchitect
        ? "Sélectionnez l’architecte doté du talent « Double chantier » pour ouvrir cette seconde ligne de construction."
        : null,
  };
}
