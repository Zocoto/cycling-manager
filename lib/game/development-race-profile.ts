import type {
  DevelopmentRace,
  DevelopmentRaceProfile,
} from "@/services/development-team";

export const DEVELOPMENT_RACE_PROFILE_LABELS: Record<
  DevelopmentRaceProfile,
  string
> = {
  flat: "Plaine",
  sprint: "Sprint",
  hilly: "Vallonné",
  mountain: "Montagne",
  cobbles: "Pavés",
  time_trial: "Contre-la-montre",
  mixed: "Mixte",
};

const MIXED_COMPONENT_LABELS: Record<DevelopmentRaceProfile, string> = {
  flat: "plaine",
  sprint: "sprint",
  hilly: "vallons",
  mountain: "montagne",
  cobbles: "pavés",
  time_trial: "chrono",
  mixed: "étape polyvalente",
};

export function getDevelopmentMixedProfileDetail(
  race: Pick<DevelopmentRace, "profileType" | "raceFormat" | "stages">,
) {
  if (race.profileType !== "mixed") return null;

  if (race.raceFormat === "stage_race") {
    const components = [
      ...new Set(race.stages.map((stage) => stage.profileType)),
    ].map((profile) => MIXED_COMPONENT_LABELS[profile]);

    if (components.length) {
      return `Programme : ${components.join(" · ")}`;
    }
  }

  return "Parcours polyvalent : plaine · vallons · montagne · rouleur";
}
