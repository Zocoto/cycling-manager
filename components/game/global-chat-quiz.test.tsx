import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { GlobalChatQuizRound } from "@/lib/game/global-chat-quiz";
import { GlobalChatQuiz } from "./global-chat-quiz";

const roundId = "50d9d100-36a0-4314-8d74-9a962f0f4200";
const directorId = "e46d600a-2d22-4de4-a1f3-8d8093ab3487";
const riderId = "ec741924-2b58-4fd1-9579-026c967b6ddb";

it("keeps the prompt in chat and announces the winner with a real profile link", () => {
  const now = Date.now();
  const round: GlobalChatQuizRound = {
    id: roundId,
    status: "open",
    startsAt: new Date(now - 60_000).toISOString(),
    endsAt: new Date(now + 60_000).toISOString(),
    portraitPath: `${roundId}.webp`,
    answerName: "Le Nom",
    answerRiderId: riderId,
    winnerUsername: null,
    winnerSportingDirectorId: null,
  };
  const portraitUrl = `https://quiz.example/${round.portraitPath}`;
  const onReply = vi.fn();
  const open = renderToStaticMarkup(<GlobalChatQuiz round={round} portraitUrl={portraitUrl} onReply={onReply} />);
  expect(open).toContain("Top ! Je suis, je suis…");
  expect(open).toContain("Répondre");
  expect(open).not.toContain("<form");
  expect(open).not.toContain("Le Nom");
  expect(open).not.toContain(riderId);

  const result = renderToStaticMarkup(<GlobalChatQuiz round={{ ...round, status: "won", winnerUsername: "joueur", winnerSportingDirectorId: directorId }} portraitUrl={portraitUrl} onReply={onReply} />);
  expect(result).toContain("Oui ! Oui ! Oui !");
  expect(result).toContain(`href="/jeu/directeurs-sportifs/${directorId}"`);
  expect(result).toContain("@joueur");
  expect(result).toContain("Le Nom");
  expect(result).toContain(`href="/jeu/coureurs/${riderId}"`);
  expect(result).not.toContain("Répondre");
});
