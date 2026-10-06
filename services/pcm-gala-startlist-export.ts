import "server-only";

import { strToU8, zipSync } from "fflate";
import type { PcmGalaRaceKey } from "@/lib/game/pcm-gala-races";
import { splitPcmGalaGroups } from "@/lib/game/pcm-gala-groups";
import { SEASON_FINALE_GALA_EVENT_KEY, SEASON_FINALE_GALA_MIN_RIDERS, SEASON_FINALE_GALA_MAX_RIDERS } from "@/lib/game/season-finale-gala";

import {
  createPcmStartlistXml,
  PCM_SPECTATOR_RIDER_IDS,
  PCM_SPECTATOR_TEAM_ID,
  type PcmStartlistTeam,
} from "@/lib/game/pcm-gala-startlists";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadSeasonFinaleGalaIdentities, loadSeasonFinaleGalaSourceSeason } from "@/services/season-finale-gala-identity";

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
  simulationCount: number;
  registeredTeamCount: number;
  registeredRiderCount: number;
};

export async function generatePcmGalaStartlistExport(eventKey?: PcmGalaRaceKey): Promise<PcmGalaStartlistExportResult> {
  const admin = createSupabaseAdminClient();
  const seasonResult = eventKey === SEASON_FINALE_GALA_EVENT_KEY
    ? { data: await loadSeasonFinaleGalaSourceSeason(admin), error: null }
    : await admin
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
    loadAllRows(admin
      .from("pcm_gala_events")
      .select("id,event_key,display_name,pcm_stage_filename,roster_size,sort_order")
      .eq("season_id", season.id)
      .order("sort_order", { ascending: true })
      .returns<GalaEvent[]>()),
    loadAllRows(admin
      .from("pcm_gala_registrations")
      .select("id,gala_event_id,team_id")
      .eq("season_id", season.id)
      .order("id")
      .returns<Registration[]>()),
    loadAllRows(admin
      .from("team_seasons")
      .select("team_id,display_name")
      .eq("season_id", season.id)
      .eq("status", "active")
      .order("team_id")
      .returns<TeamSeason[]>()),
  ]);

  assertQuery(eventsResult, "courses gala");
  assertQuery(registrationsResult, "inscriptions gala");
  assertQuery(teamSeasonsResult, "équipes de la saison");

  const events = (eventsResult.data ?? []).filter((event) => !eventKey || event.event_key === eventKey);
  const eventIds = new Set(events.map((event) => event.id));
  const registrations = (registrationsResult.data ?? []).filter((registration) => eventIds.has(registration.gala_event_id));
  if (events.length === 0) throw new Error("Aucune course gala n’est configurée.");

  const registrationIds = registrations.map((row) => row.id);
  const teamIds = [...new Set(registrations.map((row) => row.team_id))];
  const finaleTeamIds = [...new Set(registrations.filter((row) => events.some((event) =>
    event.id === row.gala_event_id && event.event_key === SEASON_FINALE_GALA_EVENT_KEY)).map((row) => row.team_id))];
  const identities = await loadSeasonFinaleGalaIdentities(admin, finaleTeamIds);
  for (const teamId of finaleTeamIds) {
    if (!identities.get(teamId)?.identity_ready) throw new Error(`Identité de la saison suivante non confirmée pour l’équipe ${teamId}.`);
  }
  const [registrationRidersResult, teamsResult] = await Promise.all([
    registrationIds.length > 0
      ? loadRowsByIds(registrationIds, (ids) => admin
          .from("pcm_gala_registration_riders")
          .select("registration_id,rider_id,position")
          .in("registration_id", ids)
          .order("position", { ascending: true })
          .order("registration_id")
          .returns<RegistrationRider[]>())
      : Promise.resolve({ data: [] as RegistrationRider[], error: null }),
    teamIds.length > 0
      ? loadRowsByIds(teamIds, (ids) => admin
          .from("teams")
          .select("id,pcm_export_id")
          .in("id", ids)
          .order("id")
          .returns<Team[]>())
      : Promise.resolve({ data: [] as Team[], error: null }),
  ]);

  assertQuery(registrationRidersResult, "coureurs inscrits");
  assertQuery(teamsResult, "identifiants PCM des équipes");
  const registrationRiders = registrationRidersResult.data ?? [];
  const riderIds = [...new Set(registrationRiders.map((row) => row.rider_id))];
  const ridersResult = riderIds.length > 0
    ? await loadRowsByIds(riderIds, (ids) => admin
        .from("riders")
        .select("id,pcm_export_id,first_name,last_name")
        .in("id", ids)
        .order("id")
        .returns<Rider[]>())
    : { data: [] as Rider[], error: null };
  assertQuery(ridersResult, "identifiants PCM des coureurs");

  const teamsById = new Map((teamsResult.data ?? []).map((row) => [row.id, row]));
  const teamNamesById = new Map((teamSeasonsResult.data ?? []).map((row) => [row.team_id, row.display_name]));
  for (const identity of identities.values()) teamNamesById.set(identity.team_id, identity.team_name);
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
        ) || left.team_id.localeCompare(right.team_id),
      );
    const groups = event.event_key === SEASON_FINALE_GALA_EVENT_KEY ? splitPcmGalaGroups(eventRegistrations) : [eventRegistrations];
    for (const [groupIndex, groupRegistrations] of groups.entries()) {
    const startlistTeams: PcmStartlistTeam[] = [
      {
        teamId: PCM_SPECTATOR_TEAM_ID,
        riderIds: [...PCM_SPECTATOR_RIDER_IDS],
      },
    ];
    const manifestTeams: Array<Record<string, unknown>> = [];

    for (const registration of groupRegistrations) {
      const team = teamsById.get(registration.team_id);
      if (!team || !Number.isInteger(Number(team.pcm_export_id))) {
        throw new Error(`Identifiant PCM absent pour l’équipe ${registration.team_id}.`);
      }
      const selected = [...(registrationRidersByRegistration.get(registration.id) ?? [])]
        .sort((left, right) => left.position - right.position);
      const isFinale = event.event_key === SEASON_FINALE_GALA_EVENT_KEY;
      if (isFinale ? selected.length < SEASON_FINALE_GALA_MIN_RIDERS || selected.length > SEASON_FINALE_GALA_MAX_RIDERS : selected.length !== event.roster_size) {
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
        ...(isFinale ? { identitySeason: season.game_year + 1, teamShortName: identities.get(registration.team_id)?.team_short_name } : {}),
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

    const xmlFilename = groups.length > 1 ? `Groupe-${groupIndex + 1}/${event.pcm_stage_filename}.xml` : `${event.pcm_stage_filename}.xml`;
    files[xmlFilename] = strToU8(createPcmStartlistXml(startlistTeams));
    manifestEvents.push({
      eventKey: event.event_key,
      eventName: event.display_name,
      file: xmlFilename,
      groupNumber: groupIndex + 1,
      groupCount: groups.length,
      registeredTeams: groupRegistrations.length,
      spectatorTeamIncluded: true,
      teams: manifestTeams,
    });
    }
  }

  files["manifest.json"] = strToU8(`${JSON.stringify({
    formatVersion: 2,
    targetGame: "Pro Cycling Manager 2026",
    generatedAt,
    season: season.game_year,
    events: manifestEvents,
  }, null, 2)}\n`);
  files["LISEZ-MOI.txt"] = strToU8(createReadme());

  return {
    archive: zipSync(files, { level: 6 }),
    filename: `Cyclostratege-Startlists-PCM26-S${season.game_year}${eventKey ? `-${eventKey}` : ""}.zip`,
    generatedAt,
    season: season.game_year,
    eventCount: events.length,
    simulationCount: manifestEvents.length,
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

async function loadAllRows<T>(query: { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }> }) {
  const rows: T[] = [];
  const pageSize = 1000;
  for (let start = 0; ; start += pageSize) {
    const result = await query.range(start, start + pageSize - 1);
    if (result.error) return { data: null, error: result.error };
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return { data: rows, error: null };
  }
}

async function loadRowsByIds<T>(ids: string[], createQuery: (ids: string[]) => { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }> }) {
  const rows: T[] = [];
  for (let start = 0; start < ids.length; start += 100) {
    const result = await loadAllRows(createQuery(ids.slice(start, start + 100)));
    if (result.error) return result;
    rows.push(...(result.data ?? []));
  }
  return { data: rows, error: null };
}

