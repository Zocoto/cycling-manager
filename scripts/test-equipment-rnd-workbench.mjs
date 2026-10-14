// Called exclusively from the isolated PGlite R&D harness.
import { readFileSync } from 'node:fs';
export async function verifyRndWorkbench(db,{uuid,scalar,check}) {
  const query=async(sql,args=[]) => (await db.query(sql,args)).rows;
  await db.exec(`alter table staff_members add column first_name text default 'Ada',add column last_name text default 'Lab',add column country_id uuid;
    create table countries(id uuid primary key,name text,iso_alpha2 text);
    insert into countries values('${uuid(100)}','France','FR');update staff_members set country_id='${uuid(100)}';
    create function get_staff_contract_nationality_multiplier(uuid,uuid default null) returns numeric language sql stable as $$select coalesce(nullif(current_setting('test.rnd.nat',true),''),'1')::numeric$$;
    create function get_staff_contract_federal_institute_multiplier(uuid) returns numeric language sql stable as $$select coalesce(nullif(current_setting('test.rnd.federal',true),''),'1')::numeric$$;
    create or replace function get_equipment_rnd_setback_delta(uuid) returns integer language sql stable as $$select case when current_setting('test.rnd.protection',true)='yes' then 0 else -1 end$$;
    alter table equipment_rnd_projects add column created_at timestamptz default now();`);
  const fields='id,status,success_rate,starts_game_day_index,completes_game_day_index,input_equipment_item_id,prototype_equipment_item_id';
  const before=await query(`select ${fields} from equipment_rnd_projects order by id`);
  const inventory=await query('select * from team_equipment_inventory order by equipment_item_id');
  await db.exec(readFileSync('supabase/migrations/20261014110000_equipment_rnd_focus_and_audit.sql','utf8'));
  await db.exec('create trigger apply_federal_staff_to_equipment_rnd before insert on equipment_rnd_projects for each row execute function apply_federal_staff_to_equipment_rnd()');
  check(await query(`select ${fields} from equipment_rnd_projects order by id`),before);
  check(await query('select * from team_equipment_inventory order by equipment_item_id'),inventory);
  for(const focus of ['mountain','hills','cobbles','plain']) {
    const counts=await query(`select choose_equipment_rnd_rating($1,(i+0.5)/10000.0) key,count(*)::integer n from generate_series(0,9999) i group by key`,[focus]);
    const groups={mountain:[['mountain'],['endurance','resistance','recovery','downhill']],hills:[['hills','acceleration'],['resistance','endurance','breakaway']],cobbles:[['cobbles','resistance'],['flat','endurance','acceleration']],plain:[['flat','sprint','timeTrial'],['acceleration','endurance','prologue']]}[focus];
    check(counts.filter(row=>groups[0].includes(row.key)).reduce((n,row)=>n+row.n,0),6000);
    check(counts.filter(row=>groups[1].includes(row.key)).reduce((n,row)=>n+row.n,0),2000);
    check(counts.filter(row=>!groups.flat().includes(row.key)).reduce((n,row)=>n+row.n,0),2000);
  }
  const all=await query('select choose_equipment_rnd_rating(null,(i+0.5)/1300.0) key,count(*)::integer n from generate_series(0,1299) i group by key');check(all.length,13);check(all.every(row=>row.n===100),true);
  await db.exec("update equipment_rnd_projects set status='cancelled' where status='active'");
  await db.exec(`insert into equipment_catalog_items(id,name,slot_type,status,effect_payload,acquisition_channel,effect_summary) values('${uuid(110)}','New series','frame','active','{"ratingBonuses":{"mountain":2,"endurance":1},"timeTrialRatingBonuses":{"timeTrial":1}}','commercial','Series');insert into team_equipment_inventory values('${uuid(40)}','${uuid(110)}',1,0)`);
  await db.exec(`insert into staff_member_talents values('${uuid(60)}','research_time'),('${uuid(60)}','research_cost'),('${uuid(60)}','research_success'),('${uuid(60)}','research_exceptional_chance');set test.rnd.nat='1.1';set test.rnd.federal='1.05';set test.rnd.protection='yes'`);
  const launch=(item,focus='mountain',name=null) => scalar('select start_current_team_equipment_rnd($1,$2,$3,$4) as value',[item,uuid(70),name,focus]);
  const first=await launch(uuid(110),'mountain','Aquila Evolution');
  const record=(await query('select * from equipment_rnd_projects where id=$1',[first]))[0];
  check(record.research_focus,'mountain');check(record.input_effect_payload.ratingBonuses.mountain,2);check(record.origin_effect_payload,record.input_effect_payload);
  check(record.success_rate,57);check(record.completes_game_day_index-record.starts_game_day_index,6);
  check(Number(record.engineer_snapshot.nationalityMultiplier),1.1);check(Number(record.engineer_snapshot.federalMultiplier),1.05);check(Number(record.engineer_snapshot.exceptionalChancePercentage),2.1);
  await db.query('update equipment_catalog_items set effect_payload=$2 where id=$1',[uuid(110),JSON.stringify({ratingBonuses:{mountain:9}})]);
  // Snapshot survives departure/talent changes. Old projects remain on old rules.
  await db.exec("set test.rnd.protection='no';delete from staff_member_talents;update staff_contracts set status='inactive' where id='"+uuid(70)+"'");
  await db.query('update equipment_rnd_projects set success_rate=0 where id=$1',[first]);
  await db.query('update seasons set current_day_number=$1',[record.completes_game_day_index-2026*28+1]);
  check(await scalar('select settle_due_equipment_rnd_projects() as value'),1);
  const final=(await query('select * from equipment_rnd_projects where id=$1',[first]))[0];
  check(final.rating_delta,0);check(final.output_effect_payload,final.input_effect_payload);check(final.engineer_snapshot.name,'Ada Lab');
  await db.exec("update staff_contracts set status='active' where id='"+uuid(70)+"';set test.rnd.nat='1';set test.rnd.federal='1'");
  // Force only the isolated stat selector to test exact cumulative +1 MO +2 END.
  const picker=await scalar("select pg_get_functiondef('choose_equipment_rnd_rating(text,double precision)'::regprocedure) as value");
  let item=final.prototype_equipment_item_id;
  for(const [index,key] of ['mountain','endurance','endurance'].entries()) {
    await db.exec(`create or replace function choose_equipment_rnd_rating(p_focus text,p_roll double precision) returns text language sql immutable as $$select '${key}'$$`);
    const project=await launch(item);
    await db.query('update equipment_rnd_projects set success_rate=100 where id=$1',[project]);
    await db.query('update seasons set current_day_number=(select completes_game_day_index-2026*28+1 from equipment_rnd_projects where id=$1)',[project]);
    check(await scalar('select settle_due_equipment_rnd_projects() as value'),1);
    const done=(await query('select * from equipment_rnd_projects where id=$1',[project]))[0];
    check(done.rating_delta,1);check(done.output_effect_payload.ratingBonuses.mountain,3);check(done.output_effect_payload.ratingBonuses.endurance,index===0?1:index===1?2:3);check(done.output_effect_payload.timeTrialRatingBonuses.timeTrial,1);
    item=done.prototype_equipment_item_id;check(await scalar('select name as value from equipment_catalog_items where id=$1',[item]),'Aquila Evolution');
    check(done.origin_effect_payload.ratingBonuses.mountain,2);check(done.origin_effect_payload.ratingBonuses.endurance,1);
  }
  await db.exec(picker);
  const revisions=await scalar('select get_current_equipment_rnd_revisions($1) as value',[[item]]);check(revisions.length,1);check(revisions[0].originPayload.ratingBonuses.mountain,2);check(revisions[0].previousPayload.ratingBonuses.endurance,2);
  await db.exec(`set request.jwt.claim.sub='${uuid(2)}'`);check(await scalar('select get_current_equipment_rnd_revisions($1) as value',[[item]]),[]);
  await db.exec(`set request.jwt.claim.sub='${uuid(1)}';set role authenticated`);
  check((await scalar('select get_current_equipment_rnd_engineers() as value')).length,1);
  await db.exec('reset role');
  await assertRejects(()=>launch(item,'invalid'),/Orientation/);
  check(await scalar('select count(*)::integer as value from equipment_rnd_projects where status=\'active\''),0);
  // An invalid direction/name, busy engineer or equipped input cannot consume stock.
  const stock=await query('select * from team_equipment_inventory order by equipment_item_id');
  await assertRejects(()=>launch(uuid(110),'mountain',null),/nom du prototype/);
  check(await query('select * from team_equipment_inventory order by equipment_item_id'),stock);
  await db.exec('set role authenticated');
  await assertRejects(()=>scalar('select equipment_rnd_origin_payload($1) as value',[item]),/permission denied/);
  await assertRejects(()=>scalar('select equipment_rnd_engineer_profile($1) as value',[uuid(71)]),/permission denied/);
  await db.exec('reset role');
  await db.exec('create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text,name text);create function settle_due_training_sessions() returns integer language sql as $$select 0$$');
  const installer=readFileSync('scripts/apply-reviewed-equipment-rnd-workbench.mjs','utf8');
  const verification=installer.match(/const check=`([\s\S]*?)`;/)[1].replaceAll('${version}','20261014110000');
  const verified=(await db.exec(verification)).find(result=>result.rows?.[0]?.installed!==undefined).rows[0];
  check(verified.installed,true);
  async function assertRejects(fn,pattern){const {default:assert}=await import('node:assert/strict');await assert.rejects(fn,pattern);check(true,true);}
}
