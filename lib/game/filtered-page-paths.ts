import {
  isInventoryCategory,
  type InventoryCategory,
} from "@/lib/game/inventory";
import {
  parseGameObjectiveStatusFilter,
  parseGameObjectiveTypeFilter,
  type GameObjectiveStatusFilter,
  type GameObjectiveTypeFilter,
} from "@/lib/game/objectives";
import {
  RIDER_RATING_AXES,
  type RiderRatingKey,
} from "@/lib/game/rider-profile";
import {
  isStaffRole,
  isTrainerSpecialty,
  type StaffRole,
  type TrainerSpecialty,
} from "@/lib/game/staff";
import {
  isTransferRiderProfileFilter,
  type TransferRiderProfileFilter,
} from "@/lib/game/transfer-market";

const LOCAL_ORIGIN = "https://cycling-manager.local";

export type TransferMarketTab =
  | "quotidiennes"
  | "directeurs"
  | "libres"
  | "offres";

export type TransferMarketReturnFilters = {
  profile?: TransferRiderProfileFilter;
  country?: string;
  minimumAge?: number;
  maximumAge?: number;
  rating?: RiderRatingKey | "overall";
  minimumRating?: number;
};

export function buildTransferMarketReturnPath(
  tab: TransferMarketTab,
  filters: TransferMarketReturnFilters = {},
) {
  const params = new URLSearchParams({ onglet: tab });

  if (tab === "libres") {
    setOptionalParam(params, "profil", filters.profile);
    setOptionalParam(params, "pays", normalizeCountryCode(filters.country));
    setOptionalNumber(params, "ageMin", filters.minimumAge, 15, 60);
    setOptionalNumber(params, "ageMax", filters.maximumAge, 15, 60);
    setOptionalParam(params, "stat", normalizeRating(filters.rating));
    setOptionalNumber(params, "statMin", filters.minimumRating, 0, 100);
  }

  return `/jeu/transferts?${params.toString()}`;
}

export function sanitizeTransferMarketReturnPath(value: string) {
  const url = readLocalPageUrl(value, "/jeu/transferts");
  if (!url) return buildTransferMarketReturnPath("quotidiennes");

  return buildTransferMarketReturnPath(readTransferTab(url.searchParams.get("onglet")), {
    profile: readTransferProfile(url.searchParams.get("profil")),
    country: normalizeCountryCode(url.searchParams.get("pays")),
    minimumAge: readBoundedNumber(url.searchParams.get("ageMin"), 15, 60),
    maximumAge: readBoundedNumber(url.searchParams.get("ageMax"), 15, 60),
    rating: normalizeRating(url.searchParams.get("stat")),
    minimumRating: readBoundedNumber(url.searchParams.get("statMin"), 0, 100),
  });
}

export type StaffMarketReturnFilters = {
  role?: StaffRole;
  level?: number;
  countryCode?: string;
  trainerSpecialty?: TrainerSpecialty;
};

export function buildStaffMarketReturnPath(
  filters: StaffMarketReturnFilters = {},
) {
  const params = new URLSearchParams({ onglet: "marche" });
  setOptionalParam(params, "metier", filters.role);
  setOptionalNumber(params, "niveau", filters.level, 1, 5);
  setOptionalParam(
    params,
    "pays",
    normalizeCountryCode(filters.countryCode),
  );
  setOptionalParam(params, "specialite", filters.trainerSpecialty);
  return `/jeu/staff?${params.toString()}`;
}

export function sanitizeStaffMarketReturnPath(value: string) {
  const url = readLocalPageUrl(value, "/jeu/staff");
  if (!url) return buildStaffMarketReturnPath();

  const role = url.searchParams.get("metier");
  const specialty = url.searchParams.get("specialite");

  return buildStaffMarketReturnPath({
    role: role && isStaffRole(role) ? role : undefined,
    level: readBoundedNumber(url.searchParams.get("niveau"), 1, 5),
    countryCode: normalizeCountryCode(url.searchParams.get("pays")),
    trainerSpecialty:
      specialty && isTrainerSpecialty(specialty) ? specialty : undefined,
  });
}

