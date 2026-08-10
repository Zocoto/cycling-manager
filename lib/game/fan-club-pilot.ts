export type FanClubPilotTab =
  | "overview"
  | "riders"
  | "travel"
  | "store";

export type FanClubPopularityHistoryEntry = {
  id: string;
  season: number;
  day: number;
  delta: number;
  scoreAfter: number;
  reason: string;
  category: "result" | "panache" | "loyalty" | "decay";
};

export type FanClubPilotRider = {
  id: string;
  name: string;
  initials: string;
  role: string;
  country: string;
  careerSeasons: number;
  seasonsAtClub: number;
  popularity: number;
  trend: number;
  status: string;
  currentDriver: string;
  phenomenalSeason: boolean;
  factors: ReadonlyArray<{
    label: string;
    value: number;
    maximum: number;
  }>;
  departureImpact: string;
  history: ReadonlyArray<FanClubPopularityHistoryEntry>;
};

export type FanClubSupporterBreakdown = {
  foundation: number;
  reputation: number;
  riders: number;
  recentResults: number;
  headquartersBonus: number;
};

export type FanClubLiveData = {
  teamName: string;
  supporterCount: number;
  supporterTrend: number;
  fervor: number;
  popularityIndex: number;
  recentResultsMultiplier: number;
  sportingResultCount: number;
  riders: ReadonlyArray<FanClubPilotRider>;
  races: ReadonlyArray<FanClubPilotRace>;
  supporterBreakdown: FanClubSupporterBreakdown;
};

export type FanClubCarModel = {
  id: string;
  name: string;
  description: string;
  capacity: number;
  purchasePrice: number;
  resaleRate: number;
  operatingCostPerKm: number;
  requiredHeadquartersLevel: number;
};

export type FanClubPilotRace = {
  id: string;
  name: string;
  timing: string;
  distanceKm: number;
};

export type FanClubShopLevel = {
  level: number;
  capacity: number;
  productCount: number;
};

export type FanClubProduct = {
  id: string;
  name: string;
  description: string;
  requiredShopLevel: number;
  wholesaleHistory: ReadonlyArray<number>;
  suggestedSalePrice: number;
  baseDailyPurchaseRate: number;
  priceElasticity: number;
};

export type FanClubTripPreview = {
  cars: number;
  seats: number;
  availableSupporters: number;
  travelers: number;
  occupancyRate: number;
  cost: number;
  level: 1 | 2 | 3 | 4;
  name: string;
  bonuses: ReadonlyArray<string>;
};

export const FAN_CLUB_SUPPORTER_COUNT = 12_480;
export const FAN_CLUB_FERVOR = 74;
export const FAN_CLUB_POPULARITY_INDEX = 58;
export const FAN_CLUB_TRAVEL_SHARE = 0.4;
export const FAN_CLUB_HEADQUARTERS_LEVEL = 2;
export const FAN_CLUB_SHOP_LEVEL = 1;

export const FAN_CLUB_PILOT_METRICS = [
  {
    label: "Supporters",
    value: "12 480",
    detail: "40 % mobilisables par déplacement",
  },
  {
    label: "Ferveur",
    value: "74 / 100",
    detail: "+8 depuis la dernière course",
  },
  {
    label: "Parc de cars",
    value: "3 / 5",
    detail: "2 régionaux · 1 grand tourisme",
  },
] as const;

