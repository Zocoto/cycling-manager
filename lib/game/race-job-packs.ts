export const RACE_JOB_PACK_COUNT = 3;
export const RACE_SIMULATION_EDITION_BATCH_SIZE = 3;
export const RACE_SETTLEMENT_EDITION_BATCH_SIZE = 3;

export type RaceJobPack = {
  packIndex: number;
  packCount: number;
};

export type RaceJobPackSelection<T> = RaceJobPack & {
  items: T[];
  eligibleItems: number;
  deferredItems: number;
};

/**
 * Les anciennes URL de cron restent acceptées comme un lot unique borné.
 * Les nouvelles URL se terminent par `-p1`, `-p2`, etc.
 */
export function getRaceJobPackFromSlot(
  slot: string,
  packCount = RACE_JOB_PACK_COUNT,
): RaceJobPack {
  const match = slot.match(/-p(\d+)$/);
  if (!match) return { packIndex: 0, packCount: 1 };

  const requestedPack = Number.parseInt(match[1], 10);
  if (
    !Number.isSafeInteger(requestedPack) ||
    requestedPack < 1 ||
    requestedPack > packCount
  ) {
    throw new RangeError(`Invalid race job pack in slot: ${slot}`);
  }

  return { packIndex: requestedPack - 1, packCount };
}

export function selectRaceJobPack<T>({
  items,
  getId,
  packIndex,
  packCount,
  limit,
}: {
  items: readonly T[];
  getId: (item: T) => string;
  packIndex: number;
  packCount: number;
  limit: number;
}): RaceJobPackSelection<T> {
  if (!Number.isInteger(packCount) || packCount < 1) {
    throw new RangeError("Race job pack count must be a positive integer.");
  }
  if (!Number.isInteger(packIndex) || packIndex < 0 || packIndex >= packCount) {
    throw new RangeError("Race job pack index is outside of its pack count.");
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError("Race job pack limit must be a positive integer.");
  }

  const eligible = items.filter(
    (item) => stableRaceJobHash(getId(item)) % packCount === packIndex,
  );

  return {
    packIndex,
    packCount,
    items: eligible.slice(0, limit),
    eligibleItems: eligible.length,
    deferredItems: Math.max(0, eligible.length - limit),
  };
}

function stableRaceJobHash(value: string) {
  // FNV-1a 32 bits : rapide, déterministe et identique entre les runtimes.
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
