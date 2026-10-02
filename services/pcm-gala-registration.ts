import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PcmGalaRaceKey } from "@/lib/game/pcm-gala-races";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type PcmGalaRider = {
  riderId: string;
  firstName: string;
  lastName: string;
  countryCode: string;
  avatarProfileKey: string | null;
  avatarSeed: number | string | null;
  age: number;
  mountain: number;
  hills: number;
  flat: number;
  timeTrial: number;
  cobbles: number;
  sprint: number;
  acceleration: number;
  downhill: number;
  endurance: number;
  resistance: number;
  recovery: number;
  breakaway: number;
  prologue: number;
};

type RosterRow = {
  rider_id: string;
  first_name: string;
  last_name: string;
  country_iso_alpha2: string;
  avatar_profile_key: string | null;
  avatar_seed: number | string | null;
  age: number;
  mountain: number;
  hills: number;
  flat: number;
  time_trial: number;
  cobbles: number;
  sprint: number;
  acceleration: number;
  downhill: number;
  endurance: number;
  resistance: number;
  recovery: number;
  breakaway: number;
  prologue: number;
};

type GalaContextRow = {
  event_key: PcmGalaRaceKey;
  event_status: "open" | "closed" | "exported";
  roster_size: number;
  selected_event_key: PcmGalaRaceKey | null;
  selected_rider_ids: string[] | null;
};

type PublicStartlistRow = {
  event_key: PcmGalaRaceKey;
  team_id: string;
  team_name: string;
  team_short_name: string;
  team_country_code: string;
  rider_id: string;
  rider_first_name: string;
  rider_last_name: string;
  rider_country_code: string;
  rider_position: number;
  registered_at: string;
};

export type PcmGalaRegisteredTeam = {
  teamId: string;
  teamName: string;
  teamShortName: string;
  countryCode: string;
  registeredAt: string;
  riders: Array<{
    riderId: string;
    firstName: string;
    lastName: string;
    countryCode: string;
    position: number;
  }>;
};

export type PcmGalaRegistrationContext = {
  riders: PcmGalaRider[];
  eventStatuses: Partial<
    Record<PcmGalaRaceKey, "open" | "closed" | "exported">
  >;
  rosterSize: number;
  selectedEventKey: PcmGalaRaceKey | null;
  selectedRiderIds: string[];
  publicStartlists: Partial<Record<PcmGalaRaceKey, PcmGalaRegisteredTeam[]>>;
};

export async function getPcmGalaRegistrationContext(
  supabase: SupabaseServerClient,
): Promise<PcmGalaRegistrationContext> {
  const [rosterResult, contextResult, publicStartlistsResult] = await Promise.all([
    supabase.rpc("get_current_team_roster"),
    supabase.rpc("get_current_team_pcm_gala_context"),
    supabase.rpc("get_pcm_gala_public_startlists"),
  ]);

  if (rosterResult.error) {
    throw new Error(
      `Impossible de charger l’effectif gala : ${rosterResult.error.message}`,
    );
  }

  if (contextResult.error) {
    throw new Error(
      `Impossible de charger les inscriptions gala : ${contextResult.error.message}`,
    );
  }

  if (publicStartlistsResult.error) {
    throw new Error(
      `Impossible de charger les engagés gala : ${publicStartlistsResult.error.message}`,
    );
  }

  const rosterRows = (rosterResult.data ?? []) as RosterRow[];
  const contextRows = (contextResult.data ?? []) as GalaContextRow[];
  const publicStartlistRows = (publicStartlistsResult.data ?? []) as PublicStartlistRow[];
  const registration = contextRows.find((row) => row.selected_event_key);
  const eligibleRiderIds = new Set(rosterRows.map((row) => row.rider_id));

  return {
    riders: rosterRows.map((row) => ({
      riderId: row.rider_id,
      firstName: row.first_name,
      lastName: row.last_name,
      countryCode: row.country_iso_alpha2,
      avatarProfileKey: row.avatar_profile_key,
      avatarSeed: row.avatar_seed,
      age: row.age,
      mountain: row.mountain,
      hills: row.hills,
      flat: row.flat,
      timeTrial: row.time_trial,
      cobbles: row.cobbles,
      sprint: row.sprint,
      acceleration: row.acceleration,
      downhill: row.downhill,
      endurance: row.endurance,
      resistance: row.resistance,
      recovery: row.recovery,
      breakaway: row.breakaway,
      prologue: row.prologue,
    })),
    eventStatuses: Object.fromEntries(
      contextRows.map((row) => [row.event_key, row.event_status]),
    ),
    rosterSize: contextRows[0]?.roster_size ?? 7,
    selectedEventKey: registration?.selected_event_key ?? null,
    selectedRiderIds: (registration?.selected_rider_ids ?? []).filter((riderId) =>
      eligibleRiderIds.has(riderId),
    ),
    publicStartlists: groupPublicStartlists(publicStartlistRows),
  };
}

function groupPublicStartlists(rows: PublicStartlistRow[]) {
  const grouped: Partial<Record<PcmGalaRaceKey, PcmGalaRegisteredTeam[]>> = {};
  const teamsByEvent = new Map<string, PcmGalaRegisteredTeam>();

  for (const row of rows) {
    const lookupKey = `${row.event_key}:${row.team_id}`;
    let team = teamsByEvent.get(lookupKey);
    if (!team) {
      team = {
        teamId: row.team_id,
        teamName: row.team_name,
        teamShortName: row.team_short_name,
        countryCode: row.team_country_code,
        registeredAt: row.registered_at,
        riders: [],
      };
      teamsByEvent.set(lookupKey, team);
      (grouped[row.event_key] ??= []).push(team);
    }

    team.riders.push({
      riderId: row.rider_id,
      firstName: row.rider_first_name,
      lastName: row.rider_last_name,
      countryCode: row.rider_country_code,
      position: row.rider_position,
    });
  }

  return grouped;
}
