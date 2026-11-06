import compatibility from "@/assets/pcm/gala-s4-steam-compatibility.json";
import { GALA_EVENTS, type GalaEventKey } from "./season-four-gala";
import { GalaStartlistError, type GalaExportSnapshot } from "./season-four-gala-startlists";

export type GalaSteamCompatibility = {
  title: string;
  workshopId: string;
  steamManifestId: string;
  databaseSha256: string;
  teams: readonly number[];
  riders: Readonly<Record<string, number>>;
  races: Readonly<Record<string, {
    filename: string; maxTeams: number; minRiders: number; maxRiders: number;
  }>>;
};

const registry: GalaSteamCompatibility = compatibility;
export const GALA_STEAM_DATABASE = Object.freeze({
  title: registry.title,
  workshopId: registry.workshopId,
  steamManifestId: registry.steamManifestId,
  databaseSha256: registry.databaseSha256,
});

/** Offline compatibility check against the exact published Steam database. */
export function validateSeasonFourGalaSteamCompatibility(
  snapshot: GalaExportSnapshot,
  eventKey?: GalaEventKey,
  steam: GalaSteamCompatibility = registry,
): void {
  if (snapshot.season !== 4) throw new GalaStartlistError("La compatibilité Steam du gala concerne exclusivement la saison 4.");
  const events = eventKey ? GALA_EVENTS.filter(event => event.key === eventKey) : GALA_EVENTS;
  if (!events.length) throw new GalaStartlistError("Course du gala inconnue.");
  const registrations = new Map(snapshot.registrations.map(row => [row.id, row]));
  const teams = new Map(snapshot.teams.map(row => [row.id, row]));
  const riders = new Map(snapshot.riders.map(row => [row.id, row]));
  const steamTeams = new Set(steam.teams);
  const issues = new Set<string>();
  for (const event of events) {
    const selected = snapshot.selections.filter(row => row.profile === event.profile
      && registrations.get(row.registration_id)?.program === event.program);
    if (!selected.length) continue;
    const rule = steam.races[String(event.course.raceId)];
    if (!rule || rule.filename + ".xml" !== event.course.startlistFilename
      || rule.maxTeams !== event.course.nativeCapacity || rule.minRiders !== 7 || rule.maxRiders !== 8) {
      issues.add(`Paramètres de course incompatibles : ${event.course.name}.`);
      continue;
    }
    const registrationIds = new Set(selected.map(row => row.registration_id));
    if (registrationIds.size + 1 > rule.maxTeams) issues.add(`Capacité Steam dépassée : ${event.course.name}.`);
    for (const registrationId of registrationIds) {
      const registration = registrations.get(registrationId)!;
      const team = teams.get(registration.team_id);
      const pcmTeamId = team?.pcm_export_id;
      if (!Number.isSafeInteger(pcmTeamId) || !steamTeams.has(Number(pcmTeamId))) {
        issues.add(`Équipe absente de la BDD Steam : ${team?.name ?? registration.team_id}.`);
        continue;
      }
      const lineup = selected.filter(row => row.registration_id === registrationId);
      if (lineup.length < rule.minRiders || lineup.length > rule.maxRiders) {
        issues.add(`Composition incompatible avec Steam : ${team!.name}, 7 à 8 coureurs requis.`);
      }
      for (const selection of lineup) {
        const rider = riders.get(selection.rider_id);
        const name = rider ? `${rider.first_name} ${rider.last_name}` : selection.rider_id;
        const pcmRiderId = rider?.pcm_export_id;
        if (!Number.isSafeInteger(pcmRiderId) || !Object.hasOwn(steam.riders, String(pcmRiderId))) {
          issues.add(`Coureur absent de la BDD Steam : ${name}.`);
        } else if (steam.riders[String(pcmRiderId)] !== pcmTeamId) {
          issues.add(`Club différent dans la BDD Steam : ${name} (${team!.name}).`);
        }
      }
    }
  }
  if (issues.size) {
    throw new GalaStartlistError(`Startlist incompatible avec la BDD Steam du gala (${steam.title}). ${[...issues].slice(0, 5).join(" ")} Corrigez la composition avant l’export.`);
  }
}
