// Generates bounded, task-specific SQL artifacts. It never connects to a database.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { SEASON_FINALE_GALA_RESULTS, SEASON_FINALE_GALA_RESULTS_EVENT_ID } from "../lib/game/season-finale-gala-results-data";

const out = resolve(process.cwd(), ".tmp-gala-results");
mkdirSync(out, { recursive: true });
const rows = SEASON_FINALE_GALA_RESULTS.flatMap((group) => group.rows.map((row) => ({
  group_number: group.groupNumber, rank: row.rank, rider_id: row.riderId,
  team_id: row.teamId, team_name: row.teamName,
})));
const prizes = rows.filter((row) => row.rank <= 5);
const sqlLiteral = (text: string) => `'${text.replaceAll("'", "''")}'`;
const eventId = sqlLiteral(SEASON_FINALE_GALA_RESULTS_EVENT_ID);
const source = `jsonb_to_recordset(${sqlLiteral(JSON.stringify(rows))}::jsonb) as v(group_number int,rank int,rider_id uuid,team_id uuid,team_name text)`;
writeFileSync(resolve(out, "preflight.sql"), `begin read only;
set local statement_timeout='5s';
select v.group_number,v.rank,v.rider_id,concat_ws(' ',r.first_name,r.last_name) as rider_name,
v.team_id,v.team_name,sd.display_name as manager_name,ts.id as inventory_team_season_id,
exists(select 1 from public.pcm_gala_registrations gr join public.pcm_gala_registration_riders rr on rr.registration_id=gr.id
  where gr.gala_event_id=${eventId}::uuid and gr.team_id=v.team_id and rr.rider_id=v.rider_id) as registered
from ${source}
left join public.riders r on r.id=v.rider_id
left join public.team_manager_assignments a on a.team_id=v.team_id and a.role='general_manager' and a.status='active'
left join public.sporting_directors sd on sd.id=a.sporting_director_id and sd.status='active'
left join public.team_seasons ts on ts.team_id=v.team_id and ts.season_id=(select season_id from public.pcm_gala_events where id=${eventId}::uuid)
order by v.group_number,v.rank;
commit;\n`, "utf8");
writeFileSync(resolve(out, "settle.sql"), `begin;
set local lock_timeout='5s'; set local statement_timeout='15s';
select public.settle_pcm_gala_rewards(${eventId}::uuid,${sqlLiteral(JSON.stringify(prizes))}::jsonb);
commit;\n`, "utf8");
console.log(JSON.stringify({ groups: 2, publishedRows: rows.length, awards: prizes.length, rewardedTeams: new Set(prizes.map((r) => r.team_id)).size, output: out }));

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20261008200000_settle_pcm_gala_rewards.sql"), "utf8");
if (!migration.trimEnd().endsWith("commit;")) throw new Error("Unexpected migration boundary.");
writeFileSync(resolve(out, "apply-migration.sql"), migration.replace(/commit;\s*$/, `
insert into supabase_migrations.schema_migrations(version,name)
values ('20261008200000','settle_pcm_gala_rewards');
commit;\n`), "utf8");
