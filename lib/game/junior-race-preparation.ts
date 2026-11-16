export const JUNIOR_ROAD_INSTRUCTIONS = ["free", "leader", "domestique", "attack"] as const;
export const JUNIOR_TIME_TRIAL_INSTRUCTIONS = ["steady", "progressive", "aggressive"] as const;

export type JuniorRaceInstruction =
  | (typeof JUNIOR_ROAD_INSTRUCTIONS)[number]
  | (typeof JUNIOR_TIME_TRIAL_INSTRUCTIONS)[number];
export type JuniorRacePreparationScope = "club" | "federation";
export type JuniorRacePreparationStageType = "road" | "individual_time_trial";
export type JuniorRaceAssignment = { riderId: string; instruction: JuniorRaceInstruction };
export type JuniorRacePreparationSaveState =
  | { status: "ready" }
  | { status: "error"; message: string }
  | { status: "saved"; assignments: JuniorRaceAssignment[] };

export function getJuniorRaceInstructions(
  stageType: JuniorRacePreparationStageType,
): readonly JuniorRaceInstruction[] {
  return stageType === "individual_time_trial"
    ? JUNIOR_TIME_TRIAL_INSTRUCTIONS
    : JUNIOR_ROAD_INSTRUCTIONS;
}

export function getJuniorRacePreparationHref({
  slug,
  stageNumber,
  registrationId,
}: {
  slug: string;
  stageNumber?: number;
  registrationId?: string;
}) {
  const params = new URLSearchParams({ course: slug });
  if (stageNumber !== undefined) params.set("etape", String(stageNumber));
  if (registrationId) params.set("selection", registrationId);
  return `/jeu/preparation-course/juniors?${params}`;
}
