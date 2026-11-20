import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const team = id(1), season = id(2), user = id(3);
const read = async (name) => (await readFile(new URL("../supabase/migrations/" + name, import.meta.url), "utf8")).replaceAll("\r\n", "\n");
let assertions = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); assertions++; };
const alert = async () => (await db.query("select * from public.get_current_fan_club_assistant_summary_v2()")).rows[0];

try {
  await db.exec(`
    create role authenticated;
    create role anon;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$
      select nullif(current_setting('app.user',true),'')::uuid
    $$;
    create table sporting_directors (id uuid, auth_user_id uuid, status text);
    create table team_manager_assignments (sporting_director_id uuid,team_id uuid,role text,status text);
    create table seasons (id uuid,game_year integer,current_day_number integer,status text);
    create table team_infrastructures (team_id uuid,infrastructure_code text,level integer);
    create table fan_club_shop_inventory (team_id uuid,product_code text,quantity integer,collector_season_id uuid);
    create table fan_club_profiles (team_id uuid,last_settled_game_day integer);
    create table fan_club_shop_sales (team_id uuid,season_id uuid,day_number integer,units_sold integer,revenue numeric);
    create table race_results (race_edition_id uuid,race_roster_id uuid,status text,final_rank integer);
    create table race_editions (id uuid,season_id uuid,race_id uuid);
    create table races (id uuid,slug text);
    create table race_rosters (id uuid,race_registration_id uuid);
    create table race_registrations (id uuid,team_season_id uuid);
    create table team_seasons (id uuid,team_id uuid,season_id uuid);
    insert into sporting_directors values ('${id(4)}','${user}','active');
    insert into team_manager_assignments values ('${id(4)}','${team}','general_manager','active');
    insert into seasons values ('${season}',5,15,'active');
    insert into team_infrastructures values ('${team}','club_shop',1);
    insert into fan_club_shop_inventory values ('${team}','team-jersey',100,null);
    insert into fan_club_profiles values ('${team}',154);
    insert into fan_club_shop_sales values ('${team}','${season}',15,4,48);
    select set_config('app.user', '${user}', false);
  `);
  const operations = await read("20260811120000_create_fan_club_operations.sql");
  const collectors = await read("20260824123000_add_gt_collector_jerseys.sql");
  const original = await read("20260905101500_schedule_daily_fan_club_shop_sales.sql");
  for (const [source, name] of [
    [operations, "current_fan_club_team_id"],
    [collectors, "get_fan_club_shop_product_config"],
    [collectors, "team_won_fan_club_collector_gt"],
    [original, "get_current_fan_club_assistant_summary"],
  ]) {
    const match = source.match(new RegExp("create or replace function public\\." + name + "\\([\\s\\S]*?\\$\\$;"));
    if (!match) throw new Error("Missing source function " + name);
    await db.exec(match[0]);
  }
  await db.exec(await read("20261120100000_alert_each_empty_shop_product.sql"));
  check((await alert()).out_of_stock_products, []);
  await db.exec("update team_infrastructures set level=2");
  check((await alert()).out_of_stock_products, ["bottle"]);
  await db.exec(`insert into fan_club_shop_inventory values ('${team}','bottle',0,null)`);
  check((await alert()).out_of_stock_products, ["bottle"]);
  await db.exec("update fan_club_shop_inventory set quantity=50 where product_code='bottle'");
  check((await alert()).out_of_stock_products, []);
  for (const [code, level] of [["pennant",3], ["cap",4], ["supporter-balloon",5]]) {
    await db.exec(`update team_infrastructures set level=${level}`);
    check((await alert()).out_of_stock_products, [code]);
    await db.exec(`insert into fan_club_shop_inventory values ('${team}','${code}',10,null)`);
  }
  for (const code of ["team-jersey","bottle","pennant","cap","supporter-balloon"]) {
    await db.exec(`update fan_club_shop_inventory set quantity=0 where product_code='${code}'`);
    check((await alert()).out_of_stock_products, [code]);
    await db.exec(`update fan_club_shop_inventory set quantity=100 where product_code='${code}'`);
  }
  await db.exec(`insert into races values ('${id(10)}','boucle-des-provinces');
    insert into race_editions values ('${id(11)}','${season}','${id(10)}');
    insert into team_seasons values ('${id(12)}','${team}','${season}');
    insert into race_registrations values ('${id(13)}','${id(12)}');
    insert into race_rosters values ('${id(14)}','${id(13)}');
    insert into race_results values ('${id(11)}','${id(14)}','classified',1);`);
  check((await alert()).out_of_stock_products, ["collector-jersey-france"]);
  await db.exec(`insert into fan_club_shop_inventory values ('${team}','collector-jersey-france',10,'${id(99)}')`);
  check((await alert()).out_of_stock_products, ["collector-jersey-france"]);
  await db.exec(`update fan_club_shop_inventory set collector_season_id='${season}' where product_code='collector-jersey-france'`);
  check((await alert()).out_of_stock_products, []);
  await db.exec("update fan_club_shop_inventory set quantity=0 where product_code='collector-jersey-france'");
  check((await alert()).out_of_stock_products, ["collector-jersey-france"]);
  for (const [slug, code] of [
    ["corsa-delle-regioni", "collector-jersey-italy"],
    ["ruta-de-las-sierras", "collector-jersey-spain"],
  ]) {
    await db.exec(`update races set slug='${slug}'`);
    check((await alert()).out_of_stock_products, [code]);
  }
  const report = await alert();
  check(report.today_units_sold, 4);
  check(Number(report.today_revenue), 48);
  await db.exec("update team_infrastructures set level=0");
  check((await alert()).out_of_stock_products, []);
  await db.exec(`select set_config('app.user','${id(98)}',false)`);
  check((await db.query("select * from public.get_current_fan_club_assistant_summary_v2()")).rows, []);
  const privileges = (await db.query(`select
    has_function_privilege('authenticated','public.get_current_fan_club_assistant_summary_v2()','execute') as allowed,
    has_function_privilege('anon','public.get_current_fan_club_assistant_summary_v2()','execute') as anonymous`)).rows[0];
  check(privileges, {allowed:true, anonymous:false});
  console.log(JSON.stringify({ assertions, allProductsAndCollectorsCovered:true }));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
