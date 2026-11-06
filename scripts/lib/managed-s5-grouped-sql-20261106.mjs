// Group transport only. Preserve each reviewed transaction and its native guards.
import assert from 'node:assert/strict';
const suffix='select * from managed_results order by action_key;commit;';
const prefix="begin;set local application_name='managed-s5-one-shot-20261106';set local statement_timeout='8s';set local lock_timeout='500ms';";
export function managedS5GroupedSql(compiledBatches){
  assert.ok(Array.isArray(compiledBatches)&&compiledBatches.length>=1&&compiledBatches.length<=4,'Group supports one to four existing transactions');
  const transactions=compiledBatches.map((sql,index)=>{
    assert.ok(typeof sql==='string'&&sql.startsWith(prefix)&&sql.endsWith(suffix),'Expected an unmodified canonical managed batch');
    assert.equal(sql.split(suffix).length,2,'Ambiguous transaction result suffix');
    assert.ok(sql.includes('on commit drop;'),'The original per-transaction result table must remain temporary');
    return sql.slice(0,-suffix.length)+`insert into grouped_results(batch_number,bot_key,action_key,status,result)
      select ${index+1},bot_key,action_key,status,result from managed_results;commit;`;
  });
  return `create temporary table grouped_results(batch_number integer,bot_key text,action_key text,status text,result jsonb) on commit preserve rows;
${transactions.join('\n')}
select * from grouped_results order by batch_number,action_key;`;
}
