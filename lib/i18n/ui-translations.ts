import generatedCatalog from "@/lib/i18n/generated-fr-en.json";

const REVIEWED_TRANSLATIONS: Record<string, string> = {
  "EN": "EN",
  "FR": "FR",
  "Annulé": "Cancelled",
  "Aucun coureur actif n’est présent dans l’effectif.":
    "There are no active riders in the roster.",
  "Baroudeur": "Breakaway specialist",
  "Boîte mail": "Mailbox",
  "Classement général des Grands Tours": "Grand Tour general classification",
  "Classiques ardennaises": "Ardennes classics",
  "Classiques pavées": "Cobbled classics",
  "Bureau du DS": "Sporting Director office",
  "Centre de formation": "Youth development centre",
  "Centre de soin": "Medical centre",
  "Classement": "Standings",
  "Classements": "Standings",
  "Chaque discipline regroupe les classements des pays liés à votre effectif. Les épreuves sans partant apparaissent comme annulées.":
    "Each discipline groups the results from the countries represented in your roster. Events with no starters are shown as cancelled.",
  "Championnats nationaux — inscription automatique du top 200 de chaque pays et des coureurs libres, grille route/CLM unifiée pour le DS, simulation simultanée sans live, résultats centralisés et un point de réputation par victoire.":
    "National Championships — automatic entry for each country’s top 200 and free agents, one road/TT grid for the Sporting Director, simultaneous simulation without live coverage, centralised results and one reputation point per win.",
  "CN CLM": "National TT",
  "CN en ligne": "National road race",
  "Consultez directement chaque classement officiel disponible.":
    "Open each available official result directly.",
  "Contre-la-montre": "Time trial",
  "Coureur": "Rider",
  "Coureurs": "Riders",
  "Directeur Sportif": "Sporting Director",
  "Effectif": "Roster",
  "Effectif complet": "Full roster",
  "Enregistrer les inscriptions": "Save entries",
  "Entraînement": "Training",
  "Équipementier": "Equipment supplier",
  "Équipementiers": "Equipment suppliers",
  "Épreuve absente": "Missing event",
  "est absente": "is missing",
  "Gérer les inscriptions": "Manage entries",
  "Gérez les inscriptions de toute votre équipe aux CN en ligne et contre-la-montre depuis une seule grille.":
    "Manage your whole team’s National road race and time trial entries from one grid.",
  "Gestion du club": "Club management",
  "Infrastructures": "Facilities",
  "Inscriptions aux championnats nationaux":
    "National Championships entries",
  "Inscriptions de l’équipe": "Team entries",
  "Installer l’application": "Install the app",
  "Inventaire": "Inventory",
  "Invitation": "Wild Card",
  "Invitation refusée": "Wild Card declined",
  "J8 · Deux disciplines · Une seule grille":
    "D8 · Two disciplines · One grid",
  "Kiné": "Physiotherapist",
  "Maillot": "Jersey",
  "Matériel": "Equipment",
  "Moyenne générale": "Overall average",
  "Objectif": "Objective",
  "Objectifs": "Objectives",
  "Philosophie sportive": "Sporting philosophy",
  "Préférence nationale": "National preference",
  "Formateur": "Youth development",
  "Le sponsor exige une forte majorité de coureurs de son pays. Cet engagement pèse lourd dans sa satisfaction et augmente de 15 % le budget proposé.":
    "The sponsor requires a strong majority of riders from its own country. This commitment weighs heavily on satisfaction and increases the proposed budget by 15%.",
  "Le sponsor privilégie les promotions du Centre de formation, la Dev Team, les victoires juniors et la valorisation de quelques coureurs formés au club.":
    "The sponsor prioritises academy promotions, the Development Team, junior victories and the development of a small number of homegrown riders.",
  "Pays / rang": "Country / rank",
  "Parrainage": "Referral programme",
  "Pavé": "Cobblestone",
  "Pavés": "Cobblestones",
  "Plaine": "Flat",
  "Préparation de course": "Race preparation",
  "Qualifié par défaut": "Qualified by default",
  "Demande d’invitation transmise": "Wild Card request submitted",
  "Demander une invitation": "Request a Wild Card",
  "Résultats": "Results",
  "Résultats / Live": "Results / Live",
  "Retour aux inscriptions courses": "Back to race entries",
  "s sont absentes": "s are missing",
  "Sponsoring": "Sponsorship",
  "Sprints": "Sprints",
  "Statistiques primaires": "Primary attributes",
  "Statistiques secondaires": "Secondary attributes",
  "Stratège": "Stratège",
  "Tableau de bord": "Dashboard",
  "Top 200 national par défaut": "National top 200 by default",
  "Tours intermédiaires": "Medium stage races",
  "Tous les coureurs sont regroupés ci-dessous. Le top 200 de chaque pays est coché par défaut ; vous pouvez ensuite confirmer ou retirer chaque participation jusqu’au départ de la discipline.":
    "All riders are grouped below. Each country’s top 200 is selected by default; you can then confirm or withdraw each entry until that discipline starts.",
  "Un coureur sélectionné ne fait pas partie de l’effectif.":
    "A selected rider is not part of the roster.",
  "Une case décochée signifie que le coureur ne prendra pas le départ. Chaque colonne se verrouille à l’heure de son CN.":
    "An unticked box means the rider will not start. Each column locks when its National Championship begins.",
  "Une seule grille regroupe le CN contre-la-montre à 14 h et le CN en ligne à 18 h pour tous les coureurs de l’effectif.":
    "One grid groups the 2 pm National time trial and the 6 pm National road race for every rider in the roster.",
  "Une seule grille regroupe le CN contre-la-montre et le CN en ligne de J8. Vérifiez les choix de tout votre effectif avant les départs.":
    "One grid groups the National time trial and road race on D8. Check the choices for your whole roster before the starts.",
  "Vallon": "Hills",
  "Vallons": "Hills",
  "Vous devez être connecté pour gérer les inscriptions.":
    "You must be signed in to manage entries.",
  "du calendrier. L’enregistrement est temporairement bloqué afin de ne perdre aucun choix.":
    "from the calendar. Saving is temporarily disabled so none of your choices are lost.",
  "La grille d’inscriptions transmise est invalide.":
    "The submitted entry grid is invalid.",
  "Les choix enregistrés remplacent la sélection automatique et restent prioritaires, même si le classement national évolue.":
    "Saved choices override automatic selection and remain authoritative even if the national ranking changes.",
  "Les inscriptions aux deux championnats ont bien été enregistrées.":
    "Entries for both championships have been saved.",
  "Le sponsor attend des performances sur les chronos individuels et par équipes.":
    "The sponsor expects strong performances in individual and team time trials.",
  "Le sponsor privilégie les arrivées massives et les courses favorables aux sprinteurs.":
    "The sponsor prioritises bunch finishes and races suited to sprinters.",
  "Le sponsor privilégie les classiques vallonnées et les arrivées pour puncheurs.":
    "The sponsor prioritises hilly classics and finishes suited to puncheurs.",
  "Le sponsor recherche des résultats au classement général des courses par étapes hors Grands Tours.":
    "The sponsor targets general classification results in stage races outside the Grand Tours.",
  "Le sponsor valorise les résultats sur les courses d’un jour disputées sur les pavés.":
    "The sponsor values results in cobbled one-day races.",
  "Le sponsor vise les classements généraux des Grands Tours dès que la réputation de l’équipe le permet.":
    "The sponsor targets Grand Tour general classifications as soon as the team’s reputation allows it.",
  "Les objectifs sont reliés au calendrier réel et à la philosophie de chaque sponsor. Les courses du pays du sponsor sont prioritaires, puis celles des pays voisins et enfin celles du même continent.":
    "Objectives are linked to the real calendar and each sponsor’s philosophy. Races in the sponsor’s country come first, followed by neighbouring countries and then the same continent.",
  "Les objectifs de course privilégient le pays du sponsor, puis ses voisins et enfin son continent. Les courses Continentales deviennent accessibles à 100 points de réputation, les Mondiales à 200 points.":
    "Race objectives prioritise the sponsor’s country, then its neighbours and finally its continent. Continental races unlock at 100 reputation points and World races at 200.",
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
