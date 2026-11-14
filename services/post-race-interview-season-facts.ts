import "server-only";

import { getParisDateKey } from "@/lib/game/cyclogazette";
import type { PostRaceInterviewEditorialFacts } from "@/lib/game/post-race-interview-editorial";
import type { OfficialRiderResult } from "@/lib/game/race-results";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type RiderName = { first_name: string; last_name: string };

type Auction = {
  rider_id: string;
  seller_team_id: string | null;
  winning_team_id: string;
  settled_at: string;
};

type DirectTransfer = {
  rider_id: string;
  offered_rider_id: string | null;
  seller_team_id: string;
  buyer_team_id: string;
  responded_at: string;
};

type FreeAgentSigning = { rider_id: string; signed_at: string };

type ConfirmedMove = {
  riderId: string;
  fromTeamId: string | null;
  toTeamId: string;
  movedAt: string;
  isSale: boolean;
};

type RaceDate = { departure_at: string | null; season_day_id: string; stage_type: string };
type SeasonDay = { calendar_date: string; day_number: number };

const RECENT_TRANSFER_DAYS = 7;
const MILLISECONDS_PER_DAY = 86_400_000;

export async function loadPostRaceInterviewEditorialFacts(
  admin: AdminClient,
  {
    teamId,
    seasonId,
    stageId,
    stageResults,
    rivalryTeamId,
  }: {
    teamId: string;
    seasonId: string;
    stageId: string;
    stageResults: readonly OfficialRiderResult[];
    rivalryTeamId?: string | null;
  },
): Promise<PostRaceInterviewEditorialFacts> {
  const stageResult = await admin
    .from("stages")
    .select("departure_at, season_day_id, stage_type")
    .eq("id", stageId)
    .maybeSingle<RaceDate>();
  const stage = stageResult.data;
  if (stageResult.error || !stage) return {};

  const opponent = stage.stage_type === "team_time_trial"
    ? undefined
    : pickEditorialOpponent(stageResults, teamId, rivalryTeamId);
  if (!stage.departure_at) return { opponent };

  const cutoff = new Date(stage.departure_at);
  if (!Number.isFinite(cutoff.getTime())) return { opponent };

  const [moves, seasonLeader] = await Promise.allSettled([
    loadTransferFacts(admin, { seasonId, teamId, cutoff, seasonDayId: stage.season_day_id }),
    loadSeasonLeader(admin, { seasonId, teamId, cutoff, stageId }),
  ]);
  return {
    opponent,
    ...(moves.status === "fulfilled" ? moves.value : {}),
    ...(seasonLeader.status === "fulfilled" && seasonLeader.value
      ? { seasonLeader: seasonLeader.value }
      : {}),
  };
}

export function pickEditorialOpponent(
  results: readonly OfficialRiderResult[],
  teamId: string,
  rivalryTeamId?: string | null,
): PostRaceInterviewEditorialFacts["opponent"] {
  const ranked = results.filter(
    (result): result is OfficialRiderResult & { rank: number } =>
      result.status === "finished" && result.rank !== null && result.rank > 0,
  ).sort((first, second) => first.rank - second.rank);
  const own = ranked.find((result) => result.teamId === teamId);
  const opponents = ranked.filter((result) => result.teamId !== teamId);
  const rival = opponents.find((result) => result.teamId === rivalryTeamId);
  const directCompetitor = own && opponents.find((result) =>
    result.rank < own.rank && result.gapToWinnerMs !== null && result.gapToWinnerMs === own.gapToWinnerMs,
  );
  const opponent = rival ?? directCompetitor ?? opponents.find((result) => result.rank <= 3);
  if (!opponent) return undefined;

  const gapFromOwn = own && own.gapToWinnerMs !== null && opponent.gapToWinnerMs !== null
    ? (own.gapToWinnerMs - opponent.gapToWinnerMs) / 1000
    : null;
  return {
    teamId: opponent.teamId,
    teamName: opponent.teamName,
    riderName: opponent.riderName,
    rank: opponent.rank,
    ownRiderRank: own?.rank ?? null,
    gapToOwnSeconds: gapFromOwn,
    sameTimeAsOwn: gapFromOwn === 0,
    teammateFinishesInTopTen: ranked.filter((result) =>
      result.teamId === opponent.teamId && result.riderId !== opponent.riderId && result.rank <= 10,
    ).length,
  };
}

