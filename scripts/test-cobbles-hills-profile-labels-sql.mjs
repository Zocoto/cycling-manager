// Isolated PostgreSQL/WASM only: no credentials, network or production writes.
// Optional argv[3] loads the read-only production function capture for drift QA.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.argv[2] ?? resolve("artifacts/.tmp-performance-preparations/node_modules/@electric-sql/pglite/dist/index.js");
const captureDirectory = process.argv[3];
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const migrationPath = "supabase/migrations/20261128150000_refine_cobbles_hills_profile_labels.sql";
const migration = readFileSync(migrationPath, "utf8");
const read = path => readFileSync(path, "utf8").replaceAll("\r", "");
const id = value => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
let checks = 0;
function check(actual, expected, message) { assert.deepEqual(actual, expected, message); checks++; }
function functionSource(file, name) {
  const source = read(file);
  const start = source.toLowerCase().indexOf(`create or replace function ${name.toLowerCase()}(`);
  assert.ok(start >= 0, `Missing source for ${name}`);
  const bodyStart = source.indexOf("$$", start);
  return source.slice(start, source.indexOf("$$;", bodyStart + 2) + 3);
}
function capturedOrSource(captureName, migrationName, functionName) {
  return captureDirectory ? read(resolve(captureDirectory, captureName))
    : functionSource(`supabase/migrations/${migrationName}.sql`, functionName);
}
const federationFile = "20260914100000_rebuild_federation_race_workflow";
const hybridFile = "20261104160000_expand_s5_hilly_cobbled_calendar";
const sources = {
  preserve: capturedOrSource("trigger-function-private.preserve_federation_race_stage_schedule_.sql", federationFile, "private.preserve_federation_race_stage_schedule"),
  materialize: capturedOrSource("function-private.materialize_national_federation_race_uuid_.sql", federationFile, "private.materialize_national_federation_race"),
  writer: capturedOrSource("function-private.write_s5_hybrid_classic_route_uuid_text_.sql", hybridFile, "private.write_s5_hybrid_classic_route"),
  hybrid: capturedOrSource("function-private.apply_s5_hybrid_calendar_uuid_.sql", hybridFile, "private.apply_s5_hybrid_calendar"),
  opening: capturedOrSource("trigger-function-private.enforce_future_season_opening_day_.sql", "20261009190000_reserve_future_season_opening_day", "private.enforce_future_season_opening_day"),
  international: capturedOrSource("trigger-function-private.guard_s6_international_calendar_day_.sql", "20261128120000_reserve_s6_international_calendar_days", "private.guard_s6_international_calendar_day"),
};

