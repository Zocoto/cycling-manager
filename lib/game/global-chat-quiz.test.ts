import { describe, expect, it } from "vitest";
import { mergeGlobalChatQuizRound, readGlobalChatQuizRound } from "./global-chat-quiz";

const roundId = "50d9d100-36a0-4314-8d74-9a962f0f4200";
const directorId = "e46d600a-2d22-4de4-a1f3-8d8093ab3487";
const riderId = "ec741924-2b58-4fd1-9579-026c967b6ddb";
const round = {
  id: roundId,
  status: "open",
  startsAt: "2026-11-08T20:00:00Z",
  endsAt: "2026-11-08T20:05:00Z",
  portraitPath: `${roundId}.webp`,
};

describe("global chat quiz projections", () => {
  it("uses the opaque portrait path and hides any answer and winner fields while open", () => {
    expect(readGlobalChatQuizRound({ ...round, answerName: "Le Nom", answerRiderId: riderId, winnerUsername: "joueur", winnerSportingDirectorId: directorId })).toMatchObject({
      portraitPath: `${roundId}.webp`,
      answerName: null,
      answerRiderId: null,
      winnerUsername: null,
      winnerSportingDirectorId: null,
    });
    expect(readGlobalChatQuizRound({ ...round, portraitPath: "Le-Nom.webp" })).toBeNull();
  });

  it("reads the real winner mention and will not reopen a round after a delayed read", () => {
    const open = readGlobalChatQuizRound(round)!;
    const won = readGlobalChatQuizRound({
      id: roundId,
      starts_at: round.startsAt,
      ends_at: round.endsAt,
      portrait_path: round.portraitPath,
      status: "won",
      answer_name: "Le Nom",
      answer_rider_id: riderId,
      winner_username: "joueur",
      winner_sporting_director_id: directorId,
    });
    expect(won).toMatchObject({ status: "won", answerName: "Le Nom", answerRiderId: riderId, winnerUsername: "joueur", winnerSportingDirectorId: directorId });
    expect(mergeGlobalChatQuizRound(won, open)).toBe(won);
    expect(mergeGlobalChatQuizRound(open, won!)).toBe(won);
  });
});
