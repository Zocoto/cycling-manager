// Isolated PGlite only. Optional third argument is a read-only function capture
// for checking migration anchors against an already deployed predecessor.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const modulePath = process.argv[2] ?? process.env.FEDERATION_CALLUP_SQL_TEST_MODULE;
assert.ok(modulePath, 'Pass the local PGlite module path');
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const capture = process.argv[3] ? JSON.parse(readFileSync(process.argv[3], 'utf8')) : null;
const bodies = new Map((capture?.rows ?? capture ?? []).map(row => [row.name, row.definition]));
const day = '2030-01-02';
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const scope = { season: id(1), day: id(2), country: id(3), director: id(4), president: id(5), auth: id(6), outsider: id(7), team: id(8) };
const pro = { edition: id(10), stage: id(11), list: id(12), member: id(13), rider: id(14), registration: id(15) };
const junior = { edition: id(20), list: id(22), member: id(23), rider: id(24), replacement: id(25), registration: id(26) };
const sql = name => readFileSync(`supabase/migrations/${name}.sql`, 'utf8').replaceAll('\r\n', '\n');

function definition(file, name) {
  const source = sql(file);
  const start = source.indexOf(`create or replace function ${name}(`);
  assert.ok(start >= 0, name);
  const end = source.indexOf('$$;', start);
  assert.ok(end > start, name);
  return source.slice(start, end + 3);
}

