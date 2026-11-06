// Exact owner-authorized repair only. No fixtures or other player corrections.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
const mode=process.argv[2];assert.ok(process.argv.length===3&&['--apply','--verify'].includes(mode));
assert.equal(readFileSync('supabase/.temp/project-ref','utf8').trim(),'ikagfuchasnsakpouosg');
const version='20261106113000',name='restore_pawar_to_samuelrodri';
const source=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r\n','\n');
assert.equal(createHash('sha256').update(source).digest('hex'),'15278c2579ea4d8918beba0184bd9314e3fea48b2f8975d1d9135b7de8cdcade');
const folder='C:/Dev/artifacts/draft-free-agent-incident-20261106';mkdirSync(folder,{recursive:true});
const require=createRequire(import.meta.url);
const cli=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
function query(sql,label){
 const file=path.join(folder,label+'.sql');writeFileSync(file,sql);
 let raw;
 try {raw=execFileSync(cli,['db','query','--linked','--file',file,'--output','json'],{encoding:'utf8',timeout:20000,maxBuffer:100000});}
 catch(error){throw new Error(`Pawar ${label} failed: ${String(error.stderr||error.message).slice(0,3500)}`);}
 return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
}
function read(sql,label){return query("begin read only;set local statement_timeout='3s';set local lock_timeout='300ms';set local application_name='pawar-return-verification-20261106';"+sql+';commit;',label);}
const before=read(`select name from supabase_migrations.schema_migrations where version='${version}'`,'repair-receipt-before');
if(!before.length){
 assert.equal(mode,'--apply');assert.ok(source.endsWith('commit;\n'));
 query(source.slice(0,-'commit;\n'.length)+`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[${quote(source)}]);\ncommit;`,'reviewed-pawar-repair');
}
const row=read(`select true database_ok,
 (select name from supabase_migrations.schema_migrations where version='${version}') receipt,
 (select md5(statements[1]) from supabase_migrations.schema_migrations where version='${version}') receipt_hash,
 (select status from public.rider_contracts where id='08c6c30e-c972-4213-b31c-df6a5358c856') old_contract_status,
 (select jsonb_build_object('status',status,'teamId',team_id,'salary',salary_per_season,'startSeasonId',start_season_id,'endSeasonId',end_season_id) from public.rider_contracts where id='83d8990f-25ce-4e45-9f0a-11f201a78af0') returned_contract,
 (select jsonb_build_object('status',status,'teamId',team_id,'salary',salary_per_season,'fee',transfer_fee,'transferLock',transfer_locked_season_id) from public.rider_contracts where id='9f63fedb-0738-4bb9-a601-69bd9d918f71') future_contract,
 (select count(*)::integer from public.team_finance_transactions where source_reference like 'rider-salary:08c6c30e-c972-4213-b31c-df6a5358c856:%' and status='cancelled') cancelled_salaries,
 (select count(*)::integer from public.team_finance_transactions where source_reference like 'rider-salary:08c6c30e-c972-4213-b31c-df6a5358c856:%' and status='pending') pending_buyer_salaries,
 (select amount from public.team_finance_transactions where team_season_id='36dfc2d7-6102-456d-b49a-64bfdcb090a2' and source_reference='owner-approved-pawar-return:20261106' and status='posted') refund,
 (select status from public.direct_transfer_offers where id='70012872-d73e-497a-be9d-b7bcda127eeb') offer_status,
 public.get_team_roster_commitment_count('c7d4f299-3430-4aaf-a029-ac9b97a07ed2',5) samuel_roster,
 public.get_team_roster_limit('c7d4f299-3430-4aaf-a029-ac9b97a07ed2') samuel_roster_limit`,'pawar-after-repair')[0];
assert.equal(row.receipt,name);assert.equal(row.receipt_hash,createHash('md5').update(source).digest('hex'));
assert.equal(row.old_contract_status,'cancelled');assert.equal(row.offer_status,'cancelled');
assert.equal(row.returned_contract.status,'active');assert.equal(row.returned_contract.teamId,'c7d4f299-3430-4aaf-a029-ac9b97a07ed2');
assert.equal(Number(row.returned_contract.salary),13000);assert.equal(row.returned_contract.startSeasonId,'7ea43c15-30fd-4878-b18f-ab2a43ad3be8');assert.equal(row.returned_contract.endSeasonId,row.returned_contract.startSeasonId);
assert.equal(row.future_contract.status,'planned');assert.equal(row.future_contract.teamId,row.returned_contract.teamId);assert.equal(Number(row.future_contract.salary),12000);assert.equal(Number(row.future_contract.fee),0);assert.equal(row.future_contract.transferLock,null);
assert.equal(row.cancelled_salaries,4);assert.equal(row.pending_buyer_salaries,0);assert.equal(Number(row.refund),600);
const proof={checkedAt:new Date().toISOString(),...row};writeFileSync(path.join(folder,'pawar-return-verification.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
