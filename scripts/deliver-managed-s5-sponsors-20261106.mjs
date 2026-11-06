// Only the two exceptional S5 renewals expressly approved by the owner.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const mode=process.argv[2];assert.ok(['--apply','--verify'].includes(mode)&&process.argv.length===3);
assert.equal(readFileSync('supabase/.temp/project-ref','utf8').trim(),'ikagfuchasnsakpouosg');
const version='20261106173541',name='restore_managed_s5_sponsors';
const source=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r\n','\n');
assert.equal(createHash('sha256').update(source).digest('hex'),'da446ac209a6f689bfdaff21d934e37229fa8a174569fbfea21f1f302448f4fd');
const folder='C:/Dev/artifacts/managed-teams-s5-20261106';
const require=createRequire(import.meta.url);
const cli=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
function query(sql,label){
 const file=path.join(folder,label+'.sql');writeFileSync(file,sql);
 let raw;try{raw=execFileSync(cli,['db','query','--linked','--file',file,'--output','json'],{encoding:'utf8',timeout:25000,maxBuffer:150000});}
 catch(error){throw new Error(`${label}: ${String(error.stderr||error.message).slice(0,3500)}`);}
 return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
}
function state(label){return query(`begin read only;set local statement_timeout='3s';set local lock_timeout='300ms';set local application_name='managed-sponsor-renewal-verification';
 select (select name from supabase_migrations.schema_migrations where version='${version}') receipt,
 (select md5(statements[1]) from supabase_migrations.schema_migrations where version='${version}') receipt_hash,
 (select jsonb_agg(jsonb_build_object('team_id',ts.team_id,'cash',ts.cash_balance,'operating_budget',ts.operating_budget,
   'country_id',ts.registration_country_id,'projected',ts.cash_balance+coalesce((select sum(f.amount) from public.team_finance_transactions f where f.team_season_id=ts.id and f.status='pending'),0)) order by ts.team_id)
   from public.team_seasons ts where ts.season_id='7ea43c15-30fd-4878-b18f-ab2a43ad3be8' and ts.team_id in('817db772-6373-4b4a-bb01-a78b1107d546','61c5aac7-4917-48ed-b861-ebf5eea2d754')) accounts,
 (select jsonb_agg(jsonb_build_object('id',c.id,'team_id',c.team_id,'status',c.status,'budget',c.budget_per_season,'offer_id',c.sponsor_offer_id,'duration',c.contract_duration_seasons,'start',c.start_season_id,'end',c.end_season_id,
   'pending_count',(select count(*) from public.team_finance_transactions f where f.source_reference like 'sponsor:'||c.id::text||':%' and f.status='pending'),
   'pending_total',(select sum(f.amount) from public.team_finance_transactions f where f.source_reference like 'sponsor:'||c.id::text||':%' and f.status='pending'),
   'days',(select jsonb_agg(f.day_number order by f.day_number) from public.team_finance_transactions f where f.source_reference like 'sponsor:'||c.id::text||':%' and f.status='pending')) order by c.team_id)
   from public.team_sponsor_contracts c where c.id in('476e16f2-d644-41b0-9715-c4ac64ed9872','10e6063e-7928-43b8-a361-b9c2d0239413')) contracts;
 commit;`,label)[0];}
const current=state('sponsor-restoration-before-delivery');
if(!current.receipt){
 assert.equal(mode,'--apply');assert.equal(current.contracts,null);
 writeFileSync(path.join(folder,'sponsor-restoration-delivery-baseline.json'),JSON.stringify(current,null,2));
 assert.ok(source.endsWith('commit;\n'));
 query(source.slice(0,-'commit;\n'.length)+`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[${quote(source)}]);\ncommit;`,'reviewed-sponsor-restoration');
}
const baseline=JSON.parse(readFileSync(path.join(folder,'sponsor-restoration-delivery-baseline.json'),'utf8'));
const after=state('sponsor-restoration-after-delivery');
assert.equal(after.receipt,name);assert.equal(after.receipt_hash,createHash('md5').update(source).digest('hex'));assert.equal(after.contracts.length,2);
for(const contract of after.contracts){
 const budget=contract.team_id==='817db772-6373-4b4a-bb01-a78b1107d546'?570000:340000;
 assert.equal(contract.status,'active');assert.equal(contract.duration,1);assert.equal(Number(contract.budget),budget);
 assert.equal(contract.start,'7ea43c15-30fd-4878-b18f-ab2a43ad3be8');assert.equal(contract.end,contract.start);
 assert.equal(contract.pending_count,4);assert.equal(Number(contract.pending_total),budget);assert.deepEqual(contract.days,[7,14,21,28]);
 const beforeAccount=baseline.accounts.find(a=>a.team_id===contract.team_id),account=after.accounts.find(a=>a.team_id===contract.team_id);
 assert.equal(account.cash,beforeAccount.cash);assert.equal(Number(account.operating_budget),budget);
 assert.equal(Number(account.projected),Number(beforeAccount.projected)+budget);
}
const proof={checkedAt:new Date().toISOString(),receipt:version,noImmediateCash:true,historicalS4ProtectedByMigration:true,accounts:after.accounts,contracts:after.contracts};
writeFileSync(path.join(folder,'sponsor-restoration-verification.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