const responseWindows = '20261004083000_split_federation_selection_and_callup_deadlines';
const predecessor = `create function public.save_national_federation_preselection(p_country_code text,p_slot_key text,p_rider_ids uuid[])
returns jsonb language plpgsql as $$
declare v_list_id uuid;v_rider_ids uuid[]:=p_rider_ids;
begin
  select id into v_list_id from public.national_federation_selection_lists where slot_key=p_slot_key;
  delete from public.national_federation_selection_members
  where selection_list_id = v_list_id and response_status <> 'confirmed'
    and not (coalesce(professional_rider_id, junior_rider_id) = any(v_rider_ids));
  return '{}'::jsonb;
end;
$$;`;

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create table sporting_directors(id uuid primary key,auth_user_id uuid,status text);
    create table teams(id uuid primary key,status text);
    create table team_manager_assignments(sporting_director_id uuid,team_id uuid,role text,status text,created_at timestamptz,id uuid);
    create table seasons(id uuid primary key,status text,game_year integer,current_day_number integer);
    create table season_days(id uuid primary key,season_id uuid,day_number integer,calendar_date date);
    create table countries(id uuid primary key,iso_alpha2 text,name text,is_active boolean,continent_code text);
    create table national_federation_selection_slots(slot_key text primary key,competition_code text,rider_category text,profile_label text);
    create table national_federation_selection_lists(id uuid primary key default gen_random_uuid(),country_id uuid,season_id uuid,slot_key text,
      status text,revision integer,created_by_director_id uuid,published_at timestamptz,updated_at timestamptz,unique(country_id,season_id,slot_key));
    create table national_federation_selection_members(id uuid primary key default gen_random_uuid(),selection_list_id uuid,owner_team_id uuid,
      owner_director_id uuid,professional_rider_id uuid,junior_rider_id uuid,response_status text,created_at timestamptz default now(),responded_at timestamptz,
      constraint national_federation_selection_members_response_allowed check(response_status in('draft','pending','confirmed','declined','ineligible')));
    create table national_federation_selection_preferences(country_id uuid,season_id uuid,automatic_selection boolean);
    create table national_federation_terms(country_id uuid,president_director_id uuid,start_game_year integer,end_game_year integer);
    create table races(id uuid primary key,competition_type text,championship_continent_code text);
    create table race_editions(id uuid primary key,race_id uuid,season_id uuid,display_name text,status text);
    create table stages(id uuid primary key,race_edition_id uuid,season_day_id uuid,day_slot text,status text,departure_at timestamptz);
    create table official_stage_simulations(stage_id uuid references stages(id));
    create table official_stage_simulation_claims(stage_id uuid references stages(id));
    create table development_race_editions(id uuid primary key,season_id uuid,status text,simulated_at timestamptz,
      competition_type text,championship_continent_code text,profile_type text,selection_maximum integer,start_day_number integer);
    create table riders(id uuid primary key,first_name text,last_name text);
    create table youth_academy_riders(id uuid primary key,first_name text,last_name text,country_id uuid,team_id uuid,status text,
      birth_game_year int,time_trial int,prologue int,flat int,endurance int,hills int,mountain int,sprint int,resistance int);
    create table race_registrations(id uuid primary key,race_edition_id uuid,status text);
    create table race_rosters(rider_id uuid,race_registration_id uuid,status text);
    create table national_federation_selection_race_links(selection_list_id uuid,race_registration_id uuid);
    create table national_federation_junior_race_registrations(id uuid primary key default gen_random_uuid(),
      selection_list_id uuid unique,race_edition_id uuid,country_id uuid,status text,synced_at timestamptz);
    create table national_federation_junior_race_registration_riders(registration_id uuid,academy_rider_id uuid,development_team_id uuid);
    create table development_teams(id uuid,season_id uuid,status text);
    create table development_team_roster(id uuid,development_team_id uuid,academy_rider_id uuid,joined_at timestamptz);
    create table development_race_registrations(race_edition_id uuid,status text,updated_at timestamptz);
    create table sporting_director_messages(sporting_director_id uuid,season_id uuid,message_type text,sender_name text,
      subject text,preview text,body text,action_href text,action_label text,source_reference text,is_important boolean,read_at timestamptz,
      unique(sporting_director_id,source_reference));
    create table national_federation_journal_entries(country_id uuid,season_id uuid,day_number integer,category text,title text,detail text,source_reference text unique);
    create table test_schedule(slot_key text,edition_id uuid,departure_at timestamptz,selection_closes_at timestamptz);
    create table test_morale(category text,rider_id uuid,day_id uuid,source text,reference text,delta numeric,description text,metadata jsonb);
    create table test_refills(list_id uuid);

    create function public.get_national_federation_selection_schedule(uuid,uuid)
    returns table(slot_key text,label text,rider_category text,race_edition_id uuid,race_href text,departure_at timestamptz,closes_at timestamptz)
    language sql stable as $$select s.slot_key,s.slot_key,s.rider_category,e.edition_id,'/race/'||s.slot_key,e.departure_at,e.selection_closes_at
      from public.test_schedule e join public.national_federation_selection_slots s on s.slot_key=e.slot_key$$;
    create function public.get_federation_callup_ineligibility_reason(uuid,timestamptz) returns text language sql stable as $$select null::text$$;
    create function public.refill_national_federation_professional_selection(uuid,timestamptz) returns integer language sql as $$insert into public.test_refills values($1);select 0$$;
    create function public.sync_national_federation_championship_lineup(uuid) returns integer language sql as $$
      update public.race_rosters r set status='withdrawn' from public.national_federation_selection_race_links l
      where l.selection_list_id=$1 and l.race_registration_id=r.race_registration_id and not exists (
        select 1 from public.national_federation_selection_members m where m.selection_list_id=$1 and m.professional_rider_id=r.rider_id and m.response_status='confirmed'
      );select 0$$;
    create function public.apply_rider_morale_event(uuid,uuid,text,text,numeric,text,jsonb) returns jsonb language sql as $$
      insert into public.test_morale values('professional',$1,$2,$3,$4,$5,$6,$7);select '{}'::jsonb$$;
    create function public.apply_youth_rider_morale_event(uuid,uuid,text,text,numeric,text,jsonb) returns jsonb language sql as $$
      insert into public.test_morale values('junior',$1,$2,$3,$4,$5,$6,$7);select '{}'::jsonb$$;
    create function public.ensure_federation_junior_championship_calendar(uuid) returns integer language sql as $$select 0$$;
  `);
  const currentReader = bodies.get('get_current_director_federation_callups') ?? definition(responseWindows, 'public.get_current_director_federation_callups')
    .replace('  select member.id,', `  -- callup_eligibility_v1\n  with member_eligibility as (select id, null::text reason from public.national_federation_selection_members)\n  select member.id,`)
    .replace('  join public.national_federation_selection_lists as selection_list', '  join member_eligibility as eligibility on eligibility.id = member.id\n  join public.national_federation_selection_lists as selection_list');
  const currentJunior = bodies.get('ensure_automatic_federation_junior_lineups') ?? definition('20260904130000_expand_federation_program', 'public.ensure_automatic_federation_junior_lineups')
    .replace('where selection_list_id = v_list_id;', "where selection_list_id = v_list_id and response_status in ('draft', 'pending');")
    .replace('where academy.country_id = v_country.id', `where academy.country_id = v_country.id\n      and not exists (select 1 from public.national_federation_selection_members as kept\n        where kept.selection_list_id = v_list_id and kept.junior_rider_id = academy.id)`)
    .replace('limit v_edition.selection_maximum;', `limit greatest(0, v_edition.selection_maximum - (\n      select count(*) from public.national_federation_selection_members\n      where selection_list_id = v_list_id and response_status = 'confirmed'));`);
  const lockFile = '20261109112000_reconcile_international_callup_nationality';
  const syncFile = '20260904110000_federation_junior_championship_registrations';
  for (const source of [
    definition(responseWindows, 'public.get_national_federation_callup_response_closes_at'),
    definition(lockFile, 'private.lock_editable_naturalization_callup_race'),
    predecessor,
    bodies.get('save_national_federation_preselection'),
    bodies.get('sync_national_federation_junior_lineup') ?? definition(syncFile, 'public.sync_national_federation_junior_lineup'),
    definition(syncFile, 'public.sync_federation_junior_lineup_from_member'),
    definition(syncFile, 'public.sync_federation_junior_lineup_from_list'),
    currentReader, currentJunior,
  ].filter(Boolean)) await db.exec(source);
  await db.exec(`
    create function public.test_startlist_advisory_before_write() returns trigger language plpgsql as $$
    declare v_lock bigint;v_prefix text;
    begin
      if new.response_status <> 'withdrawn' then return new; end if;
      foreach v_prefix in array case when new.junior_rider_id is null
        then array['federation-junior-startlist:', 'federation-startlist:']
        else array['federation-junior-startlist:'] end loop
        v_lock := hashtextextended(v_prefix || new.selection_list_id::text, 0);
        if not exists(select 1 from pg_locks where pid = pg_backend_pid() and locktype = 'advisory' and granted
          and classid::bigint = ((v_lock >> 32) & 4294967295) and objid::bigint = (v_lock & 4294967295)) then
          raise exception 'Expected the category-specific startlist advisory lock before writing';
        end if;
      end loop;
      return new;
    end;
    $$;
    create trigger test_startlist_lock before update of response_status on national_federation_selection_members
      for each row execute function public.test_startlist_advisory_before_write();
    create trigger sync_junior_members after update of response_status or insert on national_federation_selection_members
      for each row execute function public.sync_federation_junior_lineup_from_member();
    create trigger sync_junior_lists after update of status on national_federation_selection_lists
      for each row execute function public.sync_federation_junior_lineup_from_list();
    insert into sporting_directors values('${scope.director}','${scope.auth}','active'),('${scope.president}','${scope.outsider}','active');
    insert into teams values('${scope.team}','active');
    insert into team_manager_assignments values('${scope.director}','${scope.team}','general_manager','active',now(),'${id(60)}');
    insert into seasons values('${scope.season}','active',8,4);
    insert into season_days values('${scope.day}','${scope.season}',4,'${day}');
    insert into countries values('${scope.country}','FR','France',true,'europe');
    insert into national_federation_terms values('${scope.country}','${scope.president}',7,8);
    insert into national_federation_selection_slots values('nc-hills','nations_cup','professional','Vallons'),
      ('world-junior-itt','world_championship_junior','junior','Chrono');
    insert into races values('${id(70)}','nations_cup',null);
    insert into race_editions values('${pro.edition}','${id(70)}','${scope.season}','Finale','registration_open');
    insert into stages values('${pro.stage}','${pro.edition}','${scope.day}','late','scheduled',now()+interval '30 hours');
    insert into development_race_editions values('${junior.edition}','${scope.season}','planned',null,'world_time_trial',null,'time_trial',1,5);
    insert into test_schedule values('nc-hills','${pro.edition}',now()+interval '30 hours',now()+interval '6 hours'),
      ('world-junior-itt','${junior.edition}',now()+interval '3 hours',now()+interval '3 hours');
    insert into riders values('${pro.rider}','Coureur','Test');
    insert into youth_academy_riders values
      ('${junior.rider}','Junior','Test','${scope.country}','${scope.team}','active',-9,75,10,10,10,10,10,10,10),
      ('${junior.replacement}','Autre','Junior','${scope.country}',null,'active',-9,65,10,10,10,10,10,10,10);
    insert into national_federation_selection_lists values
      ('${pro.list}','${scope.country}','${scope.season}','nc-hills','finalized',1,null,now(),now()),
      ('${junior.list}','${scope.country}','${scope.season}','world-junior-itt','finalized',1,null,now(),now());
    insert into national_federation_selection_members(id,selection_list_id,owner_team_id,owner_director_id,professional_rider_id,junior_rider_id,response_status) values
      ('${pro.member}','${pro.list}','${scope.team}','${scope.director}','${pro.rider}',null,'confirmed'),
      ('${junior.member}','${junior.list}','${scope.team}','${scope.director}',null,'${junior.rider}','confirmed');
    insert into race_registrations values('${pro.registration}','${pro.edition}','accepted'),('${id(31)}','${id(32)}','accepted');
    insert into race_rosters values('${pro.rider}','${pro.registration}','confirmed'),('${pro.rider}','${id(31)}','withdrawn');
    insert into national_federation_selection_race_links values('${pro.list}','${pro.registration}');
    insert into sporting_director_messages(sporting_director_id,season_id,message_type,source_reference) values
      ('${scope.director}','${scope.season}','international_selection','federation-auto-callup:${pro.member}'),
      ('${scope.director}','${scope.season}','international_selection','federation-selection:${junior.member}:revision:1'),
      ('${scope.director}','${scope.season}','international_selection','unrelated');
  `);
  await db.exec(sql('20261127200000_allow_confirmed_federation_callup_withdrawal'));
  const query = async (text, parameters = []) => (await db.query(text, parameters)).rows;
  const one = async (text, parameters = []) => (await query(text, parameters))[0];
  const authAs = user => query("select set_config('test.uid',$1,false)", [user]);
  const withdraw = member => one('select withdraw_confirmed_national_federation_callup($1) as status', [member]);
  const read = member => one('select member_id,race_edition_id,response_status,can_respond,can_withdraw from get_current_director_federation_callups() where member_id=$1', [member]);

  assert.equal((await one("select has_function_privilege('anon','withdraw_confirmed_national_federation_callup(uuid)','execute') allowed")).allowed, false);
  assert.equal((await one("select has_function_privilege('authenticated','withdraw_confirmed_national_federation_callup(uuid)','execute') allowed")).allowed, true);
  await authAs(scope.outsider);
  await assert.rejects(withdraw(pro.member), /ne concerne pas votre équipe/);
  await authAs(scope.auth);
  assert.deepEqual(await read(pro.member), { member_id: pro.member, race_edition_id: pro.edition, response_status: 'confirmed', can_respond: false, can_withdraw: true });
  await query('insert into official_stage_simulation_claims values($1)', [pro.stage]);
  assert.equal((await read(pro.member)).can_withdraw, false);
  await assert.rejects(withdraw(pro.member), /startlist est déjà verrouillée/);
  await query('delete from official_stage_simulation_claims where stage_id=$1', [pro.stage]);
  await query("update test_schedule set selection_closes_at=now()-interval '1 minute' where slot_key='nc-hills'");
  await assert.rejects(withdraw(pro.member), /délai de désistement est dépassé/);
  await query("update test_schedule set selection_closes_at=now()+interval '6 hours' where slot_key='nc-hills'");
  assert.equal((await withdraw(pro.member)).status, 'withdrawn');
  assert.equal((await withdraw(pro.member)).status, 'withdrawn');
  await authAs(scope.outsider);
  await assert.rejects(withdraw(pro.member), /ne concerne pas votre équipe/);
  await authAs(scope.auth);
  assert.equal((await read(pro.member)).response_status, 'withdrawn');
  assert.equal((await read(pro.member)).can_withdraw, false);
  assert.equal((await one('select status from race_rosters where race_registration_id=$1', [pro.registration])).status, 'withdrawn');
  assert.equal((await one('select status from race_rosters where race_registration_id=$1', [id(31)])).status, 'withdrawn');
  assert.equal((await one('select count(*)::int n from test_refills')).n, 1);

  await query("update test_schedule set departure_at=now()+interval '45 minutes' where slot_key='world-junior-itt'");
  await assert.rejects(withdraw(junior.member), /délai de désistement est dépassé/);
  await query("update test_schedule set departure_at=now()+interval '3 hours' where slot_key='world-junior-itt'");
  await query('update development_race_editions set simulated_at=now() where id=$1', [junior.edition]);
  await assert.rejects(withdraw(junior.member), /startlist est déjà verrouillée/);
  await query('update development_race_editions set simulated_at=null where id=$1', [junior.edition]);
  assert.equal((await withdraw(junior.member)).status, 'withdrawn');
  assert.equal((await withdraw(junior.member)).status, 'withdrawn');
  assert.equal((await one('select response_status from national_federation_selection_members where junior_rider_id=$1', [junior.replacement])).response_status, 'confirmed');
  await query('select ensure_automatic_federation_junior_lineups($1)', [junior.edition]);
  assert.equal((await read(junior.member)).response_status, 'withdrawn');
  assert.equal((await one('select count(*)::int n from national_federation_selection_members where junior_rider_id=$1', [junior.rider])).n, 1);
  assert.deepEqual(await query("select category,delta,reference from test_morale order by category"), [
    { category: 'junior', delta: '-10', reference: `international-callup-withdrawal:${junior.edition}` },
    { category: 'professional', delta: '-10', reference: `international-callup-withdrawal:${pro.edition}` },
  ]);
  assert.equal((await one('select count(*)::int n from sporting_director_messages where sporting_director_id=$1 and read_at is not null', [scope.director])).n, 2);
  assert.equal((await one('select count(*)::int n from sporting_director_messages where sporting_director_id=$1', [scope.president])).n, 2);
  assert.equal((await one('select count(*)::int n from national_federation_journal_entries')).n, 2);
  if (!capture) {
    await query("select save_national_federation_preselection('FR','nc-hills',array[]::uuid[])");
    assert.equal((await read(pro.member)).response_status,'withdrawn');
    await assert.rejects(query("select save_national_federation_preselection('FR','nc-hills',array[$1]::uuid[])",[pro.rider]), /ne peut plus être convoqué/);
  }
  console.log(`Federation call-up withdrawal SQL passed in isolated PGlite${capture ? ' with live predecessor definitions' : ''}.`);
} catch (error) {
  console.error(error.message, error.where ?? error.stack?.split('\n').slice(1, 4).join('\n'));
  process.exitCode = 1;
} finally {
  await db.close();
}
