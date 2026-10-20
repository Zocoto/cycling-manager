import { ALBUM_DEMO_COLLECTORS, getLooseAlbumCardCount, type AlbumPilotState, type CollectorCard } from "./collector-album";

export type AlbumTradeMatch = { partnerId: string; receive: number; give: number; reciprocal: boolean };

/** Only surplus copies: never suggest giving away the last copy of a vignette. */
export function getAlbumDuplicateCards(state: AlbumPilotState): number[] {
  const counts = new Map<number, number>();
  for (const number of state.owned) counts.set(number, (counts.get(number) ?? 0) + 1);
  return [...counts].filter(([number, count]) => {
    const reserved = state.pending?.give.filter(id => id === number).length ?? 0;
    return count - reserved > 1 && getLooseAlbumCardCount(state, number) > 0;
  }).map(([number]) => number).sort((a, b) => a - b);
}

/** Bounded local discovery for the three explicitly fictional pilot collectors. */
export function getAlbumTradeMatches(state: AlbumPilotState, cards: readonly Pick<CollectorCard, "number">[], wanted: readonly number[] = []): AlbumTradeMatch[] {
  if (state.pending) return [];
  const owned = new Set(state.owned);
  const known = new Set(cards.map(card => card.number));
  const priorities = new Set(wanted.filter(number => known.has(number) && !owned.has(number)));
  const duplicates = getAlbumDuplicateCards(state).filter(number => known.has(number));
  if (!duplicates.length) return [];
  const matches: AlbumTradeMatch[] = [];
  for (const partner of ALBUM_DEMO_COLLECTORS) {
    const stock = new Set(state.partners[partner.id] ?? []);
    const give = duplicates.find(number => !stock.has(number)) ?? duplicates[0];
    for (const receive of stock) {
      if (known.has(receive) && !owned.has(receive)) matches.push({ partnerId: partner.id, receive, give, reciprocal: !stock.has(give) });
    }
  }
  return matches.sort((a, b) => Number(priorities.has(b.receive)) - Number(priorities.has(a.receive)) || Number(b.reciprocal) - Number(a.reciprocal) || a.receive - b.receive || a.partnerId.localeCompare(b.partnerId));
}
