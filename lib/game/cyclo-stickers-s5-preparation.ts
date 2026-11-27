/** Editorial layout only. This is deliberately not a CollectorAlbumSnapshot:
 * no rider, result, rating, jersey, inventory or reward can be inferred from it. */
export const CYCLO_STICKERS_S5_PREPARATION = {
  id: "cyclo-stickers-s6-s5-preparation-v1",
  sourceSeason: 5,
  collectionSeason: 6,
  status: "preparation",
  publicApproved: false,
  cardsReady: false,
  cardCreationDay: 28,
  title: "La saison Cumbre",
  subtitle: "Des sommets dans les jambes, des réponses dans la tête.",
} as const;

const continents = [
  ["africa", "Afrique"], ["america", "Amérique"], ["asia", "Asie"],
  ["europe", "Europe"], ["oceania", "Océanie"],
] as const;

export type SeasonFiveAlbumSection = "ranking" | "teams" | "continental" | "world" | "memories" | "breakaway";
export type SeasonFiveAlbumSlot = {
  number: number;
  key: string;
  section: SeasonFiveAlbumSection;
  label: string;
  // An explicit empty identity keeps this plan distinct from a real catalogue.
  cardId: null;
};

export const SEASON_FIVE_ALBUM_SECTIONS = [
  { id: "ranking", label: "Le top 50", description: "Les cinquante premiers du classement UCI final S5." },
  { id: "teams", label: "Les équipes", description: "Les cinq premières équipes, avec leurs couleurs de S5." },
  { id: "continental", label: "Les continents", description: "Route et contre-la-montre sur les cinq continents." },
  { id: "world", label: "Les champions du monde", description: "Les deux titres mondiaux professionnels de S5." },
  { id: "memories", label: "Les souvenirs", description: "Cycl’o Quizz et la saison Cumbre sur les grands tours." },
  { id: "breakaway", label: "Les baroudeurs", description: "Trois places pour les histoires qui dépassent le top 50." },
] as const satisfies readonly { id: SeasonFiveAlbumSection; label: string; description: string }[];

const placeholders: Omit<SeasonFiveAlbumSlot, "number" | "cardId">[] = [
  ...Array.from({ length: 50 }, (_, index) => ({
    key: `uci-${index + 1}`, section: "ranking" as const, label: `Classement UCI · ${index + 1}`,
  })),
  ...Array.from({ length: 5 }, (_, index) => ({
    key: `team-${index + 1}`, section: "teams" as const, label: `Classement des équipes · ${index + 1}`,
  })),
  ...continents.flatMap(([code, label]) => [
    { key: `continental-${code}-road`, section: "continental" as const, label: `${label} · Route` },
    { key: `continental-${code}-time-trial`, section: "continental" as const, label: `${label} · CLM` },
  ]),
  { key: "world-road", section: "world", label: "Champion du monde · Route" },
  { key: "world-time-trial", section: "world", label: "Champion du monde · CLM" },
  { key: "memory-cyclo-quizz", section: "memories", label: "Cycl’o Quizz" },
  { key: "memory-cumbre", section: "memories", label: "La saison Cumbre" },
  ...Array.from({ length: 3 }, (_, index) => ({
    key: `breakaway-${index + 1}`, section: "breakaway" as const, label: `Baroudeur · ${index + 1}`,
  })),
];

export const SEASON_FIVE_ALBUM_SLOTS: readonly SeasonFiveAlbumSlot[] = placeholders.map((slot, index) => ({
  ...slot, number: index + 1, cardId: null,
}));

export const SEASON_FIVE_ALBUM_PAGES = SEASON_FIVE_ALBUM_SECTIONS.flatMap(section => {
  const slots = SEASON_FIVE_ALBUM_SLOTS.filter(slot => slot.section === section.id);
  return Array.from({ length: Math.ceil(slots.length / 6) }, (_, index) => ({
    section, slots: slots.slice(index * 6, index * 6 + 6),
    sectionPage: index + 1, sectionPages: Math.ceil(slots.length / 6),
  }));
});
