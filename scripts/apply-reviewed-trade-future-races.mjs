// Reviewed function migration only: no gameplay call, fixture or entry repair.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
const mode=process.argv[2];
assert(process.argv.length===3&&['--inspect','--apply-reviewed-fix'].includes(mode));
assert.equal(readFileSync('supabase/.temp/project-ref','utf8').trim(),'ikagfuchasnsakpouosg');
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const version='20261023160000',name='allow_future_races_in_rider_trades';
const source=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r','');
const previous=readFileSync('supabase/migrations/20261022190000_add_direct_transfer_trade_offers.sql','utf8').replaceAll('\r','');
const md5=value=>createHash('md5').update(value).digest('hex');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const body=(sql,signature)=>{const start=sql.search(new RegExp(`create(?: or replace)? function ${signature.replaceAll('.','\\.')}\\(`));assert(start>=0);const from=sql.indexOf('as $$',start)+5;assert(from>4);const to=sql.indexOf('$$;',from);assert(to>from);return sql.slice(from,to);};
const tracked=[
  ['private.assert_rider_trade_eligible','uuid,uuid,uuid,integer'],
  ['public.submit_direct_transfer_trade_offer','uuid,numeric,uuid,text'],
  ['public.respond_to_direct_transfer_offer','uuid,boolean'],
];
const original=Object.fromEntries(tracked.map(([routine,args])=>[`${routine}(${args})`,md5(body(previous,routine))]));
const expected={...original};
const oldRace=body(previous,'private.assert_rider_trade_eligible').match(/  if exists \(\n    select 1 from public\.race_rosters[\s\S]+?\n  end if;/)?.[0];
assert(oldRace);
expected[tracked[0].join('(')+')']=md5(body(previous,tracked[0][0]).replace(oldRace,'  perform private.assert_trade_races_not_started(p_rider_id);'));
expected[tracked[1].join('(')+')']=md5(body(previous,tracked[1][0]).replace('  ) returning id into v_offer_id;\n\n  select concat_ws', '  ) returning id into v_offer_id;\n\n  perform private.withdraw_trade_future_races(p_offered_rider_id,v_offer_id);\n\n  select concat_ws'));
expected[tracked[2].join('(')+')']=md5(body(previous,tracked[2][0]).replace('  -- Accepted first so departure triggers invalidate only competing offers.', '  perform private.withdraw_trade_future_races(v_offer.rider_id,v_offer.id);\n  perform private.withdraw_trade_future_races(v_offer.offered_rider_id,v_offer.id);\n\n  -- Accepted first so departure triggers invalidate only competing offers.'));
assert(source.startsWith('begin;')&&source.includes("set local statement_timeout = '5s'")&&source.includes("set local lock_timeout = '1s'")&&/commit;\s*$/.test(source));
const artifactDirectory='artifacts/trade-future-races-20261023';
const run=sql=>{
  mkdirSync(artifactDirectory,{recursive:true});
  const file=path.resolve(artifactDirectory,'reviewed-command.sql');writeFileSync(file,sql);
  const raw=execFileSync(binary,['db','query','--linked','--file',file,'--output','json'],{encoding:'utf8',timeout:18000,maxBuffer:50000});
  return JSON.parse(raw.slice(raw.indexOf('{'))).rows[0];
};
const inspect=()=>{const result=run(`begin read only;set local application_name='trade-future-races-inspect-20261023';set local statement_timeout='4s';set local lock_timeout='500ms';
select 1 database_ok,
 exists(select 1 from supabase_migrations.schema_migrations where version='${version}') recorded,
 (select md5(statements[1]) from supabase_migrations.schema_migrations where version='${version}') recorded_hash,
 (select jsonb_object_agg(oid::regprocedure::text,md5(replace(prosrc,chr(13),''))) from pg_proc where oid in(${tracked.map(([routine,args])=>`'${routine}(${args})'::regprocedure`).join(',')})) routine_hashes,
 (select jsonb_object_agg(oid::regprocedure::text,md5(replace(prosrc,chr(13),''))) from pg_proc where oid in(
   'private.submit_direct_transfer_offer_cash_20261022(uuid,numeric)'::regprocedure,
   'private.respond_to_direct_transfer_offer_cash_20261022(uuid,boolean)'::regprocedure,
   'public.get_team_transfer_reserved_budget(uuid,uuid,uuid)'::regprocedure,
   'private.guard_live_rider_commitment_ownership()'::regprocedure,
   'public.detach_departing_rider(uuid,uuid,uuid,integer)'::regprocedure)) unchanged_hashes,
 has_function_privilege('authenticated','public.submit_direct_transfer_trade_offer(uuid,numeric,uuid,text)','execute') player_submit,
 has_function_privilege('anon','public.submit_direct_transfer_trade_offer(uuid,numeric,uuid,text)','execute') anonymous_submit,
 (select count(*)::int from pg_trigger where not tgisinternal and tgenabled<>'D' and tgname in ('guard_race_roster_transfer_ownership','guard_form_camp_transfer_ownership','guard_reconnaissance_transfer_ownership')) commitment_guards,
 (select coalesce(bool_and(not has_function_privilege('authenticated',oid,'execute') and not has_function_privilege('anon',oid,'execute') and not has_function_privilege('service_role',oid,'execute')),false)
   from pg_proc where oid in(to_regprocedure('private.assert_trade_races_not_started(uuid)'),to_regprocedure('private.withdraw_trade_future_races(uuid,uuid)'))) helpers_private;
commit;`);result.routine_hashes=Object.fromEntries(Object.entries(result.routine_hashes).map(([key,value])=>[key.startsWith('private.')?key:`public.${key}`,value]));return result;};
const before=inspect();
if(mode==='--inspect'){console.log(JSON.stringify({state:before,expectedBefore:original,expectedAfter:expected}));process.exit(0);}
assert(before.database_ok===1&&before.player_submit&&!before.anonymous_submit&&before.commitment_guards===3);
assert.equal(Object.keys(before.unchanged_hashes).length,5);
if(!before.recorded){
  assert.deepEqual(before.routine_hashes,original,'Live trade routines changed: review required');
  run(source.replace(/commit;\s*$/,()=>`insert into supabase_migrations.schema_migrations(version,name,statements) values(${quote(version)},${quote(name)},array[${quote(source)}]);\ncommit;`));
}
const after=inspect();
assert(after.recorded&&after.recorded_hash===md5(source)&&after.helpers_private&&after.player_submit&&!after.anonymous_submit&&after.commitment_guards===3);
assert.deepEqual(after.routine_hashes,expected,'Unexpected installed trade routine');
assert.deepEqual(after.unchanged_hashes,before.unchanged_hashes,'Unrelated rules changed');
const receipt={version,...after,productionFixtures:false,existingEntriesRewritten:false};
writeFileSync(path.join(artifactDirectory,'installation-receipt.json'),JSON.stringify(receipt,null,2));
console.log(JSON.stringify(receipt));
