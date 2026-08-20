import type {
  RaceGroupSnapshot,
  RaceRole,
  RaceVisualFrame,
} from "./race-simulation";

export type RaceRiderVisualEffort =
  | "steady"
  | "relay"
  | "chase"
  | "sheltered";

export type RaceVisualMotionIntensity = "calm" | "controlled" | "urgent";

export function getRaceRiderVisualEffort({
  riderId,
  role,
  group,
  frontDynamics,
}: {
  riderId: string;
  role: RaceRole;
  group: Pick<RaceGroupSnapshot, "type">;
  frontDynamics?: RaceVisualFrame["frontDynamics"];
}): RaceRiderVisualEffort {
  if (!frontDynamics) return "steady";

  if (group.type === "breakaway") {
    return frontDynamics.activeRelayRiderIds.includes(riderId)
      ? "relay"
      : "sheltered";
  }
  if (group.type === "chase") return "chase";
  if (
    group.type === "peloton" &&
    frontDynamics.chasePressure >= 0.58 &&
    (role === "domestique" || role === "leadout")
  ) {
    return "chase";
  }

  return "steady";
}

export function getRaceVisualMotionProfile(
  frontDynamics?: RaceVisualFrame["frontDynamics"],
) {
  if (!frontDynamics) {
    return {
      intensity: "controlled" as const,
      sceneryDurationSeconds: 18,
    };
  }

  const urgency = Math.max(
    frontDynamics.chasePressure,
    frontDynamics.breakawayCooperation * 0.9,
  );
  if (urgency >= 0.72) {
    return {
      intensity: "urgent" as const,
      sceneryDurationSeconds: 13.5,
    };
  }
  if (
    frontDynamics.chasePressure <= 0.3 &&
    frontDynamics.breakawayCooperation <= 0.46
  ) {
    return {
      intensity: "calm" as const,
      sceneryDurationSeconds: 22,
    };
  }

  return {
    intensity: "controlled" as const,
    sceneryDurationSeconds: 18,
  };
}

export function getBreakawayVisualState(
  frontDynamics?: RaceVisualFrame["frontDynamics"],
) {
  if (!frontDynamics) return "legacy" as const;
  if (frontDynamics.breakawayCooperation >= 0.69) return "organized" as const;
  if (frontDynamics.breakawayCooperation <= 0.36) return "fractured" as const;
  return "rotating" as const;
}