export type ObjectivesReturnFilters = {
  type: GameObjectiveTypeFilter;
  status: GameObjectiveStatusFilter;
  group: string;
};

export function buildObjectivesReturnPath(filters: ObjectivesReturnFilters) {
  const params = new URLSearchParams();
  if (filters.type !== "all") params.set("type", filters.type);
  if (filters.status !== "all") params.set("statut", filters.status);
  if (filters.group !== "all" && isObjectiveGroup(filters.group)) {
    params.set("groupe", filters.group);
  }
  const query = params.toString();
  return `/jeu/objectifs${query ? `?${query}` : ""}#objectives-list`;
}

export function sanitizeObjectivesReturnPath(value: string) {
  const url = readLocalPageUrl(value, "/jeu/objectifs");
  if (!url) {
    return buildObjectivesReturnPath({
      type: "all",
      status: "all",
      group: "all",
    });
  }

  const group = url.searchParams.get("groupe");
  return buildObjectivesReturnPath({
    type: parseGameObjectiveTypeFilter(url.searchParams.get("type") ?? ""),
    status: parseGameObjectiveStatusFilter(
      url.searchParams.get("statut") ?? "",
    ),
    group: group && isObjectiveGroup(group) ? group : "all",
  });
}

export function buildInventoryReturnPath(
  category: InventoryCategory | null = null,
) {
  return category
    ? `/jeu/inventaire?categorie=${encodeURIComponent(category)}`
    : "/jeu/inventaire";
}

export function sanitizeInventoryReturnPath(value: string) {
  const url = readLocalPageUrl(value, "/jeu/inventaire");
  if (!url) return buildInventoryReturnPath();
  const category = url.searchParams.get("categorie");
  return buildInventoryReturnPath(
    category && isInventoryCategory(category) ? category : null,
  );
}

export function buildRiderReturnPath(value: string, riderId: string) {
  const pathname = `/jeu/coureurs/${riderId}`;
  return readLocalPageUrl(value, pathname) ? pathname : null;
}

export function withPageFeedback(
  path: string,
  key: "succes" | "erreur",
  message: string,
) {
  const url = new URL(path, LOCAL_ORIGIN);
  url.searchParams.delete(key === "succes" ? "erreur" : "succes");
  url.searchParams.set(key, message.slice(0, 300));
  return `${url.pathname}${url.search}${url.hash}`;
}

function readLocalPageUrl(value: string, pathname: string) {
  if (
    !value ||
    value.length > 2_048 ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return null;
  }

  try {
    const url = new URL(value, LOCAL_ORIGIN);
    return url.origin === LOCAL_ORIGIN && url.pathname === pathname ? url : null;
  } catch {
    return null;
  }
}

function readTransferTab(value: string | null): TransferMarketTab {
  return value === "directeurs" || value === "libres" || value === "offres"
    ? value
    : "quotidiennes";
}

function readTransferProfile(value: string | null) {
  return value && isTransferRiderProfileFilter(value) ? value : undefined;
}

function normalizeRating(value: string | null | undefined) {
  return value === "overall" ||
    RIDER_RATING_AXES.some((axis) => axis.key === value)
    ? (value as RiderRatingKey | "overall")
    : undefined;
}

function normalizeCountryCode(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase();
  return normalized && /^[A-Z]{2}$/.test(normalized) ? normalized : undefined;
}

function readBoundedNumber(
  value: string | null,
  minimum: number,
  maximum: number,
) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) &&
    parsed >= minimum &&
    parsed <= maximum
    ? parsed
    : undefined;
}

function setOptionalNumber(
  params: URLSearchParams,
  key: string,
  value: number | undefined,
  minimum: number,
  maximum: number,
) {
  if (
    value !== undefined &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  ) {
    params.set(key, String(value));
  }
}

function setOptionalParam(
  params: URLSearchParams,
  key: string,
  value: string | undefined,
) {
  if (value) params.set(key, value);
}

function isObjectiveGroup(value: string) {
  return /^[a-z0-9_]{1,80}$/.test(value);
}
