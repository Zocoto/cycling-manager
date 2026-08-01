export const PLAYER_ACTIVITY_MONITOR_ALLOWED_EMAIL =
  "paul.leblanc22@gmail.com";

export type PlayerActivityEventType =
  | "page_view"
  | "form_submit"
  | "interaction";

export type PlayerActivityDeviceType = "desktop" | "tablet" | "mobile";

export type PlayerActivityInput = {
  eventType: PlayerActivityEventType;
  routePath: string;
  sectionKey: string;
  actionKey: string | null;
  actionLabel: string | null;
  deviceType: PlayerActivityDeviceType;
};

const SECTION_LABELS: Record<string, string> = {
  bureau: "Bureau du DS",
  calendrier: "Calendrier",
  "centre-de-formation": "Centre de formation",
  "centre-de-soin": "Centre de soin",
  "championnats-nationaux": "Championnats nationaux",
  chat: "Chat",
  classements: "Classements",
  coureurs: "Fiches coureurs",
  courses: "Courses",
  "directeur-sportif": "Profil du DS",
  "directeurs-sportifs": "Directeurs sportifs",
  effectif: "Effectif",
  entrainement: "Entraînement",
  equipe: "Équipe",
  equipes: "Équipes",
  finances: "Finances",
  infrastructures: "Infrastructures",
  inventaire: "Inventaire",
  maillot: "Maillot",
  materiel: "Matériel",
  nations: "Nations",
  objectifs: "Objectifs",
  recherche: "Recherche",
  resultats: "Résultats",
  "selections-internationales": "Sélections internationales",
  sponsoring: "Sponsoring",
  staff: "Staff",
  transferts: "Bureau des transferts",
};

export const PLAYER_ACTIVITY_SECTIONS = Object.entries(SECTION_LABELS).map(
  ([key, label]) => ({ key, label }),
);

export function canAccessPlayerActivityMonitoring(
  email: string | null | undefined,
) {
  return (
    email?.trim().toLowerCase() === PLAYER_ACTIVITY_MONITOR_ALLOWED_EMAIL
  );
}

export function normalizePlayerActivityRoute(pathname: string) {
  const normalized = pathname.trim().replace(/\/{2,}/g, "/");

  if (
    normalized !== "/jeu" &&
    !normalized.startsWith("/jeu/")
  ) {
    return null;
  }

  return normalized.slice(0, 200);
}

export function getPlayerActivitySection(pathname: string) {
  const routePath = normalizePlayerActivityRoute(pathname);
  if (!routePath) return { key: "inconnue", label: "Rubrique inconnue" };

  const segment = routePath.split("/").filter(Boolean)[1] ?? "bureau";
  const key = normalizePlayerActivityKey(segment) || "inconnue";

  return {
    key,
    label: getPlayerActivitySectionLabel(key),
  };
}

export function getPlayerActivitySectionLabel(sectionKey: string) {
  return SECTION_LABELS[sectionKey] ?? humanizeKey(sectionKey);
}

export function normalizePlayerActivityLabel(value: string | null | undefined) {
  if (!value) return null;

  const normalized = value
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return normalized ? normalized.slice(0, 120) : null;
}

export function normalizePlayerActivityKey(value: string | null | undefined) {
  const label = normalizePlayerActivityLabel(value);
  if (!label) return null;

  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function normalizePlayerActivityInput(
  value: unknown,
): PlayerActivityInput | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Record<string, unknown>;
  const eventType = candidate.eventType;
  const deviceType = candidate.deviceType;
  const routePath =
    typeof candidate.routePath === "string"
      ? normalizePlayerActivityRoute(candidate.routePath)
      : null;

  if (
    !routePath ||
    !isPlayerActivityEventType(eventType) ||
    !isPlayerActivityDeviceType(deviceType)
  ) {
    return null;
  }

  const section = getPlayerActivitySection(routePath);
  const suppliedSection =
    typeof candidate.sectionKey === "string"
      ? normalizePlayerActivityKey(candidate.sectionKey)
      : null;

  return {
    eventType,
    routePath,
    sectionKey: suppliedSection ?? section.key,
    actionKey:
      typeof candidate.actionKey === "string"
        ? normalizePlayerActivityKey(candidate.actionKey)
        : null,
    actionLabel:
      typeof candidate.actionLabel === "string"
        ? normalizePlayerActivityLabel(candidate.actionLabel)
        : null,
    deviceType,
  };
}

function isPlayerActivityEventType(
  value: unknown,
): value is PlayerActivityEventType {
  return (
    value === "page_view" ||
    value === "form_submit" ||
    value === "interaction"
  );
}

function isPlayerActivityDeviceType(
  value: unknown,
): value is PlayerActivityDeviceType {
  return value === "desktop" || value === "tablet" || value === "mobile";
}

function humanizeKey(value: string) {
  const normalized = value.replace(/-/g, " ").trim();
  if (!normalized) return "Rubrique inconnue";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
