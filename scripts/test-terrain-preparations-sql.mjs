import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Called only inside the existing ephemeral PGlite harness. Catalog metadata is
// captured separately into a checked-in fixture; this file has no network.
export async function testTerrainPreparations({ database, reset, start, rejected, test, TEAM, RIDERS, START, GAME_DAY }) {
  const schema = JSON.parse(await readFile(new URL("./fixtures/terrain-preparation-schema-20261022.json", import.meta.url), "utf8"));
  await reset();
  await database.exec(`
    set check_function_bodies = off;
    create table public.infrastructure_projects (infrastructure_code text);
    create table public.team_infrastructure_specializations (
      team_id uuid, infrastructure_code text, active_specialization_code text,
      pending_specialization_code text, effective_game_day_index integer,
      primary key (team_id, infrastructure_code)
    );
  `);
  const constraintNames = new Set([
    "team_infrastructures_code_allowed", "infrastructure_projects_code_allowed",
    "rider_form_camps_type_allowed", "rider_form_camps_gain_allowed",
    "rider_performance_preparations_preparation_type_check", "rider_performance_preparations_rating_bonus_check",
  ]);
  for (const constraint of schema.constraints.filter(c => constraintNames.has(c.conname))) {
    assert.match(constraint.table_name, /^[a-z_]+$/);
    assert.match(constraint.conname, /^[a-z_]+$/);
    await database.exec(`alter table public.${constraint.table_name} drop constraint if exists ${constraint.conname};
      alter table public.${constraint.table_name} add constraint ${constraint.conname} check (${constraint.expression});`);
  }
  for (const fn of schema.functions) {
    // Keep the test architect multiplier; all other current production function
    // bodies compile locally, including recent cancellation and finance guards.
    if (!fn.signature.startsWith("get_team_infrastructure_efficiency_multiplier(")) await database.exec(fn.definition);
  }
  const migration = await readFile(new URL("../supabase/migrations/20261022110000_add_terrain_preparation_facilities.sql", import.meta.url), "utf8");
  await database.exec(migration);
  await database.exec("set check_function_bodies = on;");
  await test("terrain migration is idempotent without changing bookings or ratings", async () => {
    const before = (await database.query("select * from public.riders order by id")).rows;
    await database.exec(migration);
    assert.deepEqual((await database.query("select * from public.riders order by id")).rows, before);
  });
  const types = ["cobbles_center", "hills_circuit", "mountain_base"];
  const prefix = ["cobbles", "hills", "mountain"];
  const costs = [[150000, 375000, 750000, 1300000, 2000000], [450000, 950000, 1650000, 2650000, 4000000], [500000, 1050000, 1850000, 2950000, 4400000]];
  async function prepare({ type, level = 5, orientation = null, multiplier = 1 } = {}) {
    await reset({ level, multiplier });
    await database.exec("truncate public.team_infrastructure_specializations");
    await database.query("insert into public.team_infrastructures values ($1, $2, $3)", [TEAM, type, level]);
    if (orientation) await database.query("insert into public.team_infrastructure_specializations(team_id,infrastructure_code,active_specialization_code) values ($1,$2,$3)", [TEAM, type, orientation]);
  }
  for (let index = 0; index < types.length; index++) {
    const type = types[index];
    await test(`${type}: prices, durations and all nine orientation choices agree with the catalog`, async () => {
      for (let level = 1; level <= 5; level++) {
        const { rows } = await database.query("select public.get_team_infrastructure_base_cost($1,$2) cost, public.get_team_infrastructure_base_duration_days($1,$2) days", [type, level]);
        assert.equal(Number(rows[0].cost), costs[index][level - 1]);
        assert.equal(rows[0].days, (index === 0 ? [7,11,16,22,28] : [9,14,20,27,35])[level - 1]);
      }
      for (const suffix of ["precision", "durability", "group"]) {
        assert.equal((await database.query("select public.is_valid_team_infrastructure_specialization($1,$2) valid", [type, `${prefix[index]}_${suffix}`])).rows[0].valid, true);
      }
      assert.equal((await database.query("select public.is_valid_team_infrastructure_specialization($1,'pure_speed') valid", [type])).rows[0].valid, false);
    });
    await test(`${type}: each orientation is snapshotted at every level, including architect`, async () => {
      for (let level = 1; level <= 5; level++) {
        for (const suffix of ["precision", "durability", "group"]) {
          await prepare({ type, level, orientation: `${prefix[index]}_${suffix}`, multiplier: 1.1 });
          const base = [{bonus:1,days:3,capacity:1},{bonus:1.5,days:4,capacity:1},{bonus:2,days:4,capacity:2},{bonus:2.5,days:5,capacity:2},{bonus:3,days:6,capacity:3}][level-1];
          const power = level < 3 ? 0 : level === 3 ? 0.6 : level === 4 ? 0.8 : 1;
          const row = await start(RIDERS[0], type);
          assert.equal(Number(row.rating_bonus), Math.round((base.bonus + (suffix === 'precision' ? 0.5 * power : 0)) * 110) / 100);
          assert.equal(row.bonus_start_game_day, START);
          assert.equal(row.bonus_end_game_day, START + base.days + (suffix === 'durability' ? Math.floor(2 * power) : 0) - 1);
          assert.equal(row.preparation_end_game_day - row.preparation_start_game_day + 1, 2);
          const camp = (await database.query("select * from public.rider_form_camps where id=$1", [row.form_camp_id])).rows[0];
          assert.equal(camp.camp_type, `${prefix[index]}_preparation`);
          assert.equal(Number(camp.total_price), 0);
          assert.equal(Number(camp.form_gain_per_day), 0);
          const immutable = { ...row };
          await database.query("update public.team_infrastructure_specializations set active_specialization_code=$1 where team_id=$2", [`${prefix[index]}_group`, TEAM]);
          assert.deepEqual((await database.query("select * from public.rider_performance_preparations where id=$1", [row.id])).rows[0], immutable);
        }
      }
    });
    await test(`${type}: group capacity, cross-building conflict and cancellation use existing protections`, async () => {
      await prepare({ type, level: 3, orientation: `${prefix[index]}_group` });
      const first = await start(RIDERS[0], type);
      await rejected("indisponible", RIDERS[0], "indoor_track");
      await start(RIDERS[1], type);
      await start(RIDERS[2], type);
      await rejected("Toutes les places", RIDERS[3], type);
      await database.query("update public.rider_form_camps set status='cancelled' where id=$1", [first.form_camp_id]);
      assert.equal((await database.query("select status from public.rider_performance_preparations where id=$1", [first.id])).rows[0].status, "cancelled");
      await start(RIDERS[3], type);
    });
    await test(`${type}: pending orientations become effective on exactly the existing transition day`, async () => {
      await prepare({ type, level: 5 });
      await database.query("insert into public.team_infrastructure_specializations values ($1,$2,null,$3,$4)", [TEAM, type, `${prefix[index]}_precision`, GAME_DAY + 1]);
      assert.equal(Number((await start(RIDERS[0], type)).rating_bonus), 3);
      await database.query("update public.team_infrastructure_specializations set effective_game_day_index=$1", [GAME_DAY]);
      assert.equal(Number((await start(RIDERS[1], type)).rating_bonus), 3.5);
    });
  }
  await test("old track bonus cap remains 3.3 and unknown facilities cannot bypass type checks", async () => {
    await reset();
    await rejected("Type de préparation invalide", RIDERS[0], "unknown");
    await assert.rejects(() => database.query("insert into public.rider_performance_preparations(preparation_type,building_level,rating_bonus) values ('indoor_track',5,3.85)"), /rating_bonus_check/);
  });
}
