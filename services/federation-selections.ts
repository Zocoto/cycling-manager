import "server-only";

import type { FederationHostingEventType } from "@/lib/game/federation-hosting";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type FederationStoredSelection = {
  status: "draft" | "pending_confirmation" | "finalized";
  revision: number;
  riderIds: string[];
};

export type FederationPendingConfirmation = {
  memberId: string;
  slotKey: string;
  riderId: string;
};

export type FederationSelectionState = {
  canManage: boolean;
  automaticSelection: boolean;
  competitionHosts: Partial<
    Record<FederationHostingEventType, { countryCode: string; countryName: string }>
  >;
  selections: Record<string, FederationStoredSelection>;
  pendingConfirmations: FederationPendingConfirmation[];
};

type ListRow = {
  id: string;
  slot_key: string;
  status: FederationStoredSelection["status"];
  revision: number;
};
type MemberRow = {
  id: string;
  selection_list_id: string;
  professional_rider_id: string | null;
  junior_rider_id: string | null;
  owner_team_id: string | null;
  response_status: "draft" | "pending" | "confirmed" | "declined";
};
type AssignmentRow = { sporting_director_id: string };
type TermRow = { president_director_id: string | null };
type PreferenceRow = { automatic_selection: boolean };
type HostingAwardRow = {
  event_type: FederationHostingEventType;
  country_id: string;
};
type HostCountryRow = { id: string; iso_alpha2: string; name: string };

export async function getFederationSelectionState({
  countryId,
  seasonId,
  gameYear,
  viewerTeamId,
}: {
  countryId: string;
  seasonId: string;
  gameYear: number;
  viewerTeamId: string | null;
}): Promise<FederationSelectionState> {
  const empty: FederationSelectionState = {
    canManage: false,
    automaticSelection: true,
    competitionHosts: {},
    selections: {},
    pendingConfirmations: [],
  };

  try {
    const admin = createSupabaseAdminClient();
    const [listsResult, assignmentResult, termResult, preferenceResult, hostsResult] = await Promise.all([
      admin
        .from("national_federation_selection_lists")
        .select("id, slot_key, status, revision")
        .eq("country_id", countryId)
        .eq("season_id", seasonId)
        .returns<ListRow[]>(),
      viewerTeamId
        ? admin
            .from("team_manager_assignments")
            .select("sporting_director_id")
            .eq("team_id", viewerTeamId)
            .eq("role", "general_manager")
            .eq("status", "active")
            .maybeSingle<AssignmentRow>()
        : Promise.resolve({ data: null, error: null }),
      admin
        .from("national_federation_terms")
        .select("president_director_id")
        .eq("country_id", countryId)
        .lte("start_game_year", gameYear)
        .gte("end_game_year", gameYear)
        .maybeSingle<TermRow>(),
      admin
        .from("national_federation_selection_preferences")
        .select("automatic_selection")
        .eq("country_id", countryId)
        .eq("season_id", seasonId)
        .maybeSingle<PreferenceRow>(),
      admin
        .from("national_federation_hosting_awards")
        .select("event_type, country_id")
        .eq("target_game_year", gameYear)
        .in("status", ["scheduled", "settled"])
        .returns<HostingAwardRow[]>(),
    ]);

    if (listsResult.error) throw listsResult.error;
    if (assignmentResult.error) throw assignmentResult.error;
    if (termResult.error) throw termResult.error;
    if (preferenceResult.error) throw preferenceResult.error;
    if (hostsResult.error) throw hostsResult.error;

    const lists = listsResult.data ?? [];
    const listIds = lists.map((list) => list.id);
    const hostCountryIds = [
      ...new Set((hostsResult.data ?? []).map((host) => host.country_id)),
    ];
    const [membersResult, hostCountriesResult] = await Promise.all([
      listIds.length
        ? admin
            .from("national_federation_selection_members")
            .select(
              "id, selection_list_id, professional_rider_id, junior_rider_id, owner_team_id, response_status",
            )
            .in("selection_list_id", listIds)
            .returns<MemberRow[]>()
        : Promise.resolve({ data: [] as MemberRow[], error: null }),
      hostCountryIds.length
        ? admin
            .from("countries")
            .select("id, iso_alpha2, name")
            .in("id", hostCountryIds)
            .returns<HostCountryRow[]>()
        : Promise.resolve({ data: [] as HostCountryRow[], error: null }),
    ]);
    if (membersResult.error) throw membersResult.error;
    if (hostCountriesResult.error) throw hostCountriesResult.error;

    const members = membersResult.data ?? [];
    const listById = new Map(lists.map((list) => [list.id, list]));
    const selections = Object.fromEntries(
      lists.map((list) => [
        list.slot_key,
        {
          status: list.status,
          revision: list.revision,
          riderIds: members
            .filter((member) => member.selection_list_id === list.id)
            .map(
              (member) =>
                member.professional_rider_id ?? member.junior_rider_id,
            )
            .filter((riderId): riderId is string => Boolean(riderId)),
        },
      ]),
    );
    const countryById = new Map(
      (hostCountriesResult.data ?? []).map((country) => [country.id, country]),
    );
    const competitionHosts = Object.fromEntries(
      (hostsResult.data ?? []).flatMap((host) => {
        const country = countryById.get(host.country_id);
        return country
          ? [
              [
                host.event_type,
                { countryCode: country.iso_alpha2, countryName: country.name },
              ],
            ]
          : [];
      }),
    ) as FederationSelectionState["competitionHosts"];

    return {
      canManage:
        gameYear >= 3 &&
        Boolean(assignmentResult.data?.sporting_director_id) &&
        assignmentResult.data?.sporting_director_id ===
          termResult.data?.president_director_id,
      automaticSelection:
        preferenceResult.data?.automatic_selection ?? true,
      competitionHosts,
      selections,
      pendingConfirmations: viewerTeamId
        ? members.flatMap((member): FederationPendingConfirmation[] => {
            const list = listById.get(member.selection_list_id);
            const riderId =
              member.professional_rider_id ?? member.junior_rider_id;
            if (
              !list ||
              !riderId ||
              member.owner_team_id !== viewerTeamId ||
              member.response_status !== "pending"
            ) {
              return [];
            }
            return [{ memberId: member.id, slotKey: list.slot_key, riderId }];
          })
        : [],
    };
  } catch (error) {
    console.error("Impossible de charger les présélections fédérales :", error);
    return empty;
  }
}
