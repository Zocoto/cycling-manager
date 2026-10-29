// Invoked only by the isolated PostgreSQL R&D harness. No network access.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

export async function verifyRndModerateSuccess(db, { uuid, scalar, check }) {
  const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
  const source = 'artifacts/rnd-moderate-success-20261029/production-functions-before.json';
  if (existsSync(source)) {
    for (const fn of JSON.parse(readFileSync(source, 'utf8'))) await db.exec(fn.definition);
  }
  await db.exec('create schema if not exists private');
  const before = await rows('select * from equipment_rnd_projects order by id');
  const stock = await rows('select * from team_equipment_inventory order by equipment_item_id');
  await db.exec(readFileSync('supabase/migrations/20261029110000_add_engineer_moderate_success.sql', 'utf8'));
  check(await rows('select * from equipment_rnd_projects order by id'), before);
  check(await rows('select * from team_equipment_inventory order by equipment_item_id'), stock);

  check((await rows('select private.equipment_rnd_moderate_success_chance(i) n from generate_series(1,5) i')).map(r => r.n), [5,10,15,20,25]);
  const signature = 'text,integer,integer,numeric,numeric,double precision,double precision,double precision,double precision';
  const resolve = (focus, total, quality, split, primary = 0, secondary = 0) =>
    scalar('select private.resolve_equipment_rnd_success($1,50,$2,1,25,$3,$4,$5,$6) as value', [focus,total,quality,split,primary,secondary]);
  const groups = {
    mountain: [['mountain'],['endurance','resistance','recovery','downhill']],
    hills: [['hills','acceleration'],['resistance','endurance','breakaway']],
    cobbles: [['cobbles','resistance'],['flat','endurance','acceleration']],
    plain: [['flat','sprint','timeTrial'],['acceleration','endurance','prologue']],
  };
  for (const [focus, [primary, secondary]] of Object.entries(groups)) {
    for (const split of [0, 0.5, 0.999999]) {
      const result = await resolve(focus, 3, 0.05, split, 0.999999, 0.999999);
      check(result.delta, 2);check(result.moderate, true);check(primary.includes(result.ratingKey), true);
      if (split < 0.5) check(result.secondRatingKey, null);
      else {check([...primary,...secondary].includes(result.secondRatingKey), true);check(result.secondRatingKey !== result.ratingKey, true);}
    }
  }
  check((await resolve(null, 3, 0.05, 0.9)).secondRatingKey !== null, true);
  check((await resolve('mountain', 7, 0, 0)).delta, 3);
  check((await resolve('mountain', 8, 0, 0.9)).delta, 2);
  const capped = await resolve('mountain', 9, 0, 0.9);
  check(capped.delta, 1);check(capped.secondRatingKey, null);
  check((await resolve('mountain', 3, 0.9, 0)).delta, 1);
  for (let level = 1; level <= 5; level++) {
    const counts = await rows(`select (r->>'delta')::int delta, count(*)::int n
      from (select private.resolve_equipment_rnd_success(null,50,0,1,$1,
        (i+0.5)/10000.0,0,0,0) r from generate_series(0,9999) i) samples group by 1`, [level*5]);
    check(counts.find(r=>r.delta===3).n, 200); // 2% of successes => 1% per trial at 50% success.
    check(counts.find(r=>r.delta===2).n, level*500);
  }
  await assert.rejects(() => resolve('invalid', 0, 0.1, 0), /Orientation/);
  await assert.rejects(() => resolve(null, 0, 1, 0), /invalides/);
  await db.exec('set role authenticated');
  await assert.rejects(() => resolve(null, 0, 0.1, 0), /permission denied/);
  await db.exec('reset role');

  // Force quality/split rolls ONLY inside this isolated fixture. All outcome,
  // cap, focus and payload logic still runs through the real reviewed helper.
  await db.exec(`alter function private.resolve_equipment_rnd_success(${signature}) rename to resolve_equipment_rnd_success_test_original;
    create function private.resolve_equipment_rnd_success(${signature}) returns jsonb language plpgsql as $$
    begin
      if current_setting('test.rnd.forbid_new',true)='yes' then raise exception 'New rules called for a legacy launch'; end if;
      return private.resolve_equipment_rnd_success_test_original($1,$2,$3,$4,$5,
        current_setting('test.rnd.quality')::double precision,
        current_setting('test.rnd.split')::double precision,0,0);
    end $$;
    set test.rnd.quality='0.05';set test.rnd.split='0';set test.rnd.protection='no';
    update staff_members set level=2 where id='${uuid(60)}';
    update staff_contracts set status='active' where id='${uuid(70)}';`);
  let counter = 300;
  const launch = async (focus, total=2) => {
    const item=uuid(counter++);
    await db.query(`insert into equipment_catalog_items(id,name,slot_type,status,effect_payload,acquisition_channel,effect_summary)
      values($1,'Moderate fixture','frame','active',$2,'commercial','Original')`, [item,JSON.stringify({ratingBonuses:{mountain:total-1},timeTrialRatingBonuses:{timeTrial:1},specialAbilityMultipliers:{locomotive:1.2}})]);
    await db.query('insert into team_equipment_inventory values($1,$2,1,0)', [uuid(40),item]);
    return scalar('select start_current_team_equipment_rnd($1,$2,$3,$4) as value',[item,uuid(70),'Moderate prototype',focus]);
  };
  const finish = async (project, success=100) => {
    await db.query('update equipment_rnd_projects set success_rate=$2 where id=$1',[project,success]);
    await db.query('update seasons set current_day_number=(select completes_game_day_index-2026*28+1 from equipment_rnd_projects where id=$1)',[project]);
    check(await scalar('select settle_due_equipment_rnd_projects() as value'),1);
    check(await scalar('select settle_due_equipment_rnd_projects() as value'),0);
    const result=(await rows('select * from equipment_rnd_projects where id=$1',[project]))[0];
    const inventory=await rows('select quantity from team_equipment_inventory where equipment_item_id=$1',[result.prototype_equipment_item_id]);
    check(inventory.map(r=>r.quantity),[1]);
    check(result.output_effect_payload.timeTrialRatingBonuses,{timeTrial:1});
    check(result.output_effect_payload.specialAbilityMultipliers,{locomotive:1.2});
    check(await scalar('select calculate_equipment_rnd_bonus_total($1) as value',[result.output_effect_payload])<=10,true);
    return result;
  };
  for (const [focus,[primary,secondary]] of Object.entries(groups)) {
    for (const split of [0,0.9]) {
      await db.query('select set_config($1,$2,false)',['test.rnd.split',String(split)]);
      const project=await launch(focus);
      const frozen=(await rows('select engineer_snapshot from equipment_rnd_projects where id=$1',[project]))[0].engineer_snapshot;
      check(frozen.moderateSuccessChancePercentage,10);
      const result=await finish(project);
      check(result.rating_delta,2);
      const changes=Object.entries(result.output_effect_payload.ratingBonuses).flatMap(([key,value])=>{
        const delta=value-(result.input_effect_payload.ratingBonuses[key]??0);return delta ? [[key,delta]] : [];
      });
      check(changes.length,split===0?1:2);check(changes.reduce((sum,[,value])=>sum+value,0),2);
      check(changes.every(([key])=>[...primary,...secondary].includes(key)),true);
      if(split>0) check(changes.every(([,value])=>value===1),true);
      const summary=await scalar('select effect_summary as value from equipment_catalog_items where id=$1',[result.prototype_equipment_item_id]);
      check(summary.includes(split===0?'+2':'+1 '+primary[0]+' / +1 '),true);
    }
  }
  // Snapshot remains authoritative even if the engineer levels up or leaves.
  const frozenProject=await launch('mountain');
  await db.exec(`update staff_members set level=5 where id='${uuid(60)}';update staff_contracts set status='inactive' where id='${uuid(70)}'`);
  check((await finish(frozenProject)).engineer_snapshot.moderateSuccessChancePercentage,10);
  await db.exec(`update staff_contracts set status='active' where id='${uuid(70)}'`);
  check((await scalar('select equipment_rnd_engineer_profile($1) as value',[uuid(70)])).moderateSuccessChancePercentage,25);
  await db.exec("set test.rnd.quality='0'");
  check((await finish(await launch('mountain',7))).rating_delta,3);
  check((await finish(await launch('mountain',8))).rating_delta,2);
  check((await finish(await launch('mountain',9))).rating_delta,1);
  await db.exec("set test.rnd.quality='0.9'");
  check((await finish(await launch('mountain'))).rating_delta,1);
  check((await finish(await launch('mountain'),0)).rating_delta,-1);
  await db.exec("set test.rnd.protection='yes'");
  const protectedResult=await finish(await launch('mountain'),0);
  check(protectedResult.rating_delta,0);check(protectedResult.input_effect_payload,protectedResult.output_effect_payload);
  const oldProject=await launch('mountain');
  await db.query("update equipment_rnd_projects set engineer_snapshot=engineer_snapshot-'moderateSuccessChancePercentage' where id=$1",[oldProject]);
  await db.exec("set test.rnd.forbid_new='yes'");
  check([1,3].includes((await finish(oldProject)).rating_delta),true);
  await db.exec("set test.rnd.forbid_new='no'");
}