async function loadTransferFacts(
  admin: AdminClient,
  { teamId, seasonId, cutoff, seasonDayId }: {
    teamId: string;
    seasonId: string;
    cutoff: Date;
    seasonDayId: string;
  },
): Promise<Pick<PostRaceInterviewEditorialFacts, "recentArrival" | "recentDeparture">> {
  const cutoffIso = cutoff.toISOString();
  const windowStart = new Date(cutoff.getTime() - (RECENT_TRANSFER_DAYS + 1) * MILLISECONDS_PER_DAY);
  const [auctions, directTransfers, freeAgentSignings, stageDay] = await Promise.all([
    admin.from("transfer_market_listings")
      .select("rider_id, seller_team_id, winning_team_id, settled_at")
      .eq("season_id", seasonId)
      .eq("status", "settled")
      .or(`seller_team_id.eq.${teamId},winning_team_id.eq.${teamId}`)
      .gte("settled_at", windowStart.toISOString())
      .lt("settled_at", cutoffIso)
      .order("settled_at", { ascending: false })
      .order("id")
      .limit(20)
      .returns<Auction[]>(),
    admin.from("direct_transfer_offers")
      .select("rider_id, offered_rider_id, seller_team_id, buyer_team_id, responded_at")
      .eq("season_id", seasonId)
      .eq("status", "accepted")
      .is("effective_season_id", null)
      .or(`seller_team_id.eq.${teamId},buyer_team_id.eq.${teamId}`)
      .gte("responded_at", windowStart.toISOString())
      .lt("responded_at", cutoffIso)
      .order("responded_at", { ascending: false })
      .order("id")
      .limit(20)
      .returns<DirectTransfer[]>(),
    admin.from("rider_contracts")
      .select("rider_id, signed_at")
      .eq("team_id", teamId)
      .eq("start_season_id", seasonId)
      .eq("acquisition_type", "free_agent")
      .eq("status", "active")
      .gte("signed_at", windowStart.toISOString())
      .lt("signed_at", cutoffIso)
      .order("signed_at", { ascending: false })
      .order("id")
      .limit(1)
      .returns<FreeAgentSigning[]>(),
    admin.from("season_days")
      .select("calendar_date, day_number")
      .eq("id", seasonDayId)
      .eq("season_id", seasonId)
      .maybeSingle<SeasonDay>(),
  ]);
  if (stageDay.error || !stageDay.data) return {};
  const moves: ConfirmedMove[] = [
    ...(auctions.data ?? []).map((listing) => ({
      riderId: listing.rider_id,
      fromTeamId: listing.seller_team_id,
      toTeamId: listing.winning_team_id,
      movedAt: listing.settled_at,
      isSale: listing.seller_team_id !== null,
    })),
    ...(directTransfers.data ?? []).flatMap((offer) => {
      const incoming = {
        riderId: offer.rider_id,
        fromTeamId: offer.seller_team_id,
        toTeamId: offer.buyer_team_id,
        movedAt: offer.responded_at,
        isSale: offer.offered_rider_id === null,
      };
      return offer.offered_rider_id ? [incoming, {
        ...incoming,
        riderId: offer.offered_rider_id,
        fromTeamId: offer.buyer_team_id,
        toTeamId: offer.seller_team_id,
      }] : [incoming];
    }),
    ...(freeAgentSignings.data ?? []).map((contract) => ({
      riderId: contract.rider_id,
      fromTeamId: null,
      toTeamId: teamId,
      movedAt: contract.signed_at,
      isSale: false,
    })),
  ];
  const days = new Map<string, number>();
  const stageDate = Date.parse(stageDay.data.calendar_date);
  for (const move of moves) {
    const movedDate = Date.parse(getParisDateKey(move.movedAt));
    const difference = (stageDate - movedDate) / MILLISECONDS_PER_DAY;
    if (difference >= 0 && difference < RECENT_TRANSFER_DAYS) {
      const gameDay = stageDay.data.day_number - difference;
      if (gameDay > 0) days.set(move.movedAt, gameDay);
    }
  }
  const recent = moves.filter((move) => days.has(move.movedAt))
    .sort((first, second) => Date.parse(second.movedAt) - Date.parse(first.movedAt)
      || first.riderId.localeCompare(second.riderId));
  const arrival = recent.find((move) => move.toTeamId === teamId);
  const departure = recent.find((move) => move.fromTeamId === teamId);
  const selected = [arrival, departure].filter((move): move is ConfirmedMove => Boolean(move));
  if (selected.length === 0) return {};
  const neighborTeamIds = [...new Set([arrival?.fromTeamId, departure?.toTeamId]
    .filter((id): id is string => Boolean(id)))];
  const [riders, teams] = await Promise.all([
    admin.from("riders")
      .select("id, first_name, last_name")
      .in("id", [...new Set(selected.map((move) => move.riderId))])
      .returns<(RiderName & { id: string })[]>(),
    neighborTeamIds.length === 0 ? Promise.resolve({ data: [] }) : admin.from("team_seasons")
      .select("team_id, display_name")
      .eq("season_id", seasonId)
      .in("team_id", neighborTeamIds)
      .returns<{ team_id: string; display_name: string }[]>(),
  ]);
  const names = new Map(riders.data?.map((rider) => [rider.id, fullName(rider)]));
  const teamNames = new Map(teams.data?.map((team) => [team.team_id, team.display_name]));
  const fact = (
    move: ConfirmedMove | undefined,
  ): PostRaceInterviewEditorialFacts["recentArrival"] => {
    if (!move) return undefined;
    const riderName = names.get(move.riderId);
    const gameDay = days.get(move.movedAt);
    const otherTeamId = move.fromTeamId === teamId ? move.toTeamId : move.fromTeamId;
    return riderName && gameDay ? {
      riderName,
      gameDay,
      otherTeamName: otherTeamId ? teamNames.get(otherTeamId) ?? null : null,
      isSale: move.isSale,
    } : undefined;
  };
  return { recentArrival: fact(arrival), recentDeparture: fact(departure) };
}

