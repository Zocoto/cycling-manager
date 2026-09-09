export const CYCLOGAZETTE_SEASON_QUIZ_REWARD_PER_ANSWER = 10_000;

export type CyclogazetteSeasonQuizOption = {
  id: string;
  label: string;
};

export type CyclogazetteSeasonQuizQuestion = {
  id: string;
  question: string;
  options: readonly CyclogazetteSeasonQuizOption[];
};

export const CYCLOGAZETTE_SEASON_TWO_QUIZ = {
  gameYear: 2,
  dayNumber: 28,
  questions: [
    {
      id: "q1",
      question:
        "Qui a remporté le Grand Tour français, la Boucle des Provinces ?",
      options: [
        { id: "a", label: "Mirko Golob" },
        { id: "b", label: "Gocha Vashadze" },
        { id: "c", label: "Mathieu Laurent" },
        { id: "d", label: "Ahmed Kiplagat" },
      ],
    },
    {
      id: "q2",
      question:
        "Dans quelle équipe évolue Mathieu Laurent, deuxième du classement UCI à l’aube de J28 ?",
      options: [
        { id: "a", label: "Abbaye du Lion" },
        { id: "b", label: "Dolci Bellini" },
        { id: "c", label: "Pura Cadencia Test Team" },
        { id: "d", label: "Team Ecuador" },
      ],
    },
    {
      id: "q3",
      question:
        "Chez qui court Roshan Bhandari, cinquième du classement UCI à l’aube de J28 ?",
      options: [
        { id: "a", label: "Komclub" },
        { id: "b", label: "Abbaye du Lion" },
        { id: "c", label: "Dolci Bellini" },
        { id: "d", label: "Teranga Océan" },
      ],
    },
    {
      id: "q4",
      question:
        "Quelle équipe compte le plus de coureurs dans le top 10 UCI à l’aube de J28 ?",
      options: [
        { id: "a", label: "Pura Cadencia Test Team" },
        { id: "b", label: "Abbaye du Lion" },
        { id: "c", label: "Dolci Bellini" },
        { id: "d", label: "Team Ecuador" },
      ],
    },
    {
      id: "q5",
      question:
        "Lequel de ces coureurs ne figure pas dans le top 10 UCI à l’aube de J28 ?",
      options: [
        { id: "a", label: "Amani Abebe" },
        { id: "b", label: "Hatem Dridi" },
        { id: "c", label: "Kubat Nazarbayev" },
        { id: "d", label: "Tiana António" },
      ],
    },
    {
      id: "q6",
      question:
        "Qui a remporté le championnat du monde du contre-la-montre ?",
      options: [
        { id: "a", label: "George Korir" },
        { id: "b", label: "Hatem Dridi" },
        { id: "c", label: "Omphile Afonso" },
        { id: "d", label: "Boaz Dijkstra" },
      ],
    },
    {
      id: "q7",
      question:
        "Quelle nation a remporté les deux titres mondiaux juniors, route et CLM ?",
      options: [
        { id: "a", label: "Belgique" },
        { id: "b", label: "France" },
        { id: "c", label: "Espagne" },
        { id: "d", label: "Italie" },
      ],
    },
    {
      id: "q8",
      question:
        "Avec quel sponsor Team Ecuador a-t-elle signé durant la saison 2 ?",
      options: [
        { id: "a", label: "Québec Nord Racing" },
        { id: "b", label: "Montecristi Toquilla House" },
        { id: "c", label: "Vereda Nova Automóveis" },
        { id: "d", label: "Kilimanjaro SkyLink" },
      ],
    },
    {
      id: "q9",
      question:
        "Dans quelle équipe Emanuel Sócrates a-t-il signé pendant la saison ?",
      options: [
        { id: "a", label: "Nassau Cycling Foundation" },
        { id: "b", label: "Europcar" },
        { id: "c", label: "Atlas Racing Lab" },
        { id: "d", label: "Komclub" },
      ],
    },
    {
      id: "q10",
      question:
        "Quelle équipe occupait la tête du classement UCI collectif à l’aube de J28 ?",
      options: [
        { id: "a", label: "Abbaye du Lion" },
        { id: "b", label: "Dolci Bellini" },
        { id: "c", label: "Pura Cadencia Test Team" },
        { id: "d", label: "Team Ecuador" },
      ],
    },
  ] satisfies readonly CyclogazetteSeasonQuizQuestion[],
} as const;

export function isCyclogazetteSeasonTwoGalaEdition({
  gameYear,
  dayNumber,
}: {
  gameYear: number;
  dayNumber: number;
}) {
  return (
    gameYear === CYCLOGAZETTE_SEASON_TWO_QUIZ.gameYear &&
    dayNumber === CYCLOGAZETTE_SEASON_TWO_QUIZ.dayNumber
  );
}
