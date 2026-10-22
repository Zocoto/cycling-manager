import type { CyclogazettePollOverview } from "@/services/cyclogazette-games";

// Browser-safe helper: no word banks or private solutions in this module graph.
export function applyCyclogazettePollVote(poll: CyclogazettePollOverview, optionId: string): CyclogazettePollOverview {
  if (poll.viewerOptionId || !poll.options.some(option => option.id === optionId)) return poll;
  return {
    ...poll,
    options: poll.options.map(option => ({ ...option, votes: option.votes + (option.id === optionId ? 1 : 0) })),
    totalVotes: poll.totalVotes + 1,
    viewerOptionId: optionId,
  };
}