await db.exec(`
  set time zone 'UTC';
  create schema private;
  create role anon; create role authenticated;
  create table public.seasons(id uuid primary key,game_year integer,status text,current_day_number integer default 10);
  create table public.season_days(id uuid primary key default gen_random_uuid(),season_id uuid,day_number integer,calendar_date date,
    unique(season_id,day_number));
  create table public.countries(id uuid primary key,iso_alpha2 text);
  create table public.race_categories(id uuid primary key,code text,is_active boolean default true);
  create table public.races(id uuid primary key default gen_random_uuid(),country_id uuid,name text,short_name text,
    race_format text default 'one_day',status text default 'active',slug text unique,competition_type text default 'standard',
    is_monument boolean default false,is_grand_tour boolean default false);
  create table public.race_editions(id uuid primary key default gen_random_uuid(),race_id uuid,season_id uuid,race_category_id uuid,
    status text default 'registration_open',edition_number integer,display_name text,minimum_reputation numeric,
    registration_policy text,field_limit integer,registration_closes_at timestamptz,withdrawal_closes_at timestamptz,
    unique(race_id,season_id));
  create table public.stages(id uuid primary key default gen_random_uuid(),race_edition_id uuid,season_day_id uuid,
    stage_number integer default 1,name text default 'Original name',stage_type text default 'road',
    profile_type text default 'hilly',profile_variant text,distance_km numeric,status text default 'planned',
    departure_at timestamptz default '2036-11-10T13:00:00Z',day_slot text default 'early',
    unique(race_edition_id,stage_number));
  create table public.stage_segments(id uuid primary key default gen_random_uuid(),stage_id uuid,segment_number integer,
    distance_km numeric,terrain_type text,surface_type text,average_gradient_pct numeric,unique(stage_id,segment_number));
  create index stage_segments_stage_idx on public.stage_segments(stage_id);
  create table public.stage_results(id uuid primary key default gen_random_uuid(),stage_id uuid);
  create index stage_results_stage_idx on public.stage_results(stage_id);
  create table public.official_stage_simulations(id uuid primary key default gen_random_uuid(),stage_id uuid);
  create index simulations_stage_idx on public.official_stage_simulations(stage_id);
  create table public.race_stage_strategies(stage_id uuid,rider_id uuid,role text,attack_orders jsonb);
  create table public.fixture_registrations(stage_id uuid,rider_id uuid,status text);
  create table public.national_federation_race_projects(id uuid primary key,race_id uuid,status text,
    stage_blueprint jsonb,start_day_number integer,start_day_slot text,activation_game_year integer,race_format text,
    category_code text,race_category_id uuid,country_id uuid,name text,short_name text,approved_at timestamptz,
    gazette_day_number integer,resources_reserved boolean,updated_at timestamptz);
  create table public.cyclogazette_editions(id uuid,season_id uuid,season_day_id uuid);
  create table public.national_federation_journal_entries(country_id uuid,season_id uuid,day_number integer,
    category text,title text,detail text,source_reference text unique);
  create table private.fixture_provision_order(sequence integer generated always as identity,label text);
  create function private.s6_protected_calendar_days(uuid) returns table(day_number integer)
    language sql immutable as $$ select 7; $$;
  create function private.validate_national_federation_race_blueprint(uuid,uuid,text,text,integer,text,jsonb)
    returns void language sql as $$ select; $$;
  create function private.find_free_standard_race_start_day(uuid,uuid,integer,integer,uuid) returns integer
    language sql as $$ select $3; $$;
  create function private.apply_planned_championship_road_rotation(uuid,boolean) returns void language plpgsql as $$
  begin
    insert into private.fixture_provision_order(label) values ('last sporting writer');
    update public.stages set profile_variant='hilly_cobbles' where race_edition_id in
      (select id from public.race_editions where season_id=$1) and name='Provision fixture';
  end; $$;
  insert into public.seasons(id,game_year,status) values
    ('${id(5)}',5,'active'),('${id(6)}',6,'planned'),('${id(4)}',4,'active'),('${id(3)}',3,'completed');
  insert into public.season_days(season_id,day_number,calendar_date)
    select s.id,n,'2036-11-01'::date+n-1 from public.seasons s cross join generate_series(1,28) n;
  insert into public.countries values ('${id(20)}','ZZ'),('${id(21)}','BE');
  insert into public.race_categories(id,code) values ('${id(30)}','world'),('${id(31)}','local'),('${id(32)}','regional');
`);
for (const source of Object.values(sources)) await db.exec(source);
await db.exec(functionSource(`supabase/migrations/${hybridFile}.sql`, "private.s5_hybrid_classic_segments"));
await db.exec(functionSource(`supabase/migrations/${hybridFile}.sql`, "private.apply_s5_local_hybrid_profiles"));
// Keep real generation/writer functions, but omit the unrelated five authored
// race insertions from this fixture: those route shapes are tested separately.
await db.exec(`create function private.s5_hybrid_classic_plan()
  returns table(slug text,race_name text,short_name text,country_code text,category_code text,
    preferred_day integer,first_slot text,distance numeric,shape text)
  language sql as $$ select null::text,null::text,null::text,null::text,null::text,
    null::integer,null::text,null::numeric,null::text where false; $$;`);
