import type { CyclogazetteAnswerReactionSummary } from "./cyclogazette-interview-reactions";

export type CyclogazetteArticleReactionTarget =
  | { kind: "media"; id: string }
  | { kind: "edition"; id: string; editionId: string };

export type CyclogazetteArticleReactionStates = {
  canReact: boolean;
  articles: Record<string, CyclogazetteAnswerReactionSummary[]>;
  blockedArticleKeys?: string[];
};

export function cyclogazetteArticleReactionKey(target: CyclogazetteArticleReactionTarget) {
  return target.kind === "media"
    ? `media:${target.id}`
    : `edition:${target.editionId}:${target.id}`;
}
