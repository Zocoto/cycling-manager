import {
  getTeamInfrastructureCodesByStartingCost,
  TEAM_INFRASTRUCTURE_DEFINITIONS,
  type TeamInfrastructureCode,
} from "@/lib/game/infrastructure";
import type { TeamInfrastructureOverview } from "@/services/team-infrastructures";
import type { Sponsor } from "@/types/sponsor";

export type CampusSponsor = Pick<Sponsor, "id" | "name" | "shortName" | "logoPath" | "colors">;
export type InfrastructureDistrictVariant = "academy" | "club" | "classics" | "cryo" | "data" | "hills" | "lab" | "media" | "mountain" | "office" | "shop" | "track" | "training" | "tube" | "weather" | "welcome";
type DistrictLayout = {
  shortName: string;
  x: number;
  y: number;
  variant: InfrastructureDistrictVariant;
  zone: "Performance" | "Science" | "Vie du club";
};
export type InfrastructureDistrictBuilding = DistrictLayout & {
  code: TeamInfrastructureCode;
  level: number;
  construction?: {
    targetLevel: number;
    remainingDays: number;
    completionGameYear: number;
    completionDayNumber: number;
  };
};

// Exhaustive on purpose: a new catalogue building must receive a plot/model.
const DISTRICT_LAYOUT: Record<TeamInfrastructureCode, DistrictLayout | null> = {
  recruitment_data_room: { shortName: "Data Room", x: 190, y: 170, variant: "data", zone: "Science" },
  staff_academy: { shortName: "Académie des métiers", x: 530, y: 170, variant: "academy", zone: "Vie du club" },
  training_center: { shortName: "Centre d’entraînement", x: 900, y: 170, variant: "training", zone: "Performance" },
  roster_management_center: { shortName: "Gestion sportive", x: 1305, y: 430, variant: "office", zone: "Vie du club" },
  indoor_track: { shortName: "Piste indoor", x: 1310, y: 155, variant: "track", zone: "Performance" },
  cryotherapy_center: { shortName: "Cryothérapie", x: 190, y: 425, variant: "cryo", zone: "Performance" },
  wind_tunnel: { shortName: "Soufflerie", x: 550, y: 420, variant: "tube", zone: "Science" },
  weather_center: { shortName: "Centre météo", x: 915, y: 425, variant: "weather", zone: "Science" },
  media_center: { shortName: "Média Center", x: 455, y: 780, variant: "media", zone: "Vie du club" },
  international_welcome_center: { shortName: "Centre d’accueil", x: 1100, y: 780, variant: "welcome", zone: "Vie du club" },
  research_lab: { shortName: "Laboratoire R&D", x: 170, y: 780, variant: "lab", zone: "Science" },
  fan_club_headquarters: { shortName: "Siège du Fan Club", x: 740, y: 790, variant: "club", zone: "Vie du club" },
  club_shop: { shortName: "Boutique du club", x: 1405, y: 790, variant: "shop", zone: "Vie du club" },
  cobbles_center: { shortName: "Centre des classiques", x: 340, y: 1145, variant: "classics", zone: "Performance" },
  hills_circuit: { shortName: "Circuit de côtes", x: 780, y: 1145, variant: "hills", zone: "Performance" },
  mountain_base: { shortName: "Base montagne", x: 1230, y: 1145, variant: "mountain", zone: "Performance" },
  tactical_center: null,
};

export function buildInfrastructureDistrict({
  infrastructureLevels,
  activeProjects,
}: Pick<TeamInfrastructureOverview, "infrastructureLevels" | "activeProjects">): InfrastructureDistrictBuilding[] {
  return getTeamInfrastructureCodesByStartingCost().map((code) => {
    const layout = DISTRICT_LAYOUT[code];
    if (!layout) throw new Error(`Infrastructure sans parcelle : ${code}`);
    const maximumLevel = TEAM_INFRASTRUCTURE_DEFINITIONS[code].levels.at(-1)?.level ?? 0;
    const level = Math.min(maximumLevel, Math.max(0, Math.floor(infrastructureLevels[code] ?? 0)));
    const project = activeProjects.find((candidate) => candidate.code === code && candidate.status === "active");
    return {
      ...layout,
      code,
      level,
      ...(project ? { construction: {
        targetLevel: project.targetLevel,
        remainingDays: Math.max(0, project.remainingDays),
        completionGameYear: project.completionGameYear,
        completionDayNumber: project.completionDayNumber,
      } } : {}),
    };
  });
}

export function getCampusSponsor(sponsor: CampusSponsor | null | undefined): CampusSponsor | null {
  return sponsor ? {
    id: sponsor.id,
    name: sponsor.name,
    shortName: sponsor.shortName,
    logoPath: sponsor.logoPath,
    colors: { ...sponsor.colors },
  } : null;
}
