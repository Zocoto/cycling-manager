export const SEASON_AWARD_KEYS = [
  "rider_of_year",
  "team_of_year",
  "serial_winner",
  "young_rider",
  "director_of_year",
  "injury_rider",
  "injury_director",
  "red_lantern_rider",
  "red_lantern_director",
  "negotiator",
  "sudoku_master",
  "crossword_master",
  "builder",
  "mixed_zone",
  "chatterbox",
  "youth_developer",
  "junior_rider_of_year",
  "junior_director_of_year",
  "paddock_favorite",
] as const;

export type SeasonAwardKey = (typeof SEASON_AWARD_KEYS)[number];

export type SeasonAwardTone =
  | "gold"
  | "emerald"
  | "ruby"
  | "violet"
  | "cobalt"
  | "amber"
  | "teal"
  | "rose"
  | "slate";

export type SeasonAwardIcon =
  | "crown"
  | "team"
  | "bouquet"
  | "spark"
  | "tactics"
  | "crutch"
  | "medical"
  | "lantern"
  | "lanterns"
  | "handshake"
  | "sudoku"
  | "crossword"
  | "builder"
  | "microphone"
  | "chat"
  | "academy"
  | "junior"
  | "podium"
  | "heart";

type AwardLocaleCopy = {
  title: string;
  description: string;
};

export type SeasonAwardPresentation = {
  tone: SeasonAwardTone;
  icon: SeasonAwardIcon;
  order: number;
  fr: AwardLocaleCopy;
  en: AwardLocaleCopy;
};

export const SEASON_AWARD_PRESENTATION: Record<
  SeasonAwardKey,
  SeasonAwardPresentation