function createReadme() {
  return `INSTALLATION DES STARTLISTS CYCLOSTRATEGE DANS PCM26

1. Pour le gala vallonné, utilisez la base PCM spéciale gala : identités de la saison suivante
   et sélection de l'effectif de la saison terminée, avec identifiants PCM permanents.
   Depuis le gala, suivez le lien « base PCM du gala » puis générez cette base.
2. Fermez Pro Cycling Manager 2026.
3. Décompressez cette archive.
4. Copiez les fichiers XML directement dans :
   %APPDATA%\\Pro Cycling Manager 2026\\Cloud\\Startlists\\
5. Relancez PCM26, chargez le mod Cyclostratège et choisissez la course correspondante.
6. Activez le chargement de la liste de départ personnalisée.

SI L'ARCHIVE CONTIENT PLUSIEURS DOSSIERS GROUPE :
- Chaque groupe correspond a une simulation independante du meme parcours.
- Copiez uniquement le XML du Groupe-1, simulez et enregistrez cette course.
- Remplacez ensuite ce XML par celui du Groupe-2 et lancez une nouvelle course.
- Ne renommez pas topclas_fleche.xml : PCM reconnait ce nom de fichier.
- Continuez de la meme facon si des groupes supplementaires sont presents.
- Le manifeste detaille toutes les equipes : aucune inscription n'est exclue.
- Le top 5 de CHAQUE groupe recoit la meme dotation, sans finale commune.

Pour 6 a 8 coureurs sur la Fleche Wallonne, utilisez une DB Cyclostratege
exportee apres l'ajout des regles specifiques du gala (STA_race_rules).

L'équipe Cyclostratège et sept coureurs Simulo sont ajoutés automatiquement à
chaque fichier afin de pouvoir suivre la course en mode spectateur.
Le fichier manifest.json sert uniquement au contrôle humain ; PCM ne le lit pas.
`;
}

