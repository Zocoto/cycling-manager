import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from 'file:///C:/Dev/tmp/rnd-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js';
import {managedS5GroupedSql} from './managed-s5-grouped-sql-20261106.mjs';
const prefix="begin;set local application_name='managed-s5-one-shot-20261106';set local statement_timeout='8s';set local lock_timeout='500ms';";
const suffix='select * from managed_results order by action_key;commit;';
function transaction(key,{fail=false,verifyCleanJwt=false}={}){
  return `${prefix}
create temporary table managed_results(bot_key text,action_key text,status text,result jsonb) on commit drop;
do $local_fixture$ begin
  ${verifyCleanJwt?"if coalesce(current_setting('request.jwt.claim.sub',true),'')<>'' then raise exception 'JWT leaked across commits';end if;":''}
  perform set_config('request.jwt.claim.sub','actor-${key}',true);
  ${fail?"if exists(select 1 from local_failure_switch where enabled) then raise exception 'isolated native failure';end if;":''}
  if exists(select 1 from local_durable_receipts where action_key='${key}') then
    insert into managed_results values('test_team','${key}','already_done','null'::jsonb);
  else
    insert into local_durable_receipts values('${key}');
    insert into local_effects values('${key}');
    insert into managed_results values('test_team','${key}','applied','{}'::jsonb);
  end if;
end $local_fixture$;
${suffix}`;
}
async function database(){
  const db=new PGlite();await db.exec('create table local_durable_receipts(action_key text primary key);create table local_effects(action_key text);create table local_failure_switch(enabled boolean);');
  return db;
}
test('grouping preserves every original transaction body, timeout and lock guard',()=>{
  const originals=[transaction('a'),transaction('b')],sql=managedS5GroupedSql(originals);
  for(const original of originals)assert.ok(sql.includes(original.slice(0,-suffix.length)));
  assert.equal(sql.match(/set local statement_timeout='8s'/g).length,2);
  assert.equal(sql.match(/set local lock_timeout='500ms'/g).length,2);
  assert.equal(sql.match(/;commit;/g).length,2);
  assert.equal(sql.match(/select \* from grouped_results/g).length,1);
  assert.ok(sql.includes('on commit preserve rows'));
});
test('unknown SQL and more than four transactions are refused',()=>{
  assert.throws(()=>managedS5GroupedSql([]));assert.throws(()=>managedS5GroupedSql(Array(5).fill(transaction('a'))));
  assert.throws(()=>managedS5GroupedSql([transaction('a').replace("statement_timeout='8s'","statement_timeout='60s'")]),/unmodified canonical/);
  assert.throws(()=>managedS5GroupedSql([transaction('a')+'select 1;']),/unmodified canonical/);
});
test('four committed transactions return one complete result set with clean JWT contexts',async()=>{
  const db=await database();
  try{
    const result=await db.exec(managedS5GroupedSql(['a','b','c','d'].map(key=>transaction(key,{verifyCleanJwt:true}))));
    const rows=result.at(-1).rows;
    assert.equal(rows.length,4);assert.deepEqual(rows.map(r=>r.batch_number),[1,2,3,4]);
    assert.ok(rows.every(r=>r.status==='applied'));
    assert.equal((await db.query('select count(*)::integer count from local_effects')).rows[0].count,4);
    assert.equal((await db.query("select coalesce(current_setting('request.jwt.claim.sub',true),'') value")).rows[0].value,'');
  }finally{await db.close();}
});
test('a middle failure retains earlier commits, rolls back its own transaction and skips later transactions',async()=>{
  const db=await database();
  try{
    await db.exec('insert into local_failure_switch values(true)');
    const group=managedS5GroupedSql([transaction('first'),transaction('middle',{fail:true}),transaction('last')]);
    await assert.rejects(db.exec(group),/isolated native failure/);await db.exec('rollback;');
    assert.deepEqual((await db.query('select * from local_effects')).rows,[{action_key:'first'}]);
    assert.deepEqual((await db.query('select * from local_durable_receipts')).rows,[{action_key:'first'}]);
    // A new CLI connection discards TEMP tables. Emulate that session boundary.
    await db.exec('drop table grouped_results;update local_failure_switch set enabled=false;');
    const replay=(await db.exec(group)).at(-1).rows;
    assert.deepEqual(replay.map(r=>r.status),['already_done','applied','applied']);
    assert.deepEqual((await db.query('select action_key,count(*)::integer count from local_effects group by action_key order by action_key')).rows,
      [{action_key:'first',count:1},{action_key:'last',count:1},{action_key:'middle',count:1}]);
  }finally{await db.close();}
});
