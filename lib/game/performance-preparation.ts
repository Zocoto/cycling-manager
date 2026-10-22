export const PERFORMANCE_PREPARATION_DAYS = 2;

export const PERFORMANCE_PREPARATION_FACILITIES = {
  indoor_track: { name: "Piste indoor", stats: "SPR · ACC", ratingKeys: ["sprint", "acceleration"], campType: "indoor_preparation", imagePath: "/images/infrastructure/indoor-track.webp" },
  wind_tunnel: { name: "Soufflerie", stats: "CLM · PRO · END", ratingKeys: ["timeTrial", "prologue", "endurance"], campType: "wind_tunnel_preparation", imagePath: "/images/infrastructure/wind-tunnel.webp" },
  cobbles_center: { name: "Centre des classiques", stats: "PAV", ratingKeys: ["cobbles"], campType: "cobbles_preparation", imagePath: "/images/infrastructure/cobbles-center.webp" },
  hills_circuit: { name: "Circuit de côtes", stats: "VAL", ratingKeys: ["hills"], campType: "hills_preparation", imagePath: "/images/infrastructure/hills-circuit.webp" },
  mountain_base: { name: "Base montagne", stats: "MO", ratingKeys: ["mountain"], campType: "mountain_preparation", imagePath: "/images/infrastructure/mountain-base.webp" },
} as const;

export type PerformancePreparationType = keyof typeof PERFORMANCE_PREPARATION_FACILITIES;
export const PERFORMANCE_PREPARATION_TYPES = Object.keys(PERFORMANCE_PREPARATION_FACILITIES) as PerformancePreparationType[];
export const TERRAIN_PREPARATION_SPECIALIZATIONS = {
  cobbles_center: ["cobbles_precision", "cobbles_durability", "cobbles_group"],
  hills_circuit: ["hills_precision", "hills_durability", "hills_group"],
  mountain_base: ["mountain_precision", "mountain_durability", "mountain_group"],
} as const;

export function isPerformancePreparationType(value: unknown): value is PerformancePreparationType {
  return typeof value === "string" && Object.hasOwn(PERFORMANCE_PREPARATION_FACILITIES, value);
}

export function getPerformancePreparationCampName(campType: string): string | null {
  return Object.values(PERFORMANCE_PREPARATION_FACILITIES).find(facility => facility.campType === campType)?.name ?? null;
}

export type PerformancePreparationPolicy = Readonly<{
  ratingBonus: number;
  bonusDays: number;
  capacity: number;
}>;

const POLICIES: readonly PerformancePreparationPolicy[] = [
  { ratingBonus: 1, bonusDays: 3, capacity: 1 },
  { ratingBonus: 1.5, bonusDays: 4, capacity: 1 },
  { ratingBonus: 2, bonusDays: 4, capacity: 2 },
  { ratingBonus: 2.5, bonusDays: 5, capacity: 2 },
  { ratingBonus: 3, bonusDays: 6, capacity: 3 },
];

/** Base values; the architect multiplier is captured by the server on booking. */
export function getPerformancePreparationPolicy(
  buildingLevel: number,
  options?: { preparationType: PerformancePreparationType; specializationCode?: string | null },
): PerformancePreparationPolicy | null {
  if (!Number.isInteger(buildingLevel) || buildingLevel < 1 || buildingLevel > 5) {
    return null;
  }
  const policy = POLICIES[buildingLevel - 1];
  if (!options || buildingLevel < 3 || !(options.preparationType in TERRAIN_PREPARATION_SPECIALIZATIONS)) return policy;
  const codes = TERRAIN_PREPARATION_SPECIALIZATIONS[options.preparationType as keyof typeof TERRAIN_PREPARATION_SPECIALIZATIONS];
  const power = buildingLevel === 3 ? 0.6 : buildingLevel === 4 ? 0.8 : 1;
  return {
    ratingBonus: policy.ratingBonus + (options.specializationCode === codes[0] ? power * 0.5 : 0),
    bonusDays: policy.bonusDays + (options.specializationCode === codes[1] ? Math.floor(power * 2) : 0),
    capacity: policy.capacity + (options.specializationCode === codes[2] ? 1 : 0),
  };
}
