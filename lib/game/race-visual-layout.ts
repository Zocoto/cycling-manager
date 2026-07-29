export type RaceGroupRiderSlot = {
  offsetX: number;
  offsetY: number;
  scale: number;
  zIndex: number;
};

export type RaceGroupVisualFormation =
  | "bunch"
  | "breakaway-line"
  | "peloton-front"
  | "prime-sprint";

export function getRaceGroupRiderSlots({
  riderIds,
  compact,
  formation = "bunch",
}: {
  riderIds: readonly string[];
  compact: boolean;
  formation?: RaceGroupVisualFormation;
}): RaceGroupRiderSlot[] {
  const comfortableSlots = [
    { offsetX: 42, offsetY: 6, scale: 0.9, zIndex: 8 },
    { offsetX: 17, offsetY: 0, scale: 0.82, zIndex: 4 },
    { offsetX: 20, offsetY: 27, scale: 0.93, zIndex: 10 },
    { offsetX: -8, offsetY: 12, scale: 0.86, zIndex: 6 },
    { offsetX: -11, offsetY: 39, scale: 0.96, zIndex: 12 },
    { offsetX: -39, offsetY: 2, scale: 0.78, zIndex: 2 },
    { offsetX: -39, offsetY: 25, scale: 0.88, zIndex: 7 },
    { offsetX: -61, offsetY: 42, scale: 0.94, zIndex: 11 },
  ] as const;
  const compactSlots = [
    { offsetX: 27, offsetY: 3, scale: 0.77, zIndex: 6 },
    { offsetX: 7, offsetY: 0, scale: 0.72, zIndex: 3 },
    { offsetX: 5, offsetY: 20, scale: 0.8, zIndex: 8 },
    { offsetX: -16, offsetY: 8, scale: 0.74, zIndex: 4 },
    { offsetX: -18, offsetY: 27, scale: 0.83, zIndex: 9 },
  ] as const;
  const compactBreakawayLineSlots = [
    { offsetX: 48, offsetY: 8, scale: 0.8, zIndex: 8 },
    { offsetX: 24, offsetY: 9, scale: 0.78, zIndex: 7 },
    { offsetX: 0, offsetY: 8, scale: 0.76, zIndex: 6 },
    { offsetX: -24, offsetY: 10, scale: 0.74, zIndex: 5 },
    { offsetX: -48, offsetY: 8, scale: 0.72, zIndex: 4 },
  ] as const;  const breakawayLineSlots = [
    { offsetX: 58, offsetY: 10, scale: 0.91, zIndex: 10 },
    { offsetX: 34, offsetY: 11, scale: 0.88, zIndex: 9 },
    { offsetX: 10, offsetY: 9, scale: 0.85, zIndex: 8 },
    { offsetX: -14, offsetY: 11, scale: 0.83, zIndex: 7 },
    { offsetX: -38, offsetY: 10, scale: 0.81, zIndex: 6 },
    { offsetX: -62, offsetY: 12, scale: 0.79, zIndex: 5 },
    { offsetX: -84, offsetY: 9, scale: 0.77, zIndex: 4 },
    { offsetX: -106, offsetY: 11, scale: 0.75, zIndex: 3 },
  ] as const;
  const compactPelotonFrontSlots = [
    { offsetX: 44, offsetY: 7, scale: 0.8, zIndex: 9 },
    { offsetX: 19, offsetY: 8, scale: 0.77, zIndex: 8 },
    { offsetX: -8, offsetY: 0, scale: 0.7, zIndex: 3 },
    { offsetX: -10, offsetY: 21, scale: 0.79, zIndex: 7 },
    { offsetX: -36, offsetY: 10, scale: 0.73, zIndex: 5 },
  ] as const;  const pelotonFrontSlots = [
    { offsetX: 61, offsetY: 8, scale: 0.9, zIndex: 12 },
    { offsetX: 34, offsetY: 8, scale: 0.86, zIndex: 11 },
    { offsetX: 8, offsetY: 9, scale: 0.83, zIndex: 10 },
    { offsetX: -20, offsetY: 1, scale: 0.78, zIndex: 4 },
    { offsetX: -18, offsetY: 25, scale: 0.9, zIndex: 9 },
    { offsetX: -47, offsetY: 12, scale: 0.83, zIndex: 6 },
    { offsetX: -69, offsetY: 0, scale: 0.76, zIndex: 2 },
    { offsetX: -70, offsetY: 30, scale: 0.91, zIndex: 8 },
  ] as const;
  const compactPrimeSprintSlots = [
    { offsetX: 52, offsetY: 0, scale: 0.86, zIndex: 12 },
    { offsetX: 43, offsetY: 19, scale: 0.86, zIndex: 13 },
    { offsetX: 33, offsetY: 37, scale: 0.86, zIndex: 14 },
    { offsetX: -8, offsetY: 8, scale: 0.72, zIndex: 4 },
    { offsetX: -31, offsetY: 24, scale: 0.78, zIndex: 7 },
  ] as const;  const primeSprintSlots = [
    { offsetX: 67, offsetY: 0, scale: 0.96, zIndex: 14 },
    { offsetX: 55, offsetY: 21, scale: 0.96, zIndex: 15 },
    { offsetX: 42, offsetY: 41, scale: 0.96, zIndex: 16 },
    { offsetX: 4, offsetY: 9, scale: 0.82, zIndex: 6 },
    { offsetX: -18, offsetY: 27, scale: 0.88, zIndex: 8 },
    { offsetX: -39, offsetY: 3, scale: 0.78, zIndex: 3 },
    { offsetX: -54, offsetY: 24, scale: 0.84, zIndex: 7 },
    { offsetX: -75, offsetY: 40, scale: 0.88, zIndex: 9 },
  ] as const;
  const slots =
    formation === "breakaway-line"
      ? compact
        ? compactBreakawayLineSlots
        : breakawayLineSlots
      : formation === "peloton-front"
        ? compact
          ? compactPelotonFrontSlots
          : pelotonFrontSlots
        : formation === "prime-sprint"
          ? compact
            ? compactPrimeSprintSlots
            : primeSprintSlots
          : compact
            ? compactSlots
            : comfortableSlots;

  return riderIds.slice(0, slots.length).map((riderId, index) => {
    const slot = slots[index];
    const microOffset =
      formation === "breakaway-line"
        ? ((stableVisualHash(riderId) % 3) - 1) * 0.75
        : (stableVisualHash(riderId) % 5) - 2;
    return {
      ...slot,
      offsetX: slot.offsetX + microOffset,
    };
  });
}

export function getIntermediateSprintVisualProgress({
  primeType,
  segmentProgress,
}: {
  primeType: "intermediate_sprint" | "mountain" | null;
  segmentProgress: number;
}) {
  if (
    primeType !== "intermediate_sprint" ||
    segmentProgress < 0.34 ||
    segmentProgress > 0.64
  ) {
    return null;
  }

  return Math.max(0, Math.min(1, (segmentProgress - 0.34) / 0.3));
}

export function getRaceGroupDisplayLabel({
  type,
  riderCount,
  gapToLeaderSeconds,
  fallbackLabel,
}: {
  type: "breakaway" | "chase" | "peloton" | "dropped" | "time_trial";
  riderCount: number;
  gapToLeaderSeconds: number;
  fallbackLabel: string;
}) {
  if (type !== "peloton" || riderCount >= 12) return fallbackLabel;

  return gapToLeaderSeconds <= 0
    ? "Groupe de t?te"
    : "Groupe principal";
}

export function shouldShowRaceSupportCars(groupCount: number) {
  return groupCount > 0 && groupCount <= 3;
}

function stableVisualHash(value: string) {
  return [...value].reduce(
    (total, character) =>
      (total * 31 + character.charCodeAt(0)) >>> 0,
    17,
  );
}