if (captureDirectory) {
  // Creating the complete captured provisioning function verifies patch drift
  // without emulating the hundreds of unrelated calendar dependencies it calls.
  await db.exec(read(resolve(captureDirectory, "function-provision_season_race_calendar_uuid_uuid_.sql")));
} else {
  // Same terminal live anchor. Its sporting write deliberately dirties the
  // label, so invoking the real patched hook must restore it after generation.
  await db.exec(`create function public.provision_season_race_calendar(p_source_season_id uuid,p_target_season_id uuid)
  returns void language plpgsql as $$
begin
  perform private.apply_planned_championship_road_rotation(p_target_season_id, false);
end;
$$;`);
}
await db.exec(`
  create trigger preserve_federation_race_stage_schedule before insert or update on public.stages
    for each row execute function private.preserve_federation_race_stage_schedule();
  create constraint trigger enforce_future_season_opening_day after insert or update on public.stages
    deferrable initially deferred for each row execute function private.enforce_future_season_opening_day();
  create constraint trigger guard_s6_international_calendar_day after insert or update on public.stages
    deferrable initially deferred for each row execute function private.guard_s6_international_calendar_day();
`);
const definitionsBefore = (await db.query(`select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('private','public') and p.proname in
  ('preserve_federation_race_stage_schedule','write_s5_hybrid_classic_route','apply_s5_hybrid_calendar',
  'provision_season_race_calendar','materialize_national_federation_race','guard_s6_international_calendar_day','enforce_future_season_opening_day')
  order by signature`)).rows;
const triggersBefore = (await db.query(`select tgname,pg_get_triggerdef(oid) definition from pg_trigger
  where not tgisinternal order by tgname`)).rows;
await db.exec(migration);
check((await db.query(`select tgname,pg_get_triggerdef(oid) definition from pg_trigger
  where not tgisinternal order by tgname`)).rows, triggersBefore, "All original triggers remain enabled and unchanged");
for (const name of ["guard_s6_international_calendar_day", "enforce_future_season_opening_day"]) {
  const before = definitionsBefore.find(row => row.signature.includes(name));
  check((await db.query("select pg_get_functiondef($1::regprocedure) definition", [before.signature])).rows[0].definition,
    before.definition, `${name} is byte-for-byte unchanged`);
}
const functionsAfter = (await db.query(`select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public') and p.proname in
  ('preserve_federation_race_stage_schedule','write_s5_hybrid_classic_route','apply_s5_hybrid_calendar',
  'provision_season_race_calendar','materialize_national_federation_race') order by signature`)).rows;
check(functionsAfter.every(row => row.definition.includes("profile-label-only update")
  || row.definition.includes("perform private.refresh_cobbles_hills_profile_labels(")), true, "All required future-writer hooks are installed");
check((await db.query(`select has_function_privilege('authenticated',
  'private.refresh_cobbles_hills_profile_labels(uuid,uuid)','execute') allowed`)).rows[0].allowed, false, "Refresh is not a player-callable RPC");

async function classify(overrides = {}) {
  const x = { type: "hilly", variant: "hilly_cobbles", distance: 200, cobbled: 30, ascent: 900,
    cobbledAscent: 600, asphaltAscent: 300, climbs: 5, asphaltClimbs: 2, asphaltKm: 4, final50: 5, ...overrides };
  const result = await db.query(`select private.classify_cobbles_hills_profile_variant(
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) value`, Object.values(x));
  return result.rows[0].value;
}
for (const [label, overrides, expected] of [
  ["actual hybrid", {}, "hilly_cobbles"],
  ["sprint preset", { variant: "sprint_cobbles", cobbled: 120 }, "sprint_cobbles"],
  ["mountain preset", { type: "mountain", cobbled: 120 }, "hilly_cobbles"],
  ["future unrelated preset", { variant: "custom_preset" }, "custom_preset"],
  ["one third exact", { distance: 90, cobbled: 30 }, "selective_cobbles"],
  ["under one third", { distance: 90.01, cobbled: 30 }, "hilly_cobbles"],
  ["all climbing paved Flandres", { distance: 266, cobbled: 127, ascent: 2065, cobbledAscent: 2065, asphaltAscent: 0, asphaltClimbs: 0, asphaltKm: 0 }, "selective_cobbles"],
  ["80 percent ascent exact", { ascent: 500, cobbledAscent: 400, asphaltAscent: 100 }, "selective_cobbles"],
  ["80 percent ascent below", { ascent: 500, cobbledAscent: 399.99, asphaltAscent: 100.01 }, null],
  ["road ascent excludes dominance at 150", { ascent: 750, cobbledAscent: 600, asphaltAscent: 150 }, "hilly_cobbles"],
  ["flat is not climbing-dominant", { ascent: 0, cobbledAscent: 0, asphaltAscent: 0 }, null],
  ["15 km cobbles exact", { distance: 125, cobbled: 15 }, "hilly_cobbles"],
  ["15 km cobbles below", { distance: 125, cobbled: 14.99 }, null],
  ["12 percent exact", { distance: 250, cobbled: 30 }, "hilly_cobbles"],
  ["12 percent below", { distance: 250.01, cobbled: 30 }, null],
  ["450m ascent exact", { ascent: 450, cobbledAscent: 150 }, "hilly_cobbles"],
  ["450m ascent below", { ascent: 449.99, cobbledAscent: 149.99 }, null],
  ["three climbs exact", { climbs: 3 }, "hilly_cobbles"],
  ["three climbs below", { climbs: 2 }, null],
  ["two road climbs below", { asphaltClimbs: 1 }, null],
  ["4km road climbs below", { asphaltKm: 3.99 }, null],
  ["150m road ascent exact", { ascent: 600, cobbledAscent: 450, asphaltAscent: 150 }, "hilly_cobbles"],
  ["150m road ascent below", { ascent: 600, cobbledAscent: 100, asphaltAscent: 149.99 }, null],
  ["5km final cobbles below", { final50: 4.99 }, null],
  ["obsolete cobbled hybrid cleared", { type: "cobbles", final50: 0 }, null],
  ["Arctic distant cobbles", { distance: 198, cobbled: 27, ascent: 2160, cobbledAscent: 0, asphaltAscent: 2160, final50: 0 }, null],
  ["empty variant can gain genuine hybrid", { variant: null }, "hilly_cobbles"],
]) check(await classify(overrides), expected, label);

