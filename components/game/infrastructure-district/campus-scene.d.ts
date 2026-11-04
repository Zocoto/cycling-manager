import type { TeamInfrastructureCode } from "@/lib/game/infrastructure";
import type { InfrastructureDistrictBuilding, CampusSponsor } from "@/lib/game/infrastructure-district";

export type CampusAnchor = {
  code: TeamInfrastructureCode;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CampusSceneControls = {
  resize: (width: number, height: number) => void;
  setState: (
    selectedCode: TeamInfrastructureCode,
    filter: "all" | "built" | "planned",
  ) => void;
  dispose: () => void;
};

export function createCampusScene(
  canvas: HTMLCanvasElement,
  buildings: readonly InfrastructureDistrictBuilding[],
  onLayout: (anchors: CampusAnchor[]) => void,
  sponsor?: CampusSponsor | null,
): CampusSceneControls;
