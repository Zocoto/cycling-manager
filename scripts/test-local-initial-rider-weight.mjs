// In-memory PostgreSQL only. No environment loading, credentials or live access.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  getRiderWeightThreshold, inferRiderPhysiologyProfile,
  getRiderPhysiologyProfileModifier,
  getRiderMinimumPowerWeight,
} from "../lib/game/rider-physiology.ts";

if (!process.argv[2] || !process.argv[2].endsWith("/dist/index.js")) {
  throw new Error("Pass a local PGlite dist/index.js; database URLs are not supported.");
}
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const migration = await readFile("supabase/migrations/20261008150000_normalize_inherited_rider_weight.sql", "utf8");
const original = await readFile("supabase/migrations/20260927210000_add_rider_physiology_and_weight_management.sql", "utf8");
const ratings = {
  mountain: 95, hills: 50, flat: 50, timeTrial: 50, cobbles: 50, sprint: 50,
  acceleration: 50, downhill: 50, endurance: 50, resistance: 50, recovery: 50,
  breakaway: 50, prologue: 50,
};
const ratingInsert = async (n, rider, season = id(100), mountain = 95, sprint = 50) => db.query(`
  insert into public.rider_season_ratings values
    ($1,$2,$3,$4,50,50,50,50,$5,50,50,50,50,50)`, [id(n), rider, season, mountain, sprint]);
