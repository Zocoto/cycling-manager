// Isolated PostgreSQL using versioned schema and synthetic missions only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

assert(process.argv[2], 'Pass the local PGlite module path');
const {PGlite} = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const readMigration = file => readFileSync(`supabase/migrations/${file}.sql`, 'utf8').replaceAll('\r\n', '\n');
const migration = readMigration('20261112123000_allow_youth_scouting_recall');
const base = readMigration('20260722090000_create_youth_development_center');
const mailbox = readMigration('20260809151000_notify_completed_scouting_reports');
const scoutingColumns = [
  '20260723153000_create_infrastructure_gameplay',
  '20260825220000_refine_youth_scouting_generation',
  '20260827070000_add_scout_academy_training_talent',
  '20260907120000_activate_federation_infrastructure_effects',
  '20260907160000_apply_detection_bonuses_to_youth_quality_and_reports',
  '20260907163000_create_federal_school_cycling_plan',
  '20260908154500_activate_remaining_team_specializations',
  '20260908162000_activate_national_detection_network_specializations',
  '20260908210000_activate_federal_staff_institute_specializations',
  '20260927210000_add_rider_physiology_and_weight_management',
];
const baseTable = name => base.match(new RegExp(`create table public\\.${name} \\([\\s\\S]+?\\n\\);`))[0];
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
const scalar = async (sql, params = []) => Object.values((await rows(sql, params))[0])[0];
const mission = async number => (await rows('select * from youth_scouting_missions where id=$1', [id(number)]))[0];
const candidates = async number => rows('select * from youth_scouting_candidates where mission_id=$1 order by report_slot', [id(number)]);
const mail = async number => rows('select * from test_mailbox where mission_id=$1', [id(number)]);
let checks = 0;
const check = (actual, expected, message) => {
  assert.deepEqual(actual, expected, message);
  checks++;
};
const rejects = async (operation, match) => {
  await assert.rejects(operation, match);
  checks++;
};

async function asRole(role, operation) {
  await db.exec(`set role ${role}`);
  try {
    return await operation();
  } finally {
    await db.exec('reset role');
  }
}

