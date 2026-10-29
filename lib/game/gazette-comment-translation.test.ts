import { describe, expect, it } from "vitest";
import type { CyclogazetteContent, CyclogazetteReaction } from "./cyclogazette";
import { gazetteExcerptCommentKey, getGazetteCommentSources } from "./gazette-comment-translation";
import { detectGazetteCommentLanguage } from "@/services/gazette-comment-languages";

const reaction = {
  interviewId: "interview", question: "Une question française", answer: "We gave everything today.",
  excerptQuestionId: "q1", closingNote: "Merci à toute notre équipe.",
  answers: [{ questionId: "q1", question: "Une question française", answer: "We gave everything today." }],
} as CyclogazetteReaction;

describe("Gazette quotation sources", () => {
  it("deduplicates the excerpt with its full answer and includes only human quotation fields", () => {
    const content = { reactions: [reaction, { ...reaction, interviewId: "editorial", isEditorial: true }],
      preRacePressConferences: [{ conferenceId: "press", publicStatement: "Nous allons attaquer !" }] } as CyclogazetteContent;
    expect(getGazetteCommentSources(content)).toEqual([
      { messageId: "pre:press", sourceMessage: "Nous allons attaquer !", sourceEditedAt: null },
      { messageId: "post:interview:answer:q1", sourceMessage: reaction.answer, sourceEditedAt: null },
      { messageId: "post:interview:closing", sourceMessage: reaction.closingNote, sourceEditedAt: null },
    ]);
    expect(gazetteExcerptCommentKey({ ...reaction, answer: "A different published excerpt" })).toBe("post:interview:excerpt");
  });
  it("never sends empty, image-only or oversized values", () => {
    expect(getGazetteCommentSources({ reactions: [], preRacePressConferences: [
      { conferenceId: "empty", publicStatement: "  " },
      { conferenceId: "emoji", publicStatement: "🚴‍♂️🎉" },
      { conferenceId: "long", publicStatement: "x".repeat(601) },
    ] } as CyclogazetteContent)).toEqual([]);
  });
});

describe("local quotation language detection", () => {
  it.each([
    ["Nous allons attaquer dans la dernière ascension pour aider notre leader.", "fr"],
    ["Bravo à toute l’équipe, nous avons donné le meilleur de nous-mêmes !", "fr"],
    ["We will attack on the final climb to support our leader.", "en"],
    ["Congratulations to the whole team, we gave everything today!", "en"],
    ["Bonjour !", "fr"], ["Hello!", "en"], ["Merci à tous", "fr"], ["Well done!", "en"], ["Bravo !", "und"],
  ])("recognizes %s without a provider request", (text, language) => {
    expect(detectGazetteCommentLanguage(text)).toBe(language);
  });
});