const readRider = async n => (await db.query("select * from public.riders where id=$1", [id(n)])).rows[0];

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table public.countries(id uuid primary key, continent_code text);
    create table public.riders(id uuid primary key, country_id uuid,
      height_cm numeric(5,1), weight_kg numeric(5,1) check(weight_kg between 40 and 120),
      baseline_weight_kg numeric(5,1) check(baseline_weight_kg between 40 and 120),
      physiology_version smallint);
    create table public.seasons(id uuid primary key, game_year integer, status text);
    create table public.rider_season_ratings(id uuid primary key, rider_id uuid,
      season_id uuid, mountain numeric, hills numeric, flat numeric, time_trial numeric,
      cobbles numeric, sprint numeric, acceleration numeric, endurance numeric,
      resistance numeric, recovery numeric, breakaway numeric);
    create table public.youth_scouting_candidates(id uuid primary key,
      country_id uuid, archetype text, adult_height_cm numeric, adult_weight_kg numeric,
      growth_pattern text, physiology_version smallint);
    create table public.youth_academy_riders(id uuid primary key,
      candidate_id uuid, country_id uuid, archetype text, adult_height_cm numeric,
      adult_weight_kg numeric, growth_pattern text, physiology_version smallint,
      promoted_rider_id uuid);
    create table public.rider_weight_events(id uuid primary key, rider_id uuid,
      source text, weight_before_kg numeric, weight_delta_kg numeric, weight_after_kg numeric);
    create table public.untouched_state(form numeric, cash numeric, race_snapshot jsonb);
    insert into public.untouched_state values (72,10000,'{"winner":"historical","weightKg":63}');
    insert into public.seasons values('${id(100)}',3,'active'),('${id(101)}',4,'upcoming');
  `);
  await db.exec(original.slice(original.indexOf("create or replace function public.physiology_seed_fraction"), original.indexOf("-- Neutral backfill")));
  for (const [n, height, weight, baseline, version] of [
    [1,170,63,63,0], [2,170,63.6,63,0], [3,170,62.4,63,0],
    [4,170,60.9,60,0], [5,170,60.1,63,0], [6,180,79,79,0],
    [7,170,63,63,1], [8,null,null,null,null], [9,145,40,48,0],
  ]) {
    await db.query("insert into public.riders values($1,null,$2,$3,$4,$5)", [id(n),height,weight,baseline,version]);
    if (n !== 8) await ratingInsert(1000+n,id(n),id(100),n === 6 ? 50 : 95,n === 6 ? 95 : 50);
  }
  // An upcoming season must not override the current native profile.
  await ratingInsert(1101,id(1),id(101),50,95);
  for (const [n, target, source, before, delta, after] of [
    [201,2,"supplement",63,0.6,63.6], [202,3,"weight_cut",63,-0.6,62.4],
    [203,4,"supplement",60,0.9,60.9], [204,5,"weight_cut",63,-2.9,60.1],
  ]) await db.query("insert into public.rider_weight_events values($1,$2,$3,$4,$5,$6)", [id(n),id(target),source,before,delta,after]);
  await db.exec(`
    insert into public.youth_scouting_candidates values('${id(301)}',null,'sprinter',180,82,'steady',0);
    insert into public.youth_academy_riders values('${id(401)}','${id(301)}',null,'sprinter',180,82,'steady',0,null);
  `);
  await db.exec(original.slice(original.indexOf("create or replace function public.assign_youth_candidate_physiology"), original.indexOf("create table public.rider_weight_events")));
  const ledgerBefore = (await db.query("select * from public.rider_weight_events order by id")).rows;
  const stateBefore = (await db.query("select * from public.untouched_state")).rows;
  await db.exec(migration);
  const limit = getRiderWeightThreshold("climber",170).maximumWeightKg;
  assert.equal(limit,60.4);
  for (const [n, expected, expectedBase, version] of [
    [1,60.4,60.4,0], [2,61,60.4,0], [3,59.8,60.4,0], [4,60.9,60,0],
    [5,57.5,60.4,0], [6,79,79,0], [7,60.4,60.4,1], [9,40,43.9,0],
  ]) {
    const rider = await readRider(n);
    assert.equal(Number(rider.weight_kg),expected,`current weight ${n}`);
    assert.equal(Number(rider.baseline_weight_kg),expectedBase,`baseline ${n}`);
    assert.equal(rider.physiology_version,version,`legacy version ${n}`);
  }
  assert.equal((await readRider(8)).height_cm,null);
  assert.equal(getRiderPhysiologyProfileModifier({ratings, profileType:"mountain",
    physiology:{heightCm:170,weightKg:limit,baselineWeightKg:limit,physiologyVersion:0}}),0,
    "legacy corrected baseline stays neutral rather than granting a free climbing bonus");
  assert.deepEqual((await db.query("select * from public.rider_weight_events order by id")).rows,ledgerBefore);
  assert.deepEqual((await db.query("select * from public.untouched_state")).rows,stateBefore);
  assert.equal(Number((await db.query("select adult_weight_kg from public.youth_scouting_candidates")).rows[0].adult_weight_kg),79.3);
  assert.equal(Number((await db.query("select adult_weight_kg from public.youth_academy_riders")).rows[0].adult_weight_kg),79.3);
  const afterOnce = (await db.query("select * from public.riders order by id")).rows;
  const auditOnce = (await db.query("select * from public.initial_rider_weight_corrections order by entity_kind,entity_id")).rows;
  await db.exec(migration);
  assert.deepEqual((await db.query("select * from public.riders order by id")).rows,afterOnce,"idempotent weights");
  assert.deepEqual((await db.query("select * from public.initial_rider_weight_corrections order by entity_kind,entity_id")).rows,auditOnce,"idempotent audit trail");

  const profiles = ["climber","puncheur","stage_racer","northern_classics","rouleur","breakaway","sprinter","all_rounder"];
  for (const profile of profiles) for (const height of [145,154,160,170,175,180,185,195,202,210]) {
    const sqlLimit = Number((await db.query("select public.get_rider_initial_weight_limit_kg($1,$2) as n",[profile,height])).rows[0].n);
    assert.equal(sqlLimit,getRiderWeightThreshold(profile,height).maximumWeightKg,`SQL/guide parity ${profile} ${height}`);
    for (let seed = 0; seed < 20; seed++) {
      const weight = Number((await db.query("select public.generate_rider_weight_kg($1,$2,$3) as n",[profile,height,String(seed)])).rows[0].n);
      assert.ok(weight <= sqlLimit,`safe generation ${profile} ${height} ${seed}`);
    }
  }
  assert.equal((await db.query("select public.infer_rider_physiology_profile(0,0,0,0,0,0,0,0,0,0,0) as p")).rows[0].p,
    inferRiderPhysiologyProfile(Object.fromEntries(Object.keys(ratings).map(k => [k,0]))),"stable score ties");
  for (const role of ["anon","authenticated"]) {
    await db.exec(`set role ${role}`);
    await assert.rejects(() => db.query("select * from public.initial_rider_weight_corrections"),/permission denied/);
    await db.exec("reset role");
  }
  await db.exec("set role service_role");
  assert.ok((await db.query("select count(*) as n from public.initial_rider_weight_corrections")).rows[0].n > 0);
  await db.exec("reset role");

  // Fresh professional and pre-filled physique paths.
  await ratingInsert(1200,id(8));
  const fresh = await readRider(8);
  assert.ok(Number(fresh.weight_kg) <= getRiderWeightThreshold("climber",Number(fresh.height_cm)).maximumWeightKg);
  await db.exec(`insert into public.riders values('${id(10)}',null,170,64,64,1)`);
  await ratingInsert(1210,id(10));
  assert.equal(Number((await readRider(10)).weight_kg),60.4);

  // Promotion after ratings and promotion before ratings must both use actual notes.
  for (const [n,ratingFirst] of [[11,true],[12,false]]) {
    await db.exec(`insert into public.riders values('${id(n)}',null,null,null,null,null);
      insert into public.youth_academy_riders values('${id(400+n)}','${id(301)}',null,'sprinter',180,79.3,'steady',0,null)`);
    if (ratingFirst) await ratingInsert(1300+n,id(n));
    await db.query("update public.youth_academy_riders set promoted_rider_id=$1 where id=$2",[id(n),id(400+n)]);
    if (!ratingFirst) await ratingInsert(1300+n,id(n));
    const promoted = await readRider(n);
    assert.equal(Number(promoted.weight_kg),getRiderWeightThreshold("climber",180).maximumWeightKg);
    assert.equal(promoted.weight_kg,promoted.baseline_weight_kg);
  }
  // Generation and candidate-to-academy copying still preserve deterministic DNA.
  await db.exec(`insert into public.youth_scouting_candidates(id,archetype) values('${id(302)}','climber');
    insert into public.youth_academy_riders(id,candidate_id,archetype) values('${id(402)}','${id(302)}','climber')`);
  const candidate = (await db.query("select * from public.youth_scouting_candidates where id=$1",[id(302)])).rows[0];
  const academy = (await db.query("select * from public.youth_academy_riders where id=$1",[id(402)])).rows[0];
  assert.ok(Number(candidate.adult_weight_kg) <= getRiderWeightThreshold("climber",Number(candidate.adult_height_cm)).maximumWeightKg);
  assert.equal(candidate.adult_weight_kg,academy.adult_weight_kg);
  assert.equal(candidate.adult_height_cm,academy.adult_height_cm);
  assert.equal(candidate.physiology_version,1);
  console.log("PASS: one-off normalization, real supplement gains and weight cuts, no form/cash/history changes, SQL/guide parity, historical safe generation, stable ties, youth promotion both orders, legacy neutrality, permissions and idempotency.");

  // The follow-up restores rare birth traits, never the old inherited weights.
  const rareMigration = await readFile("supabase/migrations/20261008153000_allow_rare_initial_rider_overweight.sql", "utf8");
  const beforeRarePolicy = (await db.query("select * from public.riders order by id")).rows;
  const beforeRareYouth = (await db.query("select * from public.youth_scouting_candidates order by id")).rows;
  const beforeRareAcademy = (await db.query("select * from public.youth_academy_riders order by id")).rows;
  const beforeRareAudit = (await db.query("select * from public.initial_rider_weight_corrections order by entity_kind,entity_id")).rows;
  await db.exec(rareMigration);
  assert.deepEqual((await db.query("select * from public.riders order by id")).rows,beforeRarePolicy);
  assert.deepEqual((await db.query("select * from public.youth_scouting_candidates order by id")).rows,beforeRareYouth);
  assert.deepEqual((await db.query("select * from public.youth_academy_riders order by id")).rows,beforeRareAcademy);
  assert.deepEqual((await db.query("select * from public.initial_rider_weight_corrections order by entity_kind,entity_id")).rows,beforeRareAudit);
  assert.deepEqual((await db.query("select * from public.rider_weight_events order by id")).rows,ledgerBefore);
  assert.deepEqual((await db.query("select * from public.untouched_state")).rows,stateBefore);

  // 64,000 in-memory births, never a production benchmark.
  const distribution = (await db.query(`
    with samples as materialized (
      select profile,height,n,
        public.get_rider_initial_weight_limit_kg(profile,height) as maximum_weight,
        public.generate_rider_weight_kg(profile,height,profile || ':' || height || ':' || n) as weight
      from unnest($1::text[]) as p(profile)
      cross join (values(154::numeric),(170),(180),(202)) as h(height)
      cross join generate_series(1,2000) as s(n)
    )
    select profile,height,count(*)::integer as total,
      count(*) filter (where weight > maximum_weight)::integer as overweight,
      min(weight) filter (where weight > maximum_weight) as lightest_overweight,
      max(weight) filter (where weight > maximum_weight) as heaviest_overweight,
      min(weight) as minimum_weight, max(weight) as maximum_weight,
      count(distinct weight)::integer as distinct_weights
    from samples group by profile,height order by profile,height`,[profiles])).rows;
  for (const row of distribution) {
    const height = Number(row.height);
    const threshold = getRiderWeightThreshold(row.profile,height).maximumBodyMassIndex;
    assert.ok(row.overweight / row.total >= 0.025 && row.overweight / row.total <= 0.075,
      `rare 5% distribution ${row.profile} ${height}: ${row.overweight}/${row.total}`);
    assert.ok(Number(row.lightest_overweight) / (height/100)**2 - threshold >= 0.15 - 1e-9,
      "rounding cannot fall below the selected BMI range");
    assert.ok(Number(row.heaviest_overweight) / (height/100)**2 - threshold <= 0.75 + 1e-9,
      "rounding cannot exceed the maximum birth overweight");
    assert.ok(Number(row.minimum_weight) >= 40 && Number(row.maximum_weight) <= 120);
    assert.ok(row.distinct_weights > 5,"variety is preserved instead of a uniform physique");
  }
  const rareRiderNumber = Number((await db.query(`
    select n from generate_series(100000,101000) as s(n)
    where public.get_rider_initial_overweight_allowance_bmi(
      '00000000-0000-4000-8000-' || lpad(n::text,12,'0')) > 0 limit 1`)).rows[0].n);
  const repeat = (await db.query(`select public.generate_rider_weight_kg('climber',170,$1) as a,
    public.generate_rider_weight_kg('climber',170,$1) as b`,[id(rareRiderNumber)])).rows[0];
  assert.equal(repeat.a,repeat.b,"deterministic birth traits cannot be rerolled");
  await db.query("insert into public.riders values($1,null,null,null,null,null)",[id(rareRiderNumber)]);
  await ratingInsert(200000,id(rareRiderNumber));
  const rareBirth = await readRider(rareRiderNumber);
  assert.ok(Number(rareBirth.weight_kg) > getRiderWeightThreshold("climber",Number(rareBirth.height_cm)).maximumWeightKg);
  assert.equal(rareBirth.weight_kg,rareBirth.baseline_weight_kg);
  await ratingInsert(200001,id(rareRiderNumber),id(101));
  assert.deepEqual(await readRider(rareRiderNumber),rareBirth,"a new season must not automatically slim an overweight birth");

  for (const [n,ratingFirst] of [[21,true],[22,false]]) {
    await db.exec(`insert into public.riders values('${id(n)}',null,null,null,null,null);
      insert into public.youth_academy_riders values('${id(400+n)}','${id(301)}',null,'climber',170,61.8,'steady',1,null)`);
    if (ratingFirst) await ratingInsert(210000+n,id(n));
    await db.query("update public.youth_academy_riders set promoted_rider_id=$1 where id=$2",[id(n),id(400+n)]);
    if (!ratingFirst) await ratingInsert(210000+n,id(n));
    const promoted = await readRider(n);
    assert.equal(Number(promoted.weight_kg),61.8,"promotion preserves the selected rare physique");
    assert.equal(promoted.weight_kg,promoted.baseline_weight_kg);
  }
  const rareCandidateId = id(rareRiderNumber+1000000);
  // Use a proven rare candidate seed rather than imposing a body after birth.
  const candidateNumber = Number((await db.query(`select n from generate_series(1100000,1101000) s(n)
    where public.get_rider_initial_overweight_allowance_bmi(
      '00000000-0000-4000-8000-' || lpad(n::text,12,'0')) > 0 limit 1`)).rows[0].n);
  await db.query("insert into public.youth_scouting_candidates(id,archetype) values($1,'climber')",[id(candidateNumber)]);
  await db.query("insert into public.youth_academy_riders(id,candidate_id,archetype) values($1,$2,'climber')",[rareCandidateId,id(candidateNumber)]);
  const rareCandidate = (await db.query("select * from public.youth_scouting_candidates where id=$1",[id(candidateNumber)])).rows[0];
  const rareAcademy = (await db.query("select * from public.youth_academy_riders where id=$1",[rareCandidateId])).rows[0];
  assert.ok(Number(rareCandidate.adult_weight_kg) > getRiderWeightThreshold("climber",Number(rareCandidate.adult_height_cm)).maximumWeightKg);
  assert.equal(rareCandidate.adult_weight_kg,rareAcademy.adult_weight_kg);
  const beforePolicyRetry = (await db.query("select * from public.riders order by id")).rows;
  await db.exec(rareMigration);
  assert.deepEqual((await db.query("select * from public.riders order by id")).rows,beforePolicyRetry);
  console.log("PASS: 64,000 births across all profiles/sizes, rare and bounded initial overweight, deterministic varied bodies, promotion both orders, season changes, no reversal of corrections and no nutrition/history mutation.");

  // Power underweight: fix inherited baselines, not intentional current cuts.
  for (const [n,weight,baseline] of [[30,64.4,65],[31,72.8,73]]) {
    await db.query("insert into public.riders values($1,null,180,$2,$3,0)",[id(n),weight,baseline]);
    await ratingInsert(300000+n,id(n),id(100),50,95);
  }
  await db.exec(`insert into public.youth_scouting_candidates values('${id(330)}',null,'rouleur',180,55,'steady',0);
    insert into public.youth_academy_riders values('${id(430)}','${id(330)}',null,'rouleur',180,55,'steady',0,null)`);
  const beforeUnderLedger = (await db.query("select * from public.rider_weight_events order by id")).rows;
  const beforeUnderState = (await db.query("select * from public.untouched_state")).rows;
  const underMigration = await readFile("supabase/migrations/20261008163000_normalize_initial_power_underweight.sql","utf8");
  await db.exec(underMigration);
  const corrected = await readRider(30);
  assert.equal(Number(corrected.baseline_weight_kg),getRiderMinimumPowerWeight("sprinter",180).typicalWeightKg);
  assert.equal(Math.round((Number(corrected.weight_kg)-Number(corrected.baseline_weight_kg))*10)/10,-0.6);
  assert.equal(Number((await readRider(31)).weight_kg),72.8,"a paid cut from a healthy baseline is preserved");
  assert.equal(Number((await readRider(31)).baseline_weight_kg),73);
  assert.deepEqual((await db.query("select * from public.rider_weight_events order by id")).rows,beforeUnderLedger);
  assert.deepEqual((await db.query("select * from public.untouched_state")).rows,beforeUnderState);
  assert.equal(Number((await db.query("select adult_weight_kg from public.youth_scouting_candidates where id=$1",[id(330)])).rows[0].adult_weight_kg),71.6);
  assert.equal(Number((await db.query("select adult_weight_kg from public.youth_academy_riders where id=$1",[id(430)])).rows[0].adult_weight_kg),71.6);
  const underDistribution = (await db.query(`with samples as materialized (
      select p.profile,h.height,
        public.generate_rider_weight_kg(p.profile,h.height,p.profile || h.height || n) as weight,
        public.get_rider_initial_minimum_power_weight_kg(p.profile,h.height) as minimum,
        public.get_rider_initial_weight_limit_kg(p.profile,h.height) as maximum
      from unnest($1::text[]) p(profile) cross join (values(154::numeric),(170),(180),(202)) h(height)
        cross join generate_series(1,1000) s(n))
    select profile,height,count(*) filter(where weight<minimum)::integer as under,
      count(*) filter(where weight>maximum)::integer as over,
      count(distinct weight) filter(where weight<=maximum)::integer as healthy_variety
    from samples group by profile,height`,[profiles])).rows;
  for (const row of underDistribution) {
    assert.equal(row.under,0);assert.ok(row.over>=25 && row.over<=75);
    if (["rouleur","northern_classics","sprinter"].includes(row.profile))
      assert.ok(row.healthy_variety>=15,"healthy power specialists retain varied builds at every height");
  }
  for (const profile of ["rouleur","northern_classics","sprinter"]) for (const height of [154,170,180,202]) {
    const sql = (await db.query("select public.get_rider_initial_minimum_power_weight_kg($1,$2) as minimum",[profile,height])).rows[0];
    assert.equal(Number(sql.minimum),getRiderMinimumPowerWeight(profile,height).minimumWeightKg);
  }
  for (const [n,ratingFirst] of [[32,true],[33,false]]) {
    await db.exec(`insert into public.riders values('${id(n)}',null,null,null,null,null);
      insert into public.youth_academy_riders values('${id(400+n)}','${id(330)}',null,'climber',180,55,'steady',1,null)`);
    if (ratingFirst) await ratingInsert(310000+n,id(n),id(100),50,95);
    await db.query("update public.youth_academy_riders set promoted_rider_id=$1 where id=$2",[id(n),id(400+n)]);
    if (!ratingFirst) await ratingInsert(310000+n,id(n),id(100),50,95);
    assert.equal(Number((await readRider(n)).weight_kg),getRiderMinimumPowerWeight("sprinter",180).typicalWeightKg,
      "actual professional native notes win over a youth archetype in both promotion orders");
  }
  await db.query("update public.riders set weight_kg=65 where id=$1",[id(31)]);
  await ratingInsert(320000,id(31),id(101),50,95);
  assert.equal(Number((await readRider(31)).weight_kg),65,"season renewal never erases a player's weight programme");
  assert.deepEqual(await readRider(rareRiderNumber),rareBirth,"rare overweight remains a valid birth trait");
  const beforeUnderRetry = (await db.query("select * from public.riders order by id")).rows;
  await db.exec(underMigration);
  assert.deepEqual((await db.query("select * from public.riders order by id")).rows,beforeUnderRetry);
  console.log("PASS: zero initial power underweight, native-profile correction to average, preserved real weight deltas/history/form/cash, SQL/UI boundaries, 32,000 births with retained 5% excess, promotion both orders, renewals and idempotent recovery audit.");
} finally { await db.close(); }
