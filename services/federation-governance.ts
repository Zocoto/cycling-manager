import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type FederationElectionPhase =
  | "scheduled"
  | "applications"
  | "voting"
  | "finalized"
  | "automatic";

export type FederationElectionCandidate = {
  id: string;
  directorName: string;
  teamName: string;
  manifesto: string;
  isViewer: boolean;
  voteCount: number | null;
};

export type FederationJournalEntry = {
  id: string;
  dayNumber: number | null;
  category: string;
  title: string;
  detail: string;
  createdAt: string;
};

export type FederationGovernanceOverview = {
  phase: FederationElectionPhase;
  termStartGameYear: number;
  termEndGameYear: number;
  eligibleTeamCount: number;
  voteCount: number;
  viewerIsEligible: boolean;
  viewerCandidateId: string | null;
  viewerVotedCandidateId: string | null;
  canApply: boolean;
  canVote: boolean;
  presidentName: string | null;
  candidates: FederationElectionCandidate[];
  journal: FederationJournalEntry[];
};

type ElectionRow = {
  id: string;
  status: FederationElectionPhase;
  term_start_game_year: number;
  term_end_game_year: number;
  elected_director_id: string | null;
};
type ElectorateRow = {
  team_id: string;
  sporting_director_id: string;
};
type CandidateRow = {
  id: string;
  sporting_director_id: string;
  team_id: string;
  manifesto: string;
  created_at: string;
  withdrawn_at: string | null;
};
type VoteRow = {
  candidate_id: string;
  team_id: string;
  sporting_director_id: string;
};
type DirectorRow = { id: string; display_name: string };
type TeamSeasonRow = { team_id: string; display_name: string };
type TermRow = {
  governance_mode: "automatic" | "elected";
  president_director_id: string | null;
};
type JournalRow = {
  id: string;
  day_number: number | null;
  category: string;
  title: string;
  detail: string;
  created_at: string;
};

