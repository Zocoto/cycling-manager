import type { CyclogazetteContent, CyclogazetteReaction } from "./cyclogazette";

export const GAZETTE_TRANSLATION_MAX_LENGTH = 600;
export type GazetteCommentSource = { messageId: string; sourceMessage: string; sourceEditedAt: null };
export type GazetteCommentLanguageHints = Record<string, string | null>;

export const gazettePressCommentKey = (id: string) => `pre:${id}`;
export const gazetteAnswerCommentKey = (id: string, questionId: string) => `post:${id}:answer:${questionId}`;
export const gazetteClosingCommentKey = (id: string) => `post:${id}:closing`;
export function gazetteExcerptCommentKey(reaction: CyclogazetteReaction) {
  const match = reaction.answers?.find((answer) => answer.answer === reaction.answer &&
    (reaction.excerptQuestionId ? answer.questionId === reaction.excerptQuestionId : answer.question === reaction.question));
  return match ? gazetteAnswerCommentKey(reaction.interviewId, match.questionId) : `post:${reaction.interviewId}:excerpt`;
}

/** Only published human quotations, never questions, author names or arbitrary client text. */
export function getGazetteCommentSources(content: Pick<CyclogazetteContent, "reactions" | "preRacePressConferences">): GazetteCommentSource[] {
  const sources = new Map<string, GazetteCommentSource>();
  const add = (messageId: string, text: unknown) => {
    if (typeof text === "string" && text.trim().length > 0 && text.length <= GAZETTE_TRANSLATION_MAX_LENGTH && /\p{L}/u.test(text)) {
      sources.set(messageId, { messageId, sourceMessage: text, sourceEditedAt: null });
    }
  };
  for (const conference of content.preRacePressConferences ?? []) {
    if (conference?.conferenceId) add(gazettePressCommentKey(conference.conferenceId), conference.publicStatement);
  }
  for (const reaction of content.reactions ?? []) {
    if (!reaction?.interviewId || reaction.isEditorial) continue;
    add(gazetteExcerptCommentKey(reaction), reaction.answer);
    for (const answer of reaction.answers ?? []) {
      if (answer?.questionId) add(gazetteAnswerCommentKey(reaction.interviewId, answer.questionId), answer.answer);
    }
    add(gazetteClosingCommentKey(reaction.interviewId), reaction.closingNote);
  }
  return [...sources.values()];
}
