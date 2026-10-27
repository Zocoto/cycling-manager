// Isolated PostgreSQL/WASM only: no network, credentials or production data.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath = process.argv[2];
if (process.argv.length !== 3 || !isAbsolute(modulePath ?? '') ||
  !modulePath.replaceAll('\\', '/').endsWith('/@electric-sql/pglite/dist/index.js')) {
  throw Error('Pass an absolute local PGlite module path. Production connections are unsupported.');
}
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const id = key => {
  const h = createHash('md5').update(String(key)).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
};
let checks = 0;
const eq = (value, expected, label) => { assert.deepEqual(value, expected, label); checks++; };
const rows = async (sql, params=[]) => (await db.query(sql, params)).rows;
const scalar = async (sql, params=[]) => Object.values((await rows(sql, params))[0])[0];
const owner = id('owner'), account = id('owner-account'), other = id('other'), ownerTeam = id('team');
const count = referral => scalar('select count(*)::int from cyclo_sticker_boosters where source_referral_id=$1', [id(referral)]);
async function referral(key, { at='2026-07-29T12:00:00Z', confirmed=true, status='qualified', referrer=owner }={}) {
  const userId = id(`account-${key}`), directorId = id(`director-${key}`);
  await db.query('insert into auth.users values($1,$2)', [userId, confirmed ? '2026-07-01T12:00:00Z' : null]);
  await db.query('insert into sporting_directors values($1,$2,\'active\')', [directorId,userId]);
  await db.query('insert into sporting_director_referrals(id,referrer_director_id,referred_director_id,status,qualified_at) values($1,$2,$3,$4,$5)',
    [id(key),referrer,directorId,status,status==='qualified'?at:null]);
}
try {
  await db.exec(`
    create schema private; create schema auth;
    create role anon; create role authenticated; create role service_role bypassrls;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
    create table sporting_directors(id uuid primary key,auth_user_id uuid,status text);
    create table seasons(id uuid primary key,game_year int unique,starts_on date,ends_on date,status text);
    create table sporting_director_referrals(id uuid primary key,referrer_director_id uuid references sporting_directors(id),
      referred_director_id uuid references sporting_directors(id),status text,qualified_at timestamptz);
    create table team_manager_assignments(sporting_director_id uuid,team_id uuid,role text,status text);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,status text,created_at timestamptz default now());
    create table referral_reward_grants(id uuid primary key default gen_random_uuid(),sporting_director_id uuid,milestone_count int,reward_key text,unique(sporting_director_id,milestone_count));
    create table daily_reward_inventory(id uuid primary key default gen_random_uuid(),sporting_director_id uuid,team_season_id uuid,
      source_claim_id uuid,source_referral_reward_id uuid unique,reward_key text,expires_after_game_year int,status text default 'available');
    grant usage on schema auth to authenticated; grant select on sporting_directors to authenticated;
  `);
  await db.query('insert into auth.users values($1,now())',[account]);
  await db.query('insert into sporting_directors values($1,$2,\'active\'),($3,$4,\'active\')',[owner,account,other,id('other-account')]);
  for (const [year,start,status] of [[4,'2026-07-01','completed'],[5,'2026-07-29','active'],[6,'2026-08-26','planned']]) {
    await db.query('insert into seasons values($1,$2,$3::date,$3::date+27,$4)',[id(`s${year}`),year,start,status]);
    await db.query('insert into team_seasons(id,team_id,season_id,status) values($1,$2,$3,\'active\')',[id(`ts${year}`),ownerTeam,id(`s${year}`)]);
  }
  await db.query('insert into team_manager_assignments values($1,$2,\'general_manager\',\'active\')',[owner,ownerTeam]);
  const legacySql = await readFile(new URL('../supabase/migrations/20260828150000_boost_referrals_and_unlock_patron_hat.sql',import.meta.url),'utf8');
  const legacySync = legacySql.match(/create or replace function private\.sync_referral_rewards\([\s\S]*?\$\$;/)[0];
  await db.exec(legacySync);
  const originalFunction = await scalar("select pg_get_functiondef('private.sync_referral_rewards(uuid)'::regprocedure)");
  await referral('existing-s4', {at:'2026-07-15T12:00:00Z'});
  const migration = await readFile(new URL('../supabase/migrations/20261027180000_add_s5_referral_sticker_boosters.sql',import.meta.url),'utf8');
  await db.exec(migration);
  eq(await scalar('select count(*)::int from cyclo_sticker_boosters'),0,'no migration backfill');
  eq(await scalar("select pg_get_functiondef('private.sync_referral_rewards(uuid)'::regprocedure)"),originalFunction,'existing reward function unchanged');
  await referral('s4-boundary',{at:'2026-07-28T21:59:59.999Z'});
  eq(await count('s4-boundary'),0,'last instant of S4 in Paris gives no boosters');
  await referral('s5-boundary',{at:'2026-07-28T22:00:00Z'});
  eq(await count('s5-boundary'),2,'Paris midnight S5 gives exactly two boosters');
  eq(await rows('select distinct sporting_director_id,collection_season_id,source_season_id from cyclo_sticker_boosters where source_referral_id=$1',[id('s5-boundary')]),
    [{sporting_director_id:owner,collection_season_id:id('s5'),source_season_id:id('s4')}],'referrer receives the correct edition');
  await db.query("update sporting_director_referrals set status='qualified' where id=$1",[id('s5-boundary')]);
  eq(await count('s5-boundary'),2,'same-state update is idempotent');
  await db.query("update sporting_director_referrals set status='registered',qualified_at=null where id=$1",[id('s5-boundary')]);
  await db.query("update sporting_director_referrals set status='qualified',qualified_at='2026-07-29T12:00:00Z' where id=$1",[id('s5-boundary')]);
  eq(await count('s5-boundary'),2,'requalification cannot double the reward');
  await referral('pending',{status:'registered'});
  await referral('unconfirmed',{confirmed:false});
  eq(await count('pending'),0,'unqualified referral earns nothing');
  eq(await count('unconfirmed'),0,'unconfirmed account earns nothing');
  await db.query("update sporting_director_referrals set status='qualified',qualified_at='2026-07-30T12:00:00Z' where id=$1",[id('pending')]);
  eq(await count('pending'),2,'a pending signup validated in S5 earns two');
  await db.query("update sporting_director_referrals set status='qualified' where id=$1",[id('existing-s4')]);
  eq(await count('existing-s4'),0,'historical qualified S4 referral is never rewarded retrospectively');
  await db.exec("update seasons set status=case when game_year=5 then 'completed' when game_year=6 then 'active' else status end;");
  await referral('delayed-s5');
  eq(await scalar('select collection_season_id from cyclo_sticker_boosters where source_referral_id=$1 limit 1',[id('delayed-s5')]),id('s5'),'delayed S5 qualification retains its edition during S6');
  await referral('s6',{at:'2026-08-26T12:00:00Z'});
  eq(await scalar('select source_season_id from cyclo_sticker_boosters where source_referral_id=$1 limit 1',[id('s6')]),id('s5'),'S6 gives the next collection, not a relabeled S4 pack');
  await db.exec("update seasons set status='planned' where game_year=6;");
  await referral('rollover-cron-delay',{at:'2026-08-26T12:00:00Z'});
  eq(await count('rollover-cron-delay'),2,'clock-based reward survives delayed season activation');
  await db.exec("update seasons set status='cancelled' where game_year=6;");
  await referral('cancelled-s6',{at:'2026-08-26T12:00:00Z'});
  eq(await count('cancelled-s6'),0,'cancelled collection cannot receive packs');
  await referral('future',{at:'2099-07-29T12:00:00Z'});
  eq(await count('future'),0,'future qualification dates cannot mint packs');
  await referral('self',{referrer:id('director-self')});
  eq(await count('self'),0,'self-referral cannot mint packs');
  await db.exec("update seasons set status=case when game_year=5 then 'active' when game_year=6 then 'planned' else status end;");
  for(let n=0;n<25;n++) await referral(`milestone-${n}`);
  await db.query('select private.sync_referral_rewards($1)',[owner]);
  eq(await rows('select milestone_count,reward_key from referral_reward_grants order by milestone_count'),[
    {milestone_count:1,reward_key:'premium-equipment'},{milestone_count:3,reward_key:'primary-breakthrough'},
    {milestone_count:5,reward_key:'talent-revealed-plus'},{milestone_count:10,reward_key:'staff-expertise-badge'},
    {milestone_count:25,reward_key:'high-performance-cell'},
  ],'all five actual existing premium rewards are preserved');
  eq(await scalar('select count(*)::int from daily_reward_inventory'),5,'the old inventory still receives all milestone items');
  const total=await scalar('select count(*)::int from cyclo_sticker_boosters');
  await db.query('select private.sync_referral_rewards($1)',[owner]);
  eq(await scalar('select count(*)::int from cyclo_sticker_boosters'),total,'reading or resyncing legacy rewards never duplicates boosters');
  await referral('other-owner',{referrer:other});
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${account}';`);
  eq(await scalar('select count(*)::int from cyclo_sticker_boosters'),total,'RLS exposes only the current DS inventory');
  await assert.rejects(db.exec('delete from cyclo_sticker_boosters'),/permission denied/);checks++;
  await assert.rejects(db.exec("update cyclo_sticker_boosters set opened_at=now()"),/permission denied/);checks++;
  await assert.rejects(db.exec('insert into cyclo_sticker_boosters default values'),/permission denied/);checks++;
  await db.exec('reset role');
  console.log(JSON.stringify({isolatedPostgresChecks:checks,productionAccess:false,existingRewardsPreserved:true}));
} finally { await db.close(); }
