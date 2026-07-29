export type RaceGroupRiderSlot = {
  offsetX: number;
  offsetY: number;
  scale: number;
  zIndex: number;
};

export function getRaceGroupRiderSlots({
  riderIds,
  compact,
}: {
  riderIds: readonly string[];
  compact: boolean;
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
  const slots = compact ? compactSlots : comfortableSlots;

  return riderIds.slice(0, slots.length).map((riderId, index) => {
    const slot = slots[index];
    const microOffset = (stableVisualHash(riderId) % 5) - 2;
    return {
      ...slot,
      offsetX: slot.offsetX + microOffset,
    };
  });
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