let next = 100;
const hybridRoute = [
  [130, "flat", "asphalt", 0], [8, "flat", "cobbles", 0],
  [2, "climb", "asphalt", 5], [2, "descent", "asphalt", -5],
  [2, "climb", "asphalt", 5], [2, "descent", "asphalt", -5],
  [4, "climb", "cobbles", 7], [4, "descent", "asphalt", -7],
  [18, "flat", "cobbles", 0], [28, "flat", "asphalt", 0],
];
const dominantRoute = [[100,"flat","asphalt",0],[50,"flat","cobbles",0],[5,"climb","cobbles",6],
  [5,"descent","asphalt",-6],[40,"flat","asphalt",0]];
async function createStage(options = {}) {
  const n = next++;
  const { season = id(6), type = "hilly", variant = "hilly_cobbles", status = "planned", editionStatus = "registration_open",
    competition = "standard", route = hybridRoute, distance = route.reduce((sum, x) => sum + x[0], 0),
    stageType = "road", category = id(30), country = id(20), slug = `fixture-${n}`, day = 10,
    departure = "2036-11-10T13:00:00Z", name = `Fixture ${n}` } = options;
  await db.query("insert into public.races(id,slug,country_id,competition_type,name) values($1,$2,$3,$4,$2)", [id(n),slug,country,competition]);
  await db.query("insert into public.race_editions(id,race_id,season_id,race_category_id,status) values($1,$2,$3,$4,$5)",
    [id(n+1000),id(n),season,category,editionStatus]);
  const dayId = (await db.query("select id from public.season_days where season_id=$1 and day_number=$2",[season,day])).rows[0].id;
  await db.query(`insert into public.stages(id,race_edition_id,season_day_id,profile_type,profile_variant,status,distance_km,stage_type,departure_at,name)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [id(n+2000),id(n+1000),dayId,type,variant,status,distance,stageType,departure,name]);
  await insertSegments(id(n+2000), route);
  await db.query("insert into public.race_stage_strategies values($1,$2,'leader',$3)",
    [id(n+2000),id(n+3000),JSON.stringify([{ segmentNumber: 7, intensity: "strong" }])]);
  await db.query("insert into public.fixture_registrations values($1,$2,'confirmed')", [id(n+2000),id(n+3000)]);
  return id(n+2000);
}
async function insertSegments(stage, route) {
  for (const [index, part] of route.entries()) await db.query(`insert into public.stage_segments(stage_id,segment_number,distance_km,terrain_type,surface_type,average_gradient_pct)
    values($1,$2,$3,$4,$5,$6)`, [stage,index+1,...part]);
}
async function variant(stage) { return (await db.query("select profile_variant value from public.stages where id=$1",[stage])).rows[0].value; }
async function refresh(season = id(6), stage = null) {
  return (await db.query("select private.refresh_cobbles_hills_profile_labels($1,$2) count",[season,stage])).rows[0].count;
}
async function sportingSnapshot() {
  return (await db.query(`select 'stage' kind,id::text key,to_jsonb(t)-'profile_variant' data from public.stages t
    union all select 'segment',id::text,to_jsonb(x) from public.stage_segments x
    union all select 'order',stage_id::text,to_jsonb(o) from public.race_stage_strategies o
    union all select 'registration',stage_id::text,to_jsonb(r) from public.fixture_registrations r
    order by kind,key`)).rows;
}
const dominant = await createStage({route: dominantRoute,type:"cobbles"});
const trueHybrid = await createStage({variant:null});
const distant = await createStage({route:[[20,"flat","cobbles",0],[5,"climb","asphalt",5],[5,"descent","asphalt",-5],
  [5,"climb","asphalt",5],[5,"descent","asphalt",-5],[5,"climb","asphalt",5],[155,"flat","asphalt",0]]});
const tooShort = await createStage({route:dominantRoute,distance:200.06});
const withinTolerance = await createStage({route:dominantRoute,distance:200.05});
const exclusions = [];
for (const options of [
  {status:"completed"}, {editionStatus:"cancelled"}, {season:id(4)}, {season:id(3)},
  {competition:"national_road"}, {competition:"continental_championship"}, {competition:"world_championship"},
  {competition:"nations_cup"}, {stageType:"time_trial"}, {type:"mountain"},
  {season:id(5),departure:"2020-11-10T13:00:00Z"}, {variant:"sprint_cobbles"},
]) exclusions.push(await createStage({route:dominantRoute,...options}));
const simulated = await createStage({route:dominantRoute});
const finished = await createStage({route:dominantRoute});
await db.query("insert into public.official_stage_simulations(stage_id) values($1)",[simulated]);
await db.query("insert into public.stage_results(stage_id) values($1)",[finished]);
exclusions.push(simulated,finished,tooShort);
const previousExcluded = await Promise.all(exclusions.map(variant));
const initialSnapshot = await sportingSnapshot();
check(await refresh(),4,"Only four eligible S6 labels change, including obsolete annotation removal");
check(await variant(dominant),"selective_cobbles","Dominant paved route becomes Pavés");
check(await variant(trueHybrid),"hilly_cobbles","Meaningful paved/road mix remains hybrid");
check(await variant(distant),null,"Old mixed annotation is actively removed");
check(await variant(withinTolerance),"selective_cobbles","Existing complete-route tolerance accepted");
check(await Promise.all(exclusions.map(variant)),previousExcluded,"All frozen/international/mountain/TT/incomplete presets retained");
check(await sportingSnapshot(),initialSnapshot,"IDs, segment numbers, routes, dates, status, registrations and attack orders are byte-for-byte retained");
check(await refresh(),0,"Repeated refresh writes zero rows");

// Contiguous climbing segments count as a single hill, including road-climb
// components. Splitting a slope into tiny pieces must not create a hybrid.
const split = await createStage({route:[[130,"flat","asphalt",0],[4,"climb","cobbles",6],[4,"descent","asphalt",-6],
  [2,"climb","asphalt",5],[2,"climb","asphalt",5],[2,"climb","asphalt",5],[18,"flat","cobbles",0],[38,"flat","asphalt",0]]});
check(await refresh(id(6),split),1,"Split consecutive hills lose the obsolete hybrid label");
check(await variant(split),null,"Adjacent uphill pieces are not independent climbs");
const changingSurface = await createStage({route:[[120,"flat","asphalt",0],
  [2,"climb","asphalt",5],[1,"climb","cobbles",5],[2,"climb","asphalt",5],[5,"descent","asphalt",-5],
  [1,"climb","cobbles",13],[1,"descent","asphalt",-13],[1,"climb","cobbles",13],[1,"descent","asphalt",-13],
  [23,"flat","cobbles",0],[43,"flat","asphalt",0]]});
check(await refresh(id(6),changingSurface),1,"A surface change within one continuous hill cannot satisfy two road climbs");
check(await variant(changingSurface),null,"Road-paved-road portions share the same global climb block");
const slopeBelowThreshold = await createStage({route:hybridRoute.map((x,i) => i===4 ? [2,"climb","asphalt",2.99] : x)});
check(await refresh(id(6),slopeBelowThreshold),1,"A shallow slope does not count as a road hill");
check(await variant(slopeBelowThreshold),null,"Climb-block grade threshold is applied");

// Federation metadata must not resynchronize a stale blueprint. Any genuine
// profile/date/name change still runs the original protected schedule logic.
const federation = await createStage({route:dominantRoute,variant:"hilly_cobbles"});
const federationRace = (await db.query(`select e.race_id from public.stages t join public.race_editions e on e.id=t.race_edition_id
  where t.id=$1`,[federation])).rows[0].race_id;
const blueprint = [{name:"Blueprint protected name",stageType:"road",profileType:"flat",
  segments:[{distanceKm:199,terrainType:"flat",surfaceType:"asphalt",averageGradientPct:0}]}];
await db.query(`insert into public.national_federation_race_projects(id,race_id,status,start_day_number,start_day_slot,stage_blueprint)
  values($1,$2,'scheduled',11,'late',$3)`,[id(9000),federationRace,JSON.stringify(blueprint)]);
const federationBefore = (await db.query("select to_jsonb(t)-'profile_variant' data from public.stages t where id=$1",[federation])).rows[0].data;
check(await refresh(id(6),federation),1,"Metadata refresh can update an existing federation race");
check((await db.query("select to_jsonb(t)-'profile_variant' data from public.stages t where id=$1",[federation])).rows[0].data,
  federationBefore,"Stale federation blueprint cannot alter sporting or schedule fields during label-only UPDATE");
await db.query("update public.stages set profile_type='cobbles',name='Invalid edit',departure_at='2036-11-20T12:00:00Z' where id=$1",[federation]);
check((await db.query("select name,profile_type,distance_km::text,day_slot,departure_at::text from public.stages where id=$1",[federation])).rows[0],
  {name:"Blueprint protected name",profile_type:"flat",distance_km:"199",day_slot:"late",departure_at:"2036-11-11 17:00:00+00"},
  "Real scheduling/profile updates still obey the complete federation guard");

async function expectDatabaseError(sql, parameters, pattern, message) {
  await assert.rejects(db.query(sql,parameters),pattern,message); checks++;
}
const ordinary = await createStage({route:dominantRoute});
const protectedDay = (await db.query("select id from public.season_days where season_id=$1 and day_number=7",[id(6)])).rows[0].id;
const openingDay = (await db.query("select id from public.season_days where season_id=$1 and day_number=1",[id(6)])).rows[0].id;
await expectDatabaseError("update public.stages set season_day_id=$1 where id=$2",[protectedDay,ordinary],/réservée aux sélections/,
  "S6 protected-day trigger still rejects invalid moves");
await expectDatabaseError("update public.stages set season_day_id=$1 where id=$2",[openingDay,ordinary],/J1 est réservé/,
  "J1 opening-day trigger still rejects invalid moves");
const local = await createStage({route:[[148,"flat","asphalt",0]],distance:148,category:id(31),slug:"local-zz-classic-2",variant:null});
await db.query("select private.apply_s5_local_hybrid_profiles($1,$2)",[id(6),id(20)]);
check(await variant(local),"hilly_cobbles","Future local generation refreshes only its fully written stage");
const localSegments = (await db.query("select * from public.stage_segments where stage_id=$1 order by segment_number",[local])).rows;
await db.query("select private.apply_s5_local_hybrid_profiles($1,$2)",[id(6),id(20)]);
check((await db.query("select * from public.stage_segments where stage_id=$1 order by segment_number",[local])).rows,
  localSegments,"Repeat local generation keeps existing segment IDs and numbers");
for (const [shape,distance] of [["rolling",172],["walls",192],["endurance",212]]) {
  const authored = await createStage({route:[[distance,"flat","asphalt",0]],variant:null});
  await db.query("select private.write_s5_hybrid_classic_route($1,$2)",[authored,shape]);
  check(await variant(authored),"hilly_cobbles",`Authored ${shape} layout remains a genuine hybrid`);
}
const bulk = await createStage({route:dominantRoute});
await db.query("select private.apply_s5_hybrid_calendar($1)",[id(6)]);
check(await variant(bulk),"selective_cobbles","Future season hybrid writer no longer restores excessive mixed labels");

if (!captureDirectory) {
  const generated = await createStage({route:dominantRoute,name:"Provision fixture",variant:null});
  await db.query("select public.provision_season_race_calendar($1,$2)",[id(5),id(6)]);
  check(await variant(generated),"selective_cobbles","Provisioning refresh runs after its final sporting writer");
  check((await db.query("select label from private.fixture_provision_order order by sequence")).rows,
    [{label:"last sporting writer"}],"Existing final championship writer is still called once");
}
const projectBlueprint = [{name:"New federation mixed race",stageType:"road",profileType:"hilly",
  segments:hybridRoute.map(([distanceKm,terrainType,surfaceType,averageGradientPct]) => ({distanceKm,terrainType,surfaceType,averageGradientPct}))}];
await db.query(`insert into public.national_federation_race_projects(id,status,start_day_number,start_day_slot,activation_game_year,
  race_format,category_code,race_category_id,country_id,name,short_name,stage_blueprint)
  values($1,'voting',12,'early',6,'one_day','regional',$2,$3,'Future Federation Race','FFR',$4)`,
  [id(9001),id(32),id(21),JSON.stringify(projectBlueprint)]);
const materializedRace = (await db.query("select private.materialize_national_federation_race($1) value",[id(9001)])).rows[0].value;
const materializedStage = (await db.query(`select t.id,t.profile_variant,(select count(*)::integer from public.stage_segments x where x.stage_id=t.id) segments
  from public.stages t join public.race_editions e on e.id=t.race_edition_id where e.race_id=$1`,[materializedRace])).rows[0];
check(materializedStage.profile_variant,"hilly_cobbles","Federation creation classifies after inserting the complete route");
check(materializedStage.segments,hybridRoute.length,"Federation creation keeps every supplied blueprint segment");

// The invariant must fail atomically if a future all-UPDATE trigger silently
// mutates a sporting field. This fixture trigger exists only in isolated WASM.
const protectedSnapshot = await sportingSnapshot();
await db.exec(`create function private.fixture_bad_trigger() returns trigger language plpgsql as $$
  begin new.name := new.name || ' unexpected mutation'; return new; end; $$;
  create trigger zz_fixture_bad_trigger before update on public.stages for each row execute function private.fixture_bad_trigger();`);
await db.query("update public.stages set profile_variant='hilly_cobbles' where id=$1",[ordinary]);
const withBadTriggerSnapshot = await sportingSnapshot();
await expectDatabaseError("select private.refresh_cobbles_hills_profile_labels($1,$2)",[id(6),ordinary],
  /unexpectedly changed sporting/,"Invariant rejects unknown trigger side effects instead of silently altering a race");
check(await sportingSnapshot(),withBadTriggerSnapshot,"Rejected refresh rolls back every attempted side effect");
await db.exec("drop trigger zz_fixture_bad_trigger on public.stages; drop function private.fixture_bad_trigger();");
await db.query("update public.stages set name=$1 where id=$2",[protectedSnapshot.find(x=>x.kind==="stage"&&x.key===ordinary).data.name,ordinary]);
await refresh();
const finalSnapshot = await sportingSnapshot();
await db.exec(migration);
check(await sportingSnapshot(),finalSnapshot,"Rerunning the entire migration preserves every sporting row");
check(await refresh(),0,"Rerun is idempotent after new local and federation races");
check((await db.query(`select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public') and p.proname in
  ('preserve_federation_race_stage_schedule','write_s5_hybrid_classic_route','apply_s5_hybrid_calendar',
  'provision_season_race_calendar','materialize_national_federation_race') order by signature`)).rows,
  functionsAfter,"Future hooks are installed exactly once");
await db.close();
console.log(`Cobbles/hills presentation SQL: ${checks} checks passed${captureDirectory ? " (captured live definitions)" : ""}.`);