async function loadSeasonLeader(
  admin: AdminClient,
  { teamId, seasonId, cutoff, stageId }: {
    teamId: string;
    seasonId: string;
    cutoff: Date;
    stageId: string;
  },
): Promise<PostRaceInterviewEditorialFacts["seasonLeader"]> {
  const cutoffIso = cutoff.toISOString();
  const [contract, teamSeason] = await Promise.all([
    admin.from("rider_contracts")
      .select("rider_id, rider:riders!rider_contracts_rider_id_fkey(first_name, last_name)")
      .eq("team_id", teamId)
      .eq("status", "active")
      .eq("squad_status", "absolute_leader")
      .lte("signed_at", cutoffIso)
      .limit(2)
      .returns<{ rider_id: string; rider: RiderName | null }[]>(),
    admin.from("team_seasons")
      .select("id")
      .eq("season_id", seasonId)
      .eq("team_id", teamId)
      .maybeSingle<{ id: string }>(),
  ]);
  const leader = contract.data?.length === 1 ? contract.data[0] : undefined;
  if (!leader?.rider || !teamSeason.data) return undefined;
  const history = await admin.from("stage_results")
    .select(`rank, status,
      stage:stages!inner(season_day_id),
      roster:race_rosters!inner(rider_id, registration:race_registrations!inner(team_season_id))`)
    .eq("roster.rider_id", leader.rider_id)
    .eq("roster.registration.team_season_id", teamSeason.data.id)
    .eq("stage.status", "completed")
    .lt("stage.departure_at", cutoffIso)
    .lt("created_at", cutoffIso)
    .neq("stage_id", stageId)
    .neq("stage.stage_type", "team_time_trial")
    .in("status", ["finished", "did_not_finish", "disqualified", "outside_time_limit"])
    .limit(101)
    .returns<{ rank: number | null; status: string; stage: { season_day_id: string } }[]>();
  if (!history.data || history.error || history.data.length > 100) return undefined;
  const daysRaced = new Set(history.data.map((result) => result.stage.season_day_id)).size;
  const finishes = history.data.flatMap((result) =>
    result.status === "finished" && result.rank !== null ? [result.rank] : [],
  );
  return {
    riderId: leader.rider_id,
    riderName: fullName(leader.rider),
    daysRaced,
    wins: finishes.filter((rank) => rank === 1).length,
    topTenFinishes: finishes.filter((rank) => rank <= 10).length,
  };
}

function fullName(rider: RiderName): string {
  return `${rider.first_name} ${rider.last_name}`.trim();
}