const recall = (number, role = 'authenticated') => asRole(role, () => rows(
  'select public.recall_current_team_youth_scouting($1)', [id(number)],
));
const bonus = {
  federation_detection_bonus_percentage: 1,
  federal_staff_bonus_percentage: 2,
  federal_staff_spec_report_bonus_percentage: 3,
  scouting_supervision_bonus_percentage: 4,
  data_room_quality_bonus_percentage: 5,
  data_room_report_precision_bonus_percentage: 6,
  federation_detection_spec_report_bonus_percentage: 2.5,
  federation_detection_spec_potential_bonus_percentage: 3.5,
};
function candidate(missionNumber, slot, extras = {}) {
  return {
    mission_id: id(missionNumber), report_slot: slot, country_id: id(30),
    first_name: `Scout ${slot}`, last_name: 'Fixture', age: 17, archetype: 'climber', potential_steps: 3,
    avatar_profile_key: 'test', avatar_seed: 42,
    mountain: 4, hills: 4, flat: 4, time_trial: 4, cobbles: 4, sprint: 4, acceleration: 4,
    downhill: 4, endurance: 4, resistance: 4, recovery: 4, breakaway: 4, prologue: 4,
    signing_fee: 2000, tuition_per_season: 1500,
    international_center_bonus_applied: false, international_center_bonus_percentage: 0,
    scout_training_bonus_percentage: 2, federal_tuition_reduction_percentage: 1,
    scout_tuition_reduction_percentage: 3, data_room_tuition_reduction_percentage: 4,
    welcome_center_tuition_reduction_percentage: 5, historical_archetype: 'climber',
    school_plan_archetype: null, school_plan_transfer_points: 0, archetype_probabilities: {climber: 100},
    ...extras,
  };
}
const complete = (number, payload = [candidate(number, 1)], bonuses = bonus, role = 'service_role') => asRole(role, () => scalar(
  'select public.complete_youth_scouting_report($1,$2::jsonb,$3::jsonb)',
  [id(number), JSON.stringify(payload), JSON.stringify(bonuses)],
));

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.auth_uid', true), '')::uuid
    $$;
    create table public.teams (id uuid primary key);
    create table public.seasons (id uuid primary key, status text, current_day_number smallint, starts_on date);
    create table public.countries (id uuid primary key, is_active boolean);
    create table public.sporting_directors (id uuid primary key, auth_user_id uuid, status text);
    create table public.team_manager_assignments (sporting_director_id uuid, team_id uuid, role text, status text);
    create table public.staff_members (id uuid primary key, role text);
    create table public.staff_contracts (id uuid primary key, team_id uuid, staff_member_id uuid, status text);
    create table public.special_ability_catalog (code text primary key);
    create table public.test_mailbox (mission_id uuid primary key, candidate_count integer not null);
    create function public.sync_active_season_day() returns integer language sql as $$select 1$$;
    create function public.get_current_dashboard_assistant_summary() returns jsonb language sql as $$
      select jsonb_build_object('scouting',context.current_day_number + 3 <= 28 -- scout_launch_window_v1
      ) from (select 2 as current_day_number) context
    $$;
    ${baseTable('youth_scouting_missions')}
    ${baseTable('youth_scouting_candidates')}
    ${base.match(/create unique index youth_scouting_missions_one_active_per_scout_idx[\s\S]+?;/)[0]}
    ${base.match(/create or replace function public\.current_user_manages_team\([\s\S]+?\$\$;/)[0]}
    alter table youth_scouting_missions enable row level security;
    alter table youth_scouting_candidates enable row level security;
    grant all on youth_scouting_missions, youth_scouting_candidates to service_role;
    create function public.sync_director_scouting_report_message(p_mission_id uuid) returns void
    language sql as $$
      insert into public.test_mailbox select p_mission_id, count(*) from public.youth_scouting_candidates
      where mission_id=p_mission_id
    $$;
    ${mailbox.match(/create or replace function public\.sync_director_scouting_report_message_trigger\([\s\S]+?\$\$;/)[0]}
    ${mailbox.match(/create trigger youth_scouting_missions_sync_director_mailbox[\s\S]+?;/)[0]}
    insert into teams values ('${id(11)}'), ('${id(12)}');
    insert into seasons values
      ('${id(31)}', 'active', 2, (clock_timestamp() at time zone 'Europe/Paris')::date - 1),
      ('${id(32)}', 'completed', 28, (clock_timestamp() at time zone 'Europe/Paris')::date - 29);
    insert into countries values ('${id(30)}', true);
    insert into sporting_directors values ('${id(20)}','${id(21)}','active');
    insert into team_manager_assignments values ('${id(20)}','${id(11)}','general_manager','active');
    insert into special_ability_catalog values ('test_ability');
    insert into staff_members select ('00000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,'scout'
      from generate_series(1,5) i;
    insert into staff_contracts select id, case when id='${id(2)}' then '${id(12)}' else '${id(11)}' end::uuid,
      id, 'active' from staff_members;
  `);
  for (const file of scoutingColumns) {
    const statements = readMigration(file).match(/alter table public\.youth_scouting_(?:missions|candidates)\b[^;]+;/g);
    assert(statements?.length, `Missing scouting DDL in ${file}`);
    await db.exec(statements.join('\n'));
  }
  await db.exec(readMigration('20260801100000_enforce_youth_scouting_minimum_duration'));
  await db.exec(readMigration('20261111180000_count_scouting_dispatch_day'));
  await db.exec(migration);
  await db.query("select set_config('test.auth_uid',$1,false)", [id(21)]);

  await db.exec(`
    insert into youth_scouting_missions
      (id,team_id,season_id,scout_contract_id,country_id,start_day_number,duration_days,completes_day_number)
    values
      ('${id(101)}','${id(11)}','${id(31)}','${id(1)}','${id(30)}',1,3,3),
      ('${id(102)}','${id(12)}','${id(31)}','${id(2)}','${id(30)}',1,3,3),
      ('${id(103)}','${id(11)}','${id(32)}','${id(3)}','${id(30)}',1,3,3),
      ('${id(104)}','${id(11)}','${id(31)}','${id(4)}','${id(30)}',1,3,3),
      ('${id(105)}','${id(11)}','${id(31)}','${id(5)}','${id(30)}',1,3,3);
  `);
  await rejects(() => recall(101, 'anon'), /permission denied/);
  await rejects(() => recall(101, 'service_role'), /permission denied/);
  await rejects(() => complete(101, undefined, undefined, 'authenticated'), /permission denied/);
  await rejects(() => complete(101, undefined, undefined, 'anon'), /permission denied/);
  const rejectedRecall = await recall(999).then(() => null, error => error.message);
  assert(rejectedRecall, 'Missing mission must be rejected');
  await rejects(() => recall(102), error => error.message === rejectedRecall);
  await rejects(() => recall(103), error => error.message === rejectedRecall);
  await db.query("select set_config('test.auth_uid',$1,false)", [id(99)]);
  await rejects(() => recall(101), error => error.message === rejectedRecall);
  await db.query("select set_config('test.auth_uid',$1,false)", [id(21)]);

  const oldMission = await mission(101);
  await recall(101);
  const recalled = await mission(101);
  check(recalled, {...oldMission, status: 'cancelled', updated_at: recalled.updated_at}, 'Recall affects mission status and its update timestamp only');
  check(await complete(101), false, 'A stale settlement cannot finish a recalled mission');
  check(await candidates(101), [], 'A stale settlement writes no candidates');
  check(await mail(101), [], 'Recall sends no report');
  await rejects(() => recall(101), error => error.message === rejectedRecall);
  const newMissionId = await asRole('authenticated', () => scalar(
    'select public.start_current_team_youth_scouting($1,$2,3)', [id(1), id(30)],
  ));
  assert.notEqual(newMissionId, id(101));
  check(await scalar('select count(*)::int from youth_scouting_missions where scout_contract_id=$1 and status=$2', [id(1), 'active']), 1,
    'The same scout can start another mission immediately');

  await db.exec("update seasons set starts_on=(clock_timestamp() at time zone 'Europe/Paris')::date-2 where status='active'");
  await rejects(() => recall(104), error => error.message === rejectedRecall);
  check((await mission(104)).status, 'active', 'The Paris calendar blocks recall when the cached season day lags');
  await db.exec("update seasons set starts_on=(clock_timestamp() at time zone 'Europe/Paris')::date-1, current_day_number=3 where status='active'");
  await rejects(() => recall(105), error => error.message === rejectedRecall);
  check((await mission(105)).status, 'active', 'The current season day also blocks recall when ahead of the date');

  await rejects(() => complete(104, [candidate(104, 1), candidate(104, 2, {age: 99})]), /check constraint/);
  check(await candidates(104), [], 'A malformed candidate rolls the report back');
  await rejects(() => complete(104, undefined, {...bonus, federal_staff_bonus_percentage: 99}), /check constraint/);
  check(await candidates(104), [], 'The candidate insert rolls back if the later report update fails');
  check(await mail(104), [], 'A failed report emits no mailbox entry');
  check((await mission(104)).status, 'active', 'A failed report remains active and retryable');

  const payload = [
    candidate(104, 1, {id: id(201), status: 'signed'}),
    candidate(102, 2, {native_special_ability_code: 'test_ability'}),
    candidate(104, 2),
  ];
  check(await complete(104, payload), true, 'A valid report is settled');
  const report = await mission(104);
  check(report.status, 'completed');
  assert(report.report_ready_at, 'Completion records a report timestamp');
  for (const [column, value] of Object.entries(bonus)) {
    check(Number(report[column]), value, `Completion stores ${column}`);
  }
  const savedCandidates = await candidates(104);
  check(savedCandidates.map(row => [row.report_slot, row.status]), [[1, 'spotted'], [2, 'spotted']]);
  check(savedCandidates.every(row => row.id && row.id !== id(201) && row.created_at), true, 'New candidates retain generated IDs and timestamps');
  check(savedCandidates[1].native_special_ability_code, 'test_ability', 'Existing candidate fields survive settlement');
  check(await candidates(102), [], 'The settlement mission ID takes precedence over the candidate payload');
  check(await mail(104), [{mission_id: id(104), candidate_count: 2}], 'The mailbox trigger sees both candidates in the same transaction');
  check(await complete(104, [candidate(104, 3)]), false, 'Repeat settlement cannot add to a completed report');
  await rejects(() => recall(104), error => error.message === rejectedRecall);
  check(await mission(104), report, 'Recall and settlement retries preserve the completed report');
  check(await candidates(104), savedCandidates, 'Recall and settlement retries preserve the existing candidates');
  check(await mail(104), [{mission_id: id(104), candidate_count: 2}]);
  check((await mission(102)).status, 'active', 'Another team’s mission is preserved');
  check((await mission(103)).status, 'active', 'A prior-season mission is preserved');

  console.log(JSON.stringify({ok: true, isolatedPostgres: true, checks, productionWrites: 0}));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await db.close();
}