export const FAN_CLUB_PILOT_RIDERS: ReadonlyArray<FanClubPilotRider> = [
  {
    id: "mael-durand",
    name: "Maël Durand",
    initials: "MD",
    role: "Puncheur",
    country: "France",
    careerSeasons: 4,
    seasonsAtClub: 4,
    popularity: 68,
    trend: 3,
    status: "Figure du club",
    currentDriver: "Échappée héroïque",
    phenomenalSeason: false,
    factors: [
      { label: "Résultats récents", value: 17, maximum: 25 },
      { label: "Palmarès majeur", value: 10, maximum: 20 },
      { label: "Panache et échappées", value: 13, maximum: 15 },
      { label: "Fidélité au club", value: 18, maximum: 25 },
      { label: "Affinité nationale", value: 7, maximum: 10 },
      { label: "Dynamique actuelle", value: 3, maximum: 5 },
    ],
    departureImpact:
      "Environ 1 620 supporters à risque et −9 points de ferveur.",
    history: [
      {
        id: "mael-s4-j68",
        season: 4,
        day: 68,
        delta: 3,
        scoreAfter: 68,
        reason: "Échappée de 146 km sur la Classique des Monts",
        category: "panache",
      },
      {
        id: "mael-s4-j51",
        season: 4,
        day: 51,
        delta: 2,
        scoreAfter: 65,
        reason: "Podium sur une classique de niveau national",
        category: "result",
      },
      {
        id: "mael-s4-j35",
        season: 4,
        day: 35,
        delta: -1,
        scoreAfter: 63,
        reason: "Ancien résultat sorti de la période récente",
        category: "decay",
      },
      {
        id: "mael-s4-j1",
        season: 4,
        day: 1,
        delta: 2,
        scoreAfter: 64,
        reason: "Début d’une quatrième saison avec le club",
        category: "loyalty",
      },
    ],
  },
  {
    id: "jonas-berg",
    name: "Jonas Berg",
    initials: "JB",
    role: "Grimpeur",
    country: "Danemark",
    careerSeasons: 2,
    seasonsAtClub: 2,
    popularity: 52,
    trend: 4,
    status: "Apprécié",
    currentDriver: "Victoire récente",
    phenomenalSeason: false,
    factors: [
      { label: "Résultats récents", value: 19, maximum: 25 },
      { label: "Palmarès majeur", value: 7, maximum: 20 },
      { label: "Panache et échappées", value: 7, maximum: 15 },
      { label: "Fidélité au club", value: 9, maximum: 25 },
      { label: "Affinité nationale", value: 6, maximum: 10 },
      { label: "Dynamique actuelle", value: 4, maximum: 5 },
    ],
    departureImpact:
      "Environ 860 supporters à risque et −5 points de ferveur.",
    history: [
      {
        id: "jonas-s2-j70",
        season: 2,
        day: 70,
        delta: 4,
        scoreAfter: 52,
        reason: "Victoire au sommet sur le Tour des Alpes",
        category: "result",
      },
      {
        id: "jonas-s2-j42",
        season: 2,
        day: 42,
        delta: 1,
        scoreAfter: 48,
        reason: "Première échappée marquante de la saison",
        category: "panache",
      },
      {
        id: "jonas-s2-j1",
        season: 2,
        day: 1,
        delta: 2,
        scoreAfter: 47,
        reason: "Deuxième saison consécutive au club",
        category: "loyalty",
      },
    ],
  },
  {
    id: "diego-alvarez",
    name: "Diego Álvarez",
    initials: "DA",
    role: "Sprinteur",
    country: "Colombie",
    careerSeasons: 3,
    seasonsAtClub: 3,
    popularity: 47,
    trend: -2,
    status: "Apprécié",
    currentDriver: "Résultats vieillissants",
    phenomenalSeason: false,
    factors: [
      { label: "Résultats récents", value: 12, maximum: 25 },
      { label: "Palmarès majeur", value: 8, maximum: 20 },
      { label: "Panache et échappées", value: 8, maximum: 15 },
      { label: "Fidélité au club", value: 12, maximum: 25 },
      { label: "Affinité nationale", value: 5, maximum: 10 },
      { label: "Dynamique actuelle", value: 2, maximum: 5 },
    ],
    departureImpact:
      "Environ 690 supporters à risque, principalement en Colombie.",
    history: [
      {
        id: "diego-s3-j66",
        season: 3,
        day: 66,
        delta: -2,
        scoreAfter: 47,
        reason: "Deux victoires sorties de la fenêtre des résultats récents",
        category: "decay",
      },
      {
        id: "diego-s3-j30",
        season: 3,
        day: 30,
        delta: 1,
        scoreAfter: 49,
        reason: "Deuxième place sur un sprint international",
        category: "result",
      },
      {
        id: "diego-s3-j1",
        season: 3,
        day: 1,
        delta: 2,
        scoreAfter: 48,
        reason: "Troisième saison consécutive au club",
        category: "loyalty",
      },
    ],
  },
  {
    id: "leo-moreau",
    name: "Léo Moreau",
    initials: "LM",
    role: "Rouleur",
    country: "France",
    careerSeasons: 1,
    seasonsAtClub: 1,
    popularity: 28,
    trend: 1,
    status: "Reconnu",
    currentDriver: "Première saison prometteuse",
    phenomenalSeason: false,
    factors: [
      { label: "Résultats récents", value: 8, maximum: 25 },
      { label: "Palmarès majeur", value: 1, maximum: 20 },
      { label: "Panache et échappées", value: 7, maximum: 15 },
      { label: "Fidélité au club", value: 5, maximum: 25 },
      { label: "Affinité nationale", value: 6, maximum: 10 },
      { label: "Dynamique actuelle", value: 1, maximum: 5 },
    ],
    departureImpact:
      "Environ 170 supporters à risque et un effet faible sur la ferveur.",
    history: [
      {
        id: "leo-s1-j58",
        season: 1,
        day: 58,
        delta: 1,
        scoreAfter: 28,
        reason: "Top 10 obtenu après une échappée matinale",
        category: "panache",
      },
      {
        id: "leo-s1-j25",
        season: 1,
        day: 25,
        delta: 2,
        scoreAfter: 27,
        reason: "Première apparition dans une course internationale",
        category: "result",
      },
    ],
  },
];

