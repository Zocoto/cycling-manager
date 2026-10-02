import "server-only";

import { strToU8, zipSync } from "fflate";

import {
  createPcmStartlistXml,
  PCM_SPECTATOR_RIDER_IDS,
  PCM_SPECTATOR_TEAM_ID,
  type PcmStartlistTeam,
} from "@/lib/game/pcm-gala-startlists";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ActiveSeason = { id: string; game_year: number };
type GalaEvent = {
  id: string;
  event_key: string;
  display_name: string;
  pcm_stage_filename: string;
  roster_size: number;
  sort_order: number;
};
type Registration = { id: string; gala_event_id: string; team_id: string };
type RegistrationRider = { registration_id: string; rider_id: string; position: number };
type Team = { id: string; pcm_export_id: number };
type TeamSeason = { team_id: string; display_name: string };
type Rider = { id: string; pcm_export_id: number; first_name: string; last_name: string };

export type PcmGalaStartlistExportResult = {
  archive: Uint8Array;
  filename: string;
  generatedAt: string;
  season: number;
  eventCount: number;
  registeredTeamCount: number;
  registeredRiderCount: number;
};

export async function generatePcmGalaStartlistExport(): Promise<PcmGalaStartlistExportResult> {
  const admin = createSupabaseAdminClient();
  const seasonResult = await admin
    .from("seasons")
    .select("id,game_year")
    .eq("status", "active")
    .order("game_year", { ascending: false })
    .limit(1)
    .single<ActiveSeason>();

  if (seasonResult.error || !seasonResult.data) {
    throw new Error(`Saison active introuvable : ${seasonResult.error?.message ?? "aucune donnée"}`);
  }
  const season = seasonResult.data;

  const [eventsResult, registrationsResult, teamSeasonsResult] = await Promise.all([
    admin
      .from("pcm_gala_events")
      .select("id,event_key,display_name,pcm_stage_filename,roster_size,sort_order")
      .eq("season_id", season.id)
      .order("sort_order", { ascending: true })
      .returns<GalaEvent[]>(),
    admin
      .from("pcm_gala_registrations")
      .select("id,gala_event_id,team_id")
      .eq("season_id", season.id)
      .returns<Registration[]>(),
    admin
      .from("team_seasons")
      .select("team_id,display_name")
      .eq("season_id", season.id)
      .eq("status", "active")
      .returns<TeamSeason[]>(),
  ]);

  assertQuery(eventsResult, "courses gala");
  assertQuery(registrationsResult, "inscriptions gala");
  assertQuery(teamSeasonsResult, "équipes de la saison");

  const events = eventsResult.data ?? [];
  const registrations = registrationsResult.data ?? [];
  if (events.length === 0) throw new Error("Aucune course gala n’est configurée.");

  const registrationIds = registrations.map((row) => row.id);
  const teamIds = [...new Set(registrations.map((row) => row.team_id))];
  const [registrationRidersResult, teamsResult] = await Promise.all([
    registrationIds.length > 0
      ? admin
          .from("pcm_gala_registration_riders")
          .select("registration_id,rider_id,position")
          .in("registration_id", registrationIds)
          .order("position", { ascending: true })
          .returns<RegistrationRider[]>()
      : Promise.resolve({ data: [] as RegistrationRider[], error: null }),
    teamIds.length > 0
      ? admin
          .from("teams")
          .select("id,pcm_export_id")
          .in("id", teamIds)
          .returns<Team[]>()
      : Promise.resolve({ data: [] as Team[], error: null }),
  ]);

  assertQuery(registrationRidersResult, "coureurs inscrits");
  assertQuery(teamsResult, "identifiants PCM des équipes");
  const registrationRiders = registrationRidersResult.data ?? [];
  const riderIds = [...new Set(registrationRiders.map((row) => row.rider_id))];
  const ridersResult = riderIds.length > 0
    ? await admin
        .from("riders")
        .select("id,pcm_export_id,first_name,last_name")
        .in("id", riderIds)
        .returns<Rider[]>()
    : { data: [] as Rider[], error: null };
  assertQuery(ridersResult, "identifiants PCM des coureurs");

  const teamsById = new Map((teamsResult.data ?? []).map((row) => [row.id, row]));
  const teamNamesById = new Map((teamSeasonsResult.data ?? []).map((row) => [row.team_id, row.display_name]));
  const ridersById = new Map((ridersResult.data ?? []).map((row) => [row.id, row]));
  const registrationRidersByRegistration = new Map<string, RegistrationRider[]>();
  for (const row of registrationRiders) {
    const list = registrationRidersByRegistration.get(row.registration_id) ?? [];
    list.push(row);
    registrationRidersByRegistration.set(row.registration_id, list);
  }

  const generatedAt = new Date().toISOString();
  const files: Record<string, Uint8Array> = {};
  const manifestEvents: Array<Record<string, unknown>> = [];

  for (const event of events) {
    const eventRegistrations = registrations
      .filter((row) => row.gala_event_id === event.id)
      .sort((left, right) =>
        (teamNamesById.get(left.team_id) ?? left.team_id).localeCompare(
          teamNamesById.get(right.team_id) ?? right.team_id,
          "fr",
        ),
      );
    const startlistTeams: PcmStartlistTeam[] = [
      {
        teamId: PCM_SPECTATOR_TEAM_ID,
        riderIds: [...PCM_SPECTATOR_RIDER_IDS],
      },
    ];
    const manifestTeams: Array<Record<string, unknown>> = [];

    for (const registration of eventRegistrations) {
      const team = teamsById.get(registration.team_id);
      if (!team || !Number.isInteger(Number(team.pcm_export_id))) {
        throw new Error(`Identifiant PCM absent pour l’équipe ${registration.team_id}.`);
      }
      const selected = [...(registrationRidersByRegistration.get(registration.id) ?? [])]
        .sort((left, right) => left.position - right.position);
      if (selected.length !== event.roster_size) {
        throw new Error(`Sélection incomplète pour ${teamNamesById.get(registration.team_id) ?? registration.team_id}.`);
      }
      const pcmRiderIds = selected.map((selection) => {
        const rider = ridersById.get(selection.rider_id);
        if (!rider || !Number.isInteger(Number(rider.pcm_export_id))) {
          throw new Error(`Identifiant PCM absent pour le coureur ${selection.rider_id}.`);
        }
        return Number(rider.pcm_export_id);
      });
      startlistTeams.push({ teamId: Number(team.pcm_export_id), riderIds: pcmRiderIds });
      manifestTeams.push({
        team: teamNamesById.get(registration.team_id) ?? registration.team_id,
        pcmTeamId: Number(team.pcm_export_id),
        riders: selected.map((selection, index) => {
          const rider = ridersById.get(selection.rider_id)!;
          return {
            position: index + 1,
            name: `${rider.first_name} ${rider.last_name}`,
            pcmRiderId: Number(rider.pcm_export_id),
          };
        }),
      });
    }

    const xmlFilename = `${event.pcm_stage_filename}.xml`;
    files[xmlFilename] = strToU8(createPcmStartlistXml(startlistTeams));
    manifestEvents.push({
      eventKey: event.event_key,
      eventName: event.display_name,
      file: xmlFilename,
      registeredTeams: eventRegistrations.length,
      spectatorTeamIncluded: true,
      teams: manifestTeams,
    });
  }

  files["manifest.json"] = strToU8(`${JSON.stringify({
    formatVersion: 1,
    targetGame: "Pro Cycling Manager 2026",
    generatedAt,
    season: season.game_year,
    events: manifestEvents,
  }, null, 2)}\n`);
  files["LISEZ-MOI.txt"] = strToU8(createReadme());

  return {
    archive: zipSync(files, { level: 6 }),
    filename: `Cyclostratege-Startlists-PCM26-S${season.game_year}.zip`,
    generatedAt,
    season: season.game_year,
    eventCount: events.length,
    registeredTeamCount: registrations.length,
    registeredRiderCount: registrationRiders.length,
  };
}

function assertQuery<T>(
  result: { data: T[] | null; error: { message: string } | null },
  label: string,
): asserts result is { data: T[]; error: null } {
  if (result.error) throw new Error(`Impossible de charger ${label} : ${result.error.message}`);
}

function createReadme() {
  return `INSTALLATION DES STARTLISTS CYCLOSTRATEGE DANS PCM26

1. Utilisez une base Cyclostratège générée après la mise en place des identifiants PCM permanents.
2. Fermez Pro Cycling Manager 2026.
3. Décompressez cette archive.
4. Copiez les fichiers XML directement dans :
   %APPDATA%\\Pro Cycling Manager 2026\\Cloud\\Startlists\\
5. Relancez PCM26, chargez le mod Cyclostratège et choisissez la course correspondante.
6. Activez le chargement de la liste de départ personnalisée.

L'équipe Cyclostratège et sept coureurs Simulo sont ajoutés automatiquement à
chaque fichier afin de pouvoir suivre la course en mode spectateur.
Le fichier manifest.json sert uniquement au contrôle humain ; PCM ne le lit pas.
`;
}