export async function getFederationGovernanceOverview({
  countryId,
  season,
  viewerTeamId,
}: {
  countryId: string;
  season: {
    id: string;
    gameYear: number;
    currentDayNumber: number;
  };
  viewerTeamId: string | null;
}): Promise<FederationGovernanceOverview> {
  const scheduled = createScheduledOverview(season.gameYear);

  try {
    const admin = createSupabaseAdminClient();
    const settlementResult = await admin.rpc("settle_due_federation_elections");
    if (settlementResult.error) throw settlementResult.error;
    const targetTermStart =
      season.gameYear % 2 === 0 ? season.gameYear + 1 : season.gameYear;
    const [electionResult, termResult, journalResult] = await Promise.all([
      admin
        .from("national_federation_elections")
        .select(
          "id, status, term_start_game_year, term_end_game_year, elected_director_id",
        )
        .eq("country_id", countryId)
        .eq("term_start_game_year", targetTermStart)
        .maybeSingle<ElectionRow>(),
      admin
        .from("national_federation_terms")
        .select("governance_mode, president_director_id")
        .eq("country_id", countryId)
        .lte("start_game_year", season.gameYear)
        .gte("end_game_year", season.gameYear)
        .maybeSingle<TermRow>(),
      admin
        .from("national_federation_journal_entries")
        .select("id, day_number, category, title, detail, created_at")
        .eq("country_id", countryId)
        .order("created_at", { ascending: false })
        .limit(20)
        .returns<JournalRow[]>(),
    ]);

    if (electionResult.error) throw electionResult.error;
    if (termResult.error) throw termResult.error;
    if (journalResult.error) throw journalResult.error;

    const election = electionResult.data;
    const journal = (journalResult.data ?? []).map(toJournalEntry);
    const presidentDirectorId =
      termResult.data?.president_director_id ??
      election?.elected_director_id ??
      null;
    const presidentResult = presidentDirectorId
      ? await admin
          .from("sporting_directors")
          .select("id, display_name")
          .eq("id", presidentDirectorId)
          .maybeSingle<DirectorRow>()
      : { data: null, error: null };

    if (presidentResult.error) throw presidentResult.error;
    if (!election) {
      return {
        ...scheduled,
        presidentName: presidentResult.data?.display_name ?? null,
        journal,
      };
    }

    const [electorateResult, candidatesResult, votesResult] = await Promise.all([
      admin
        .from("national_federation_electorate")
        .select("team_id, sporting_director_id")
        .eq("election_id", election.id)
        .returns<ElectorateRow[]>(),
      admin
        .from("national_federation_candidates")
        .select(
          "id, sporting_director_id, team_id, manifesto, created_at, withdrawn_at",
        )
        .eq("election_id", election.id)
        .is("withdrawn_at", null)
        .order("created_at", { ascending: true })
        .returns<CandidateRow[]>(),
      admin
        .from("national_federation_votes")
        .select("candidate_id, team_id, sporting_director_id")
        .eq("election_id", election.id)
        .returns<VoteRow[]>(),
    ]);

    if (electorateResult.error) throw electorateResult.error;
    if (candidatesResult.error) throw candidatesResult.error;
    if (votesResult.error) throw votesResult.error;

    const electorate = electorateResult.data ?? [];
    const candidateRows = candidatesResult.data ?? [];
    const votes = votesResult.data ?? [];
    const viewerElector = viewerTeamId
      ? electorate.find((entry) => entry.team_id === viewerTeamId) ?? null
      : null;
    const directorIds = [
      ...new Set(candidateRows.map((candidate) => candidate.sporting_director_id)),
    ];
    const teamIds = [
      ...new Set(candidateRows.map((candidate) => candidate.team_id)),
    ];
    const [directorsResult, teamsResult] = await Promise.all([
      directorIds.length > 0
        ? admin
            .from("sporting_directors")
            .select("id, display_name")
            .in("id", directorIds)
            .returns<DirectorRow[]>()
        : Promise.resolve({ data: [] as DirectorRow[], error: null }),
      teamIds.length > 0
        ? admin
            .from("team_seasons")
            .select("team_id, display_name")
            .eq("season_id", season.id)
            .in("team_id", teamIds)
            .returns<TeamSeasonRow[]>()
        : Promise.resolve({ data: [] as TeamSeasonRow[], error: null }),
    ]);

    if (directorsResult.error) throw directorsResult.error;
    if (teamsResult.error) throw teamsResult.error;
    const directorNameById = new Map(
      (directorsResult.data ?? []).map((director) => [
        director.id,
        director.display_name,
      ]),
    );
    const teamNameById = new Map(
      (teamsResult.data ?? []).map((team) => [team.team_id, team.display_name]),
    );
    const revealVotes =
      election.status === "finalized" || election.status === "automatic";
    const candidates = candidateRows.map(
      (candidate): FederationElectionCandidate => ({
        id: candidate.id,
        directorName:
          directorNameById.get(candidate.sporting_director_id) ??
          "Directeur sportif",
        teamName: teamNameById.get(candidate.team_id) ?? "Équipe affiliée",
        manifesto: candidate.manifesto,
        isViewer:
          candidate.sporting_director_id ===
          viewerElector?.sporting_director_id,
        voteCount: revealVotes
          ? votes.filter((vote) => vote.candidate_id === candidate.id).length
          : null,
      }),
    );

    return {
      phase: election.status,
      termStartGameYear: election.term_start_game_year,
      termEndGameYear: election.term_end_game_year,
      eligibleTeamCount: electorate.length,
      voteCount: votes.length,
      viewerIsEligible: Boolean(viewerElector),
      viewerCandidateId:
        candidates.find((candidate) => candidate.isViewer)?.id ?? null,
      viewerVotedCandidateId:
        votes.find((vote) => vote.team_id === viewerTeamId)?.candidate_id ?? null,
      canApply:
        election.status === "applications" && Boolean(viewerElector),
      canVote:
        election.status === "voting" &&
        Boolean(viewerElector) &&
        candidates.length > 0,
      presidentName: presidentResult.data?.display_name ?? null,
      candidates,
      journal,
    };
  } catch (error) {
    console.error("Impossible de charger la gouvernance fédérale :", error);
    return scheduled;
  }
}

function createScheduledOverview(gameYear: number): FederationGovernanceOverview {
  const termStartGameYear = gameYear % 2 === 0 ? gameYear + 1 : gameYear + 2;
  return {
    phase: "scheduled",
    termStartGameYear,
    termEndGameYear: termStartGameYear + 1,
    eligibleTeamCount: 0,
    voteCount: 0,
    viewerIsEligible: false,
    viewerCandidateId: null,
    viewerVotedCandidateId: null,
    canApply: false,
    canVote: false,
    presidentName: null,
    candidates: [],
    journal: [],
  };
}

function toJournalEntry(row: JournalRow): FederationJournalEntry {
  return {
    id: row.id,
    dayNumber: row.day_number,
    category: row.category,
    title: row.title,
    detail: row.detail,
    createdAt: row.created_at,
  };
}