export const FAN_CLUB_CAR_MODELS: ReadonlyArray<FanClubCarModel> = [
  {
    id: "regional",
    name: "Car régional",
    description: "Format économique pour les déplacements proches.",
    capacity: 40,
    purchasePrice: 85_000,
    resaleRate: 0.65,
    operatingCostPerKm: 1.35,
    requiredHeadquartersLevel: 1,
  },
  {
    id: "grand-tourisme",
    name: "Car grand tourisme",
    description: "Davantage de places et de confort pour les longues distances.",
    capacity: 55,
    purchasePrice: 135_000,
    resaleRate: 0.65,
    operatingCostPerKm: 1.75,
    requiredHeadquartersLevel: 2,
  },
  {
    id: "double-etage",
    name: "Car double étage",
    description: "La capacité maximale pour les grandes mobilisations.",
    capacity: 80,
    purchasePrice: 220_000,
    resaleRate: 0.65,
    operatingCostPerKm: 2.4,
    requiredHeadquartersLevel: 3,
  },
];

export const FAN_CLUB_INITIAL_FLEET: Readonly<Record<string, number>> = {
  regional: 0,
  "grand-tourisme": 0,
  "double-etage": 0,
};

export const FAN_CLUB_FLEET_CAPACITY_BY_HEADQUARTERS_LEVEL: Readonly<
  Record<number, number>
> = {
  1: 2,
  2: 5,
  3: 10,
  4: 18,
  5: 30,
};

export const FAN_CLUB_PILOT_RACES: ReadonlyArray<FanClubPilotRace> = [
  {
    id: "flanders",
    name: "Grand Prix des Flandres",
    timing: "J+3",
    distanceKm: 420,
  },
  {
    id: "armor",
    name: "Boucles d’Armor",
    timing: "J+8",
    distanceKm: 170,
  },
  {
    id: "alps",
    name: "Tour des Alpes",
    timing: "J+14",
    distanceKm: 690,
  },
];

export const FAN_CLUB_SHOP_LEVELS: ReadonlyArray<FanClubShopLevel> = [
  { level: 1, capacity: 300, productCount: 1 },
  { level: 2, capacity: 800, productCount: 2 },
  { level: 3, capacity: 1_600, productCount: 3 },
  { level: 4, capacity: 3_000, productCount: 4 },
  { level: 5, capacity: 5_000, productCount: 5 },
];

export const FAN_CLUB_PRODUCTS: ReadonlyArray<FanClubProduct> = [
  {
    id: "team-jersey",
    name: "Maillot de l’équipe",
    description: "Réplique officielle du maillot porté par les coureurs.",
    requiredShopLevel: 1,
    wholesaleHistory: [36, 35, 37, 39, 38, 40, 38],
    suggestedSalePrice: 69,
    baseDailyPurchaseRate: 0.0015,
    priceElasticity: 1.6,
  },
  {
    id: "bottle",
    name: "Bidon",
    description: "Bidon cycliste aux couleurs de l’équipe.",
    requiredShopLevel: 2,
    wholesaleHistory: [5.1, 5, 5.2, 5.4, 5.3, 5.1, 5.2],
    suggestedSalePrice: 12,
    baseDailyPurchaseRate: 0.003,
    priceElasticity: 1.35,
  },
  {
    id: "pennant",
    name: "Fanion",
    description: "Petit fanion textile à afficher ou emmener sur les courses.",
    requiredShopLevel: 3,
    wholesaleHistory: [7.4, 7.6, 7.8, 8.1, 8, 8.2, 8],
    suggestedSalePrice: 18,
    baseDailyPurchaseRate: 0.0022,
    priceElasticity: 1.45,
  },
  {
    id: "cap",
    name: "Casquette",
    description: "Casquette officielle avec le logo du club.",
    requiredShopLevel: 4,
    wholesaleHistory: [9.2, 9.1, 9.4, 9.7, 9.6, 9.8, 9.5],
    suggestedSalePrice: 24,
    baseDailyPurchaseRate: 0.002,
    priceElasticity: 1.5,
  },
  {
    id: "supporter-balloon",
    name: "Ballon de supporter",
    description: "Ballon gonflable aux couleurs de l’équipe pour les arrivées.",
    requiredShopLevel: 5,
    wholesaleHistory: [1.7, 1.8, 1.75, 1.9, 1.85, 1.8, 1.82],
    suggestedSalePrice: 5,
    baseDailyPurchaseRate: 0.004,
    priceElasticity: 1.2,
  },
];

