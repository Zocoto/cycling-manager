import { describe, expect, it } from "vitest";

import {
  getBreakawayVisualState,
  getRaceRoadMarkingMotion,
  getRaceRiderVisualEffort,
  getRaceVisualMotionProfile,
} from "./race-visual-motion";

const dynamics = {
  breakawayCooperation: 0.76,
  activeRelayRiderIds: ["relay-rider"],
  chasePressure: 0.81,
};

describe("race visual motion", () => {
  it("distinguishes the rider taking a relay from sheltered companions", () => {
    expect(
      getRaceRiderVisualEffort({
        riderId: "relay-rider",
        role: "free_agent",
        group: { type: "breakaway" },
        frontDynamics: dynamics,
      }),
    ).toBe("relay");
    expect(
      getRaceRiderVisualEffort({
        riderId: "passenger",
        role: "leader",
        group: { type: "breakaway" },
        frontDynamics: dynamics,
      }),
    ).toBe("sheltered");
  });

  it("shows peloton workers chasing only when pressure is high enough", () => {
    expect(
      getRaceRiderVisualEffort({
        riderId: "worker",
        role: "domestique",
        group: { type: "peloton" },
        frontDynamics: dynamics,
      }),
    ).toBe("chase");
    expect(
      getRaceRiderVisualEffort({
        riderId: "leader",
        role: "leader",
        group: { type: "peloton" },
        frontDynamics: dynamics,
      }),
    ).toBe("steady");
  });

  it("keeps old replays on the neutral animation profile", () => {
    expect(
      getRaceRiderVisualEffort({
        riderId: "legacy",
        role: "domestique",
        group: { type: "peloton" },
      }),
    ).toBe("steady");
    expect(getBreakawayVisualState()).toBe("legacy");
    expect(getRaceVisualMotionProfile()).toEqual({
      intensity: "controlled",
      sceneryDurationSeconds: 18,
    });
  });

  it("accelerates apparent motion when the pursuit or cooperation peaks", () => {
    expect(getRaceVisualMotionProfile(dynamics)).toEqual({
      intensity: "urgent",
      sceneryDurationSeconds: 13.5,
    });
    expect(getBreakawayVisualState(dynamics)).toBe("organized");
  });

  it("synchronizes fixed road markings with the roadside scenery", () => {
    const motion = getRaceRoadMarkingMotion({
      cycleDistance: 14,
      viewportDistance: 100,
      sceneryDurationSeconds: 18,
    });

    expect(motion.cycleDistance).toBe(14);
    expect(motion.durationSeconds).toBeCloseTo(2.52);
    expect(motion.cycleDistance / motion.durationSeconds).toBeCloseTo(
      100 / 18,
    );
  });
});
