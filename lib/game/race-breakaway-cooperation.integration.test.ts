import { describe, expect, it } from "vitest";

import { createDemoSimulationInput } from "./race-simulation-demo";
import { simulateRaceStage } from "./race-simulation";

describe("dynamic breakaway cooperation integration", () => {
  it("publishes rotating relays in the high-frequency visual stream", () => {
    const simulation = simulateRaceStage(
      createDemoSimulationInput("collines-ardennes", "relay-visual-stream"),
    );
    const relayFrames = (simulation.visualTimeline ?? []).filter(
      (frame) => frame.frontDynamics?.activeRelayRiderIds.length,
    );
    const relaySignatures = new Set(
      relayFrames.map((frame) =>
        [...(frame.frontDynamics?.activeRelayRiderIds ?? [])]
          .sort()
          .join("|"),
      ),
    );

    expect(relayFrames.length).toBeGreaterThan(5);
    expect(relaySignatures.size).toBeGreaterThan(1);
    for (const frame of relayFrames) {
      const frontRiderIds = new Set(
        frame.groups
          .filter((group) => group.type === "breakaway")
          .flatMap((group) => group.riderIds),
      );
      expect(
        frame.frontDynamics!.activeRelayRiderIds.every((riderId) =>
          frontRiderIds.has(riderId),
        ),
      ).toBe(true);
      expect(frame.frontDynamics!.breakawayCooperation).toBeGreaterThanOrEqual(
        0,
      );
      expect(frame.frontDynamics!.breakawayCooperation).toBeLessThanOrEqual(1);
    }
  });
});