export const FAN_CLUB_INITIAL_STOCK: Readonly<Record<string, number>> = {
  "team-jersey": 0,
  bottle: 0,
  pennant: 0,
  cap: 0,
  "supporter-balloon": 0,
};

export const FAN_CLUB_INITIAL_AVERAGE_COST: Readonly<Record<string, number>> = {
  "team-jersey": 0,
  bottle: 0,
  pennant: 0,
  cap: 0,
  "supporter-balloon": 0,
};

export function getPopularityMaturityCap(
  seasonsAtClub: number,
  phenomenalSeason = false,
): number {
  if (phenomenalSeason) return 100;
  if (seasonsAtClub >= 3) return 100;
  if (seasonsAtClub === 2) return 80;
  return 60;
}

export function getAvailableTravelingSupporters(
  supporterCount: number,
): number {
  return Math.max(
    0,
    Math.floor(Math.max(0, supporterCount) * FAN_CLUB_TRAVEL_SHARE),
  );
}

export function calculateCarResalePrice(model: FanClubCarModel): number {
  return Math.round(model.purchasePrice * model.resaleRate);
}

export function calculateFanClubTripPreview({
  model,
  requestedCars,
  ownedCars,
  supporterCount,
  distanceKm,
}: {
  model: FanClubCarModel;
  requestedCars: number;
  ownedCars: number;
  supporterCount: number;
  distanceKm: number;
}): FanClubTripPreview {
  const safeOwnedCars = Math.max(0, Math.floor(ownedCars));
  const cars = Math.max(
    0,
    Math.min(safeOwnedCars, Math.max(0, Math.floor(requestedCars))),
  );
  const seats = cars * model.capacity;
  const availableSupporters = getAvailableTravelingSupporters(supporterCount);
  const travelers = Math.min(availableSupporters, seats);
  const occupancyRate =
    seats === 0 ? 0 : Math.round((travelers / seats) * 100);
  const safeDistanceKm = Math.max(0, Math.round(distanceKm));
  const cost = Math.round(
    cars * (safeDistanceKm * 2 * model.operatingCostPerKm + 250),
  );

  if (travelers >= 220) {
    return {
      cars,
      seats,
      availableSupporters,
      travelers,
      occupancyRate,
      cost,
      level: 4,
      name: "Marée de supporters",
      bonuses: ["+2 Résistance", "+1 Accélération"],
    };
  }

  if (travelers >= 120) {
    return {
      cars,
      seats,
      availableSupporters,
      travelers,
      occupancyRate,
      cost,
      level: 3,
      name: "Forte mobilisation",
      bonuses: ["+1 Résistance", "+1 Accélération"],
    };
  }

  if (travelers >= 40) {
    return {
      cars,
      seats,
      availableSupporters,
      travelers,
      occupancyRate,
      cost,
      level: 2,
      name: "Tribune engagée",
      bonuses: ["+1 Résistance"],
    };
  }

  return {
    cars,
    seats,
    availableSupporters,
    travelers,
    occupancyRate,
    cost,
    level: 1,
    name: cars > 0 ? "Présence visible" : "Aucun car engagé",
    bonuses: cars > 0 ? ["+1 Motivation"] : [],
  };
}

export function getCurrentWholesalePrice(product: FanClubProduct): number {
  return product.wholesaleHistory.at(-1) ?? 0;
}

export function getWholesaleTrendPercent(product: FanClubProduct): number {
  const firstPrice = product.wholesaleHistory[0] ?? 0;
  const currentPrice = getCurrentWholesalePrice(product);
  if (firstPrice <= 0) return 0;
  return ((currentPrice - firstPrice) / firstPrice) * 100;
}

export function estimateDailyProductSales({
  product,
  salePrice,
  supporterCount,
  fervor,
  popularityIndex,
  recentResultsMultiplier = 1,
}: {
  product: FanClubProduct;
  salePrice: number;
  supporterCount: number;
  fervor: number;
  popularityIndex: number;
  recentResultsMultiplier?: number;
}): number {
  const safeSalePrice = Math.max(0.01, salePrice);
  const fervorFactor = 0.65 + Math.max(0, Math.min(100, fervor)) / 200;
  const popularityFactor =
    0.75 + Math.max(0, Math.min(100, popularityIndex)) / 200;
  const priceFactor = Math.max(
    0.2,
    Math.min(
      2,
      Math.pow(
        product.suggestedSalePrice / safeSalePrice,
        product.priceElasticity,
      ),
    ),
  );
  const rawDemand =
    Math.max(0, supporterCount) *
    product.baseDailyPurchaseRate *
    fervorFactor *
    popularityFactor *
    Math.max(0, recentResultsMultiplier) *
    priceFactor;

  return Math.max(0, Math.round(rawDemand));
}
