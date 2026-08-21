export const CYCLOGAZETTE_INTERVIEW_REACTION_DEFINITIONS = [
  {
    emoji: "😂",
    labelFr: "Trait d’humour",
    labelEn: "Funny",
    sentiment: "positive",
  },
  { emoji: "👏", labelFr: "Bravo", labelEn: "Bravo", sentiment: "positive" },
  {
    emoji: "🔥",
    labelFr: "Réponse marquante",
    labelEn: "Striking answer",
    sentiment: "positive",
  },
  {
    emoji: "🤝",
    labelFr: "Fair-play",
    labelEn: "Fair play",
    sentiment: "positive",
  },
  {
    emoji: "❤️",
    labelFr: "J’adore",
    labelEn: "Love it",
    sentiment: "positive",
  },
  {
    emoji: "👎",
    labelFr: "Pas d’accord",
    labelEn: "Disagree",
    sentiment: "negative",
  },
  {
    emoji: "🙄",
    labelFr: "Pas convaincu",
    labelEn: "Not convinced",
    sentiment: "negative",
  },
  {
    emoji: "😡",
    labelFr: "Ça fâche",
    labelEn: "Angry",
    sentiment: "negative",
  },
  {
    emoji: "🤡",
    labelFr: "Mauvais perdant",
    labelEn: "Sore loser",
    sentiment: "negative",
  },
] as const;

export type CyclogazetteInterviewReactionEmoji =
  (typeof CYCLOGAZETTE_INTERVIEW_REACTION_DEFINITIONS)[number]["emoji"];

export type CyclogazetteAnswerReactionSummary = {
  emoji: CyclogazetteInterviewReactionEmoji;
  count: number;
  reactedByViewer: boolean;
};

export type CyclogazetteInterviewReactionState = {
  canReact: boolean;
  answers: Record<string, CyclogazetteAnswerReactionSummary[]>;
};

export type CyclogazetteInterviewReactionStates = Record<
  string,
  CyclogazetteInterviewReactionState
>;

export function isCyclogazetteInterviewReactionEmoji(
  value: unknown,
): value is CyclogazetteInterviewReactionEmoji {
  return CYCLOGAZETTE_INTERVIEW_REACTION_DEFINITIONS.some(
    (definition) => definition.emoji === value,
  );
}

export function applyCyclogazetteInterviewReactionState(
  summaries: readonly CyclogazetteAnswerReactionSummary[],
  emoji: CyclogazetteInterviewReactionEmoji,
  active: boolean,
  exactCount?: number,
) {
  const current = summaries.find((summary) => summary.emoji === emoji);
  const count = Math.max(
    0,
    Number.isSafeInteger(exactCount)
      ? Number(exactCount)
      : (current?.count ?? 0) + (active ? 1 : -1),
  );
  const next = summaries.filter((summary) => summary.emoji !== emoji);

  if (count > 0 || active) {
    next.push({ emoji, count, reactedByViewer: active });
  }

  return next.sort(
    (left, right) =>
      reactionOrder(left.emoji) - reactionOrder(right.emoji),
  );
}

function reactionOrder(emoji: CyclogazetteInterviewReactionEmoji) {
  return CYCLOGAZETTE_INTERVIEW_REACTION_DEFINITIONS.findIndex(
    (definition) => definition.emoji === emoji,
  );
}