> = {
  rider_of_year: {
    tone: "gold",
    icon: "crown",
    order: 10,
    fr: { title: "Coureur de l’année", description: "La référence du peloton au classement individuel de la saison." },
    en: { title: "Rider of the year", description: "The season’s leading rider in the individual ranking." },
  },
  team_of_year: {
    tone: "emerald",
    icon: "team",
    order: 20,
    fr: { title: "Équipe de l’année", description: "Le collectif qui termine la saison au sommet du classement UCI." },
    en: { title: "Team of the year", description: "The team that finishes the season at the top of the UCI ranking." },
  },
  director_of_year: {
    tone: "gold",
    icon: "tactics",
    order: 30,
    fr: { title: "Directeur Sportif de l’année", description: "Le DS du meilleur collectif humain au terme de la saison." },
    en: { title: "Sporting Director of the year", description: "The sporting director of the season’s best human-managed team." },
  },
  serial_winner: {
    tone: "amber",
    icon: "bouquet",
    order: 40,
    fr: { title: "Chasseur de bouquets", description: "Le coureur qui a levé les bras le plus souvent cette saison." },
    en: { title: "Serial winner", description: "The rider who raised their arms most often this season." },
  },
  young_rider: {
    tone: "cobalt",
    icon: "spark",
    order: 50,
    fr: { title: "Révélation de l’année", description: "Le meilleur coureur de 23 ans ou moins au classement individuel." },
    en: { title: "Breakthrough rider", description: "The best rider aged 23 or under in the individual ranking." },
  },
  junior_rider_of_year: {
    tone: "cobalt",
    icon: "junior",
    order: 60,
    fr: { title: "Étoile junior", description: "Le numéro un du classement UCI junior de la saison." },
    en: { title: "Junior star", description: "The season’s number one rider in the junior UCI ranking." },
  },
  junior_director_of_year: {
    tone: "violet",
    icon: "podium",
    order: 70,
    fr: { title: "Trophée de la relève", description: "Le DS qui a accompagné le numéro un du classement UCI junior." },
    en: { title: "Youth pathway award", description: "The sporting director behind the number one junior rider." },
  },
  youth_developer: {
    tone: "emerald",
    icon: "academy",
    order: 80,
    fr: { title: "Le Formateur", description: "Le DS qui compte le plus de juniors dans son école en fin de saison." },
    en: { title: "The Developer", description: "The sporting director with the largest academy at season end." },
  },
  builder: {
    tone: "amber",
    icon: "builder",
    order: 90,
    fr: { title: "Le Bâtisseur", description: "Le DS qui a investi le plus dans ses infrastructures pendant la saison." },
    en: { title: "The Builder", description: "The sporting director who invested the most in infrastructure this season." },
  },
  negotiator: {
    tone: "teal",
    icon: "handshake",
    order: 100,
    fr: { title: "Le Négociateur", description: "Le DS qui a adressé le plus d’offres directes à ses homologues." },
    en: { title: "The Negotiator", description: "The sporting director who sent the most direct offers to fellow managers." },
  },
  mixed_zone: {
    tone: "violet",
    icon: "microphone",
    order: 110,
    fr: { title: "La Voix de la zone mixte", description: "Le DS qui a répondu au plus grand nombre d’interviews et conférences." },
    en: { title: "Mixed-zone voice", description: "The sporting director who answered the most interviews and press conferences." },
  },
  paddock_favorite: {
    tone: "rose",
    icon: "heart",
    order: 120,
    fr: { title: "Le Chouchou du paddock", description: "Le DS dont les messages ont reçu le plus de réactions de la communauté." },
    en: { title: "Paddock favourite", description: "The sporting director whose messages received the most community reactions." },
  },
  chatterbox: {
    tone: "teal",
    icon: "chat",
    order: 130,
    fr: { title: "Le Blablateur", description: "Le DS qui a publié le plus de messages dans le chat général." },
    en: { title: "The Chatterbox", description: "The sporting director who posted the most messages in the global chat." },
  },
  sudoku_master: {
    tone: "cobalt",
    icon: "sudoku",
    order: 140,
    fr: { title: "Le Maître des cases", description: "Le DS qui a résolu le plus de Sudokus de La Cyclogazette." },
    en: { title: "Master of squares", description: "The sporting director who solved the most Cyclogazette Sudokus." },
  },
  crossword_master: {
    tone: "violet",
    icon: "crossword",
    order: 150,
    fr: { title: "La Plume du peloton", description: "Le DS qui a terminé le plus de mots croisés de La Cyclogazette." },
    en: { title: "Peloton wordsmith", description: "The sporting director who completed the most Cyclogazette crosswords." },
  },
  injury_rider: {
    tone: "slate",
    icon: "crutch",
    order: 160,
    fr: { title: "La Béquille", description: "Le coureur qui a cumulé le plus de jours d’arrêt sur blessure." },
    en: { title: "The Crutch", description: "The rider who accumulated the most injury recovery days." },
  },
  injury_director: {
    tone: "ruby",
    icon: "medical",
    order: 170,
    fr: { title: "L’Infirmerie pleine", description: "Le DS dont l’équipe a compté le plus de coureurs blessés distincts." },
    en: { title: "A full infirmary", description: "The sporting director whose team had the most distinct injured riders." },
  },
  red_lantern_rider: {
    tone: "ruby",
    icon: "lantern",
    order: 180,
    fr: { title: "La Lanterne rouge", description: "Le coureur classé dernier le plus souvent sur les courses de la saison." },
    en: { title: "The Red Lantern", description: "The rider who finished last most often in the season’s races." },
  },
  red_lantern_director: {
    tone: "ruby",
    icon: "lanterns",
    order: 190,
    fr: { title: "Le Porte-lanternes", description: "Le DS dont les coureurs ont cumulé le plus de dernières places." },
    en: { title: "Lantern bearer", description: "The sporting director whose riders collected the most last-place finishes." },
  },
};

export function compareSeasonAwards(
  left: { key: SeasonAwardKey; gameYear: number },
  right: { key: SeasonAwardKey; gameYear: number },
): number {
  return (
    right.gameYear - left.gameYear ||
    SEASON_AWARD_PRESENTATION[left.key].order -
      SEASON_AWARD_PRESENTATION[right.key].order
  );
}
