import nativeProfiles from "../season-five-gala-profiles.json";
import { GALA_S5_COURSES } from "../season-five-gala";
import type { SeasonFiveGalaExportSource } from "../season-five-gala-startlists";
import type { PcmExportSnapshot } from "../pcm-export/types";

export function makeGalaS5Fixture(teamCount = 1, ridersPerTeam = 7, courseId = "pt-zoncolan") {
  const course = GALA_S5_COURSES.find(row => row.id === courseId)!;
  const source: SeasonFiveGalaExportSource = {
    edition: { id: "edition-s5", source_season_id: "s5", target_game_year: 6, registration_closes_at: "2026-12-03T17:00:00+00:00", status: "open" },
    events: GALA_S5_COURSES.map(row => {
      const native = nativeProfiles.courses[row.id as keyof typeof nativeProfiles.courses];
      return { edition_id: "edition-s5", event_key: row.id, program: row.program, pcm_race_id: native.pcmRaceId, pcm_stage_id: native.pcmStageId,
        stage_file: native.stageFile, startlist_filename: native.startlistFilename, native_capacity: native.nativeCapacity, min_riders: 7, max_riders: 8 };
    }), entries: [], selections: [], admissions: [], identities: [],
  };
  const snapshot = { galaEdition: "season-five", activeSeason: { id: "s5", game_year: 5, status: "completed" },
    seasons: [{ id: "s5", game_year: 5, status: "completed" }, { id: "s6", game_year: 6, status: "active" }], sha256: "a".repeat(64),
    teams: [], teamSeasons: [], riders: [], contracts: [], ratings: [] } as unknown as PcmExportSnapshot;
  for (let index = 0; index < teamCount; index++) {
    const teamId = `team-${index}`; const entryId = `entry-${index}`;
    source.entries.push({ id: entryId, team_id: teamId, auth_user_id: `user-${index}`, program: course.program });
    source.identities.push({ team_id: teamId, identity_season: 6, team_name: `S6 Team ${String(index).padStart(4, "0")}`, team_short_name: `T${index}`,
      team_country_code: "FR", registration_country_id: "fr", sponsor_catalog_key: null, jersey_id: null, jersey_style: null, identity_ready: true });
    snapshot.teams.push({ id: teamId, pcm_export_id: 244 + index } as PcmExportSnapshot["teams"][number]);
    snapshot.teamSeasons.push({ team_id: teamId, display_name: source.identities[index].team_name } as PcmExportSnapshot["teamSeasons"][number]);
    for (let position = 1; position <= ridersPerTeam; position++) {
      const riderId = `rider-${index}-${position}`;
      source.selections.push({ entry_id: entryId, edition_id: "edition-s5", event_key: course.id, program: course.program, rider_id: riderId, position });
      source.admissions.push({ entry_id: entryId, rider_id: riderId, primary_snapshot: { mountain: 75, hills: 75, flat: 75, time_trial: 75, cobbles: 75, sprint: 75 } });
      snapshot.riders.push({ id: riderId, pcm_export_id: 10001 + index * 8 + position, first_name: "Test", last_name: riderId } as PcmExportSnapshot["riders"][number]);
      snapshot.contracts.push({ id: `contract-${riderId}`, rider_id: riderId, team_id: teamId, start_season_id: "s5", end_season_id: "s5", status: "completed" } as PcmExportSnapshot["contracts"][number]);
      snapshot.ratings.push({ id: `rating-${riderId}`, rider_id: riderId, season_id: "s5", age: 25, mountain: 79, hills: 75, flat: 75, time_trial: 75, cobbles: 75, sprint: 75 } as PcmExportSnapshot["ratings"][number]);
    }
  }
  return { source, snapshot };
}
