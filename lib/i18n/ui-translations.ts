import generatedCatalog from "@/lib/i18n/generated-fr-en.json";

const REVIEWED_TRANSLATIONS: Record<string, string> = {
  "EN": "EN",
  "FR": "FR",
  "Baroudeur": "Breakaway specialist",
  "Boîte mail": "Mailbox",
  "Bureau du DS": "Sporting Director office",
  "Centre de formation": "Youth development centre",
  "Centre de soin": "Medical centre",
  "Classement": "Standings",
  "Classements": "Standings",
  "Contre-la-montre": "Time trial",
  "Coureur": "Rider",
  "Coureurs": "Riders",
  "Directeur Sportif": "Sporting Director",
  "Effectif": "Roster",
  "Entraînement": "Training",
  "Équipementier": "Equipment supplier",
  "Équipementiers": "Equipment suppliers",
  "Gestion du club": "Club management",
  "Infrastructures": "Facilities",
  "Installer l’application": "Install the app",
  "Inventaire": "Inventory",
  "Invitation": "Wild Card",
  "Invitation refusée": "Wild Card declined",
  "Kiné": "Physiotherapist",
  "Maillot": "Jersey",
  "Matériel": "Equipment",
  "Moyenne générale": "Overall average",
  "Objectif": "Objective",
  "Objectifs": "Objectives",
  "Parrainage": "Referral programme",
  "Pavé": "Cobblestone",
  "Pavés": "Cobblestones",
  "Plaine": "Flat",
  "Préparation de course": "Race preparation",
  "Demande d’invitation transmise": "Wild Card request submitted",
  "Demander une invitation": "Request a Wild Card",
  "Résultats": "Results",
  "Résultats / Live": "Results / Live",
  "Sponsoring": "Sponsorship",
  "Statistiques primaires": "Primary attributes",
  "Statistiques secondaires": "Secondary attributes",
  "Stratège": "Stratège",
  "Tableau de bord": "Dashboard",
  "Vallon": "Hills",
  "Vallons": "Hills",
};

export const UI_TRANSLATIONS: Readonly<Record<string, string>> = {
  ...(generatedCatalog as Record<string, string>),
  ...REVIEWED_TRANSLATIONS,
};

const EMBEDDED_TRANSLATIONS = Object.entries(UI_TRANSLATIONS)
  .filter(([source, target]) => {
    if (source === target || source.length < 4 || source.length > 180) return false;
    return (
      Object.hasOwn(REVIEWED_TRANSLATIONS, source) ||
      /[\s·:;,.!?«»'’()/%+−–—-]/.test(source)
    );
  })
  .sort(([left], [right]) => right.length - left.length);

const EMBEDDED_TRANSLATIONS_BY_ANCHOR = new Map<
  string,
  Array<(typeof EMBEDDED_TRANSLATIONS)[number]>
>();
const UNANCHORED_EMBEDDED_TRANSLATIONS: Array<
  (typeof EMBEDDED_TRANSLATIONS)[number]
> = [];

for (const translation of EMBEDDED_TRANSLATIONS) {
  const anchor = getTranslationAnchor(translation[0]);
  if (!anchor) {
    UNANCHORED_EMBEDDED_TRANSLATIONS.push(translation);
    continue;
  }

  const translations = EMBEDDED_TRANSLATIONS_BY_ANCHOR.get(anchor) ?? [];
  translations.push(translation);
  EMBEDDED_TRANSLATIONS_BY_ANCHOR.set(anchor, translations);
}

export function normalizeUiText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function translateUiText(value: string): string {
  const normalized = normalizeUiText(value);
  if (!normalized) return value;

  const directTranslation = UI_TRANSLATIONS[normalized];
  if (directTranslation) {
    return preserveOuterWhitespace(value, normalizeEnglishTerminology(directTranslation));
  }

  let translated = normalized;
  for (const [source, target] of getEmbeddedTranslationCandidates(normalized)) {
    if (translated.includes(source)) translated = translated.replaceAll(source, target);
  }

  const normalizedEnglish = normalizeEnglishTerminology(translated);
  return normalizedEnglish === normalized
    ? value
    : preserveOuterWhitespace(value, normalizedEnglish);
}

function getEmbeddedTranslationCandidates(
  value: string,
): Array<(typeof EMBEDDED_TRANSLATIONS)[number]> {
  const candidates = new Set<(typeof EMBEDDED_TRANSLATIONS)[number]>(
    UNANCHORED_EMBEDDED_TRANSLATIONS,
  );

  for (const token of value.match(/[\p{L}\p{N}]+/gu) ?? []) {
    const translations = EMBEDDED_TRANSLATIONS_BY_ANCHOR.get(
      token.toLocaleLowerCase("fr"),
    );
    if (!translations) continue;
    for (const translation of translations) candidates.add(translation);
  }

  return [...candidates].sort(
    ([left], [right]) => right.length - left.length,
  );
}

function getTranslationAnchor(value: string): string | null {
  const tokens = value.match(/[\p{L}\p{N}]+/gu) ?? [];
  const longestToken = tokens.reduce<string | null>(
    (longest, token) =>
      !longest || token.length > longest.length ? token : longest,
    null,
  );

  return longestToken?.toLocaleLowerCase("fr") ?? null;
}

function normalizeEnglishTerminology(value: string): string {
  return value
    .replace(/\bSports Directors\b/g, "Sporting Directors")
    .replace(/\bSports Director\b/g, "Sporting Director");
}

function preserveOuterWhitespace(source: string, translated: string): string {
  const leading = source.match(/^\s*/)?.[0] ?? "";
  const trailing = source.match(/\s*$/)?.[0] ?? "";
  return `${leading}${translated}${trailing}`;
}
