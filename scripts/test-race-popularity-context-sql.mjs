import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

if (!process.argv[2]) throw new Error("Pass the local PGlite module path.");
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let assertions = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); assertions++; };
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table public.countries(id uuid primary key,iso_alpha2 text);
    create table public.team_seasons(team_id uuid,season_id uuid,registration_country_id uuid,status text);
    create table public.team_infrastructures(team_id uuid,infrastructure_code text,level integer);
    create table public.team_infrastructure_specializations(team_id uuid,infrastructure_code text,active_specialization_code text);
    create function public.get_active_team_staff_talent_strength(p_team_id uuid,p_talent_code text,p_points_per_level numeric)
    returns numeric language sql stable as $$
      select case when p_team_id='${id(1)}' and p_talent_code='community_rider_popularity_and_fans' and p_points_per_level=3 then 13.2 else 0 end::numeric
    $$;
    insert into public.countries values ('${id(20)}','FR');
    insert into public.team_seasons values ('${id(1)}','${id(10)}','${id(20)}','active'),
      ('${id(2)}','${id(10)}','${id(20)}','planned'),
      ('${id(3)}','${id(10)}','${id(20)}','completed'),
      ('${id(1)}','${id(11)}','${id(20)}','active');
    insert into public.team_infrastructures values ('${id(1)}','fan_club_headquarters',3),('${id(1)}','staff_academy',5);
    insert into public.team_infrastructure_specializations values ('${id(1)}','fan_club_headquarters','event_house');
  `);
  const migration = await readFile(new URL("../supabase/migrations/20261120150100_race_popularity_context.sql", import.meta.url), "utf8");
  await db.exec(migration);
  await db.exec("set role service_role");
  const rows = (await db.query(`select * from public.get_race_team_popularity_context(array['${id(1)}','${id(2)}','${id(3)}','${id(1)}']::uuid[], '${id(10)}') order by team_id`)).rows;
  check(rows.length, 2);
  check(rows[0], {
    team_id: id(1), registration_country_code: "FR", community_growth_bonus_percentage: "13.2",
    headquarters_level: 3, active_specialization_code: "event_house",
  });
  check(rows[1], {
    team_id: id(2), registration_country_code: "FR", community_growth_bonus_percentage: "0",
    headquarters_level: 0, active_specialization_code: null,
  });
  check((await db.query(`select * from public.get_race_team_popularity_context('{}'::uuid[],'${id(10)}')`)).rows, []);
  check((await db.query(`select * from public.get_race_team_popularity_context(array['${id(2)}']::uuid[],'${id(11)}')`)).rows, []);
  await db.exec("reset role; set role authenticated");
  await assert.rejects(db.query(`select * from public.get_race_team_popularity_context(array['${id(1)}']::uuid[],'${id(10)}')`), /permission denied/);
  assertions++;
  await db.exec("reset role; set role anon");
  await assert.rejects(db.query(`select * from public.get_race_team_popularity_context(array['${id(1)}']::uuid[],'${id(10)}')`), /permission denied/);
  assertions++;
  console.log(JSON.stringify({ isolated: true, productionActions: false, assertions }));
} finally {
  await db.close();
}

