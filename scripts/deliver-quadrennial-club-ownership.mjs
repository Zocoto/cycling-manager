// Deliver only this reviewed migration. No gameplay simulation or db push.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,unlinkSync,rmdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const mode=process.argv[2];assert(['--inspect','--apply','--verify'].includes(mode));
const workdir=process.env.SUPABASE_LINKED_WORKDIR??process.cwd();
assert.equal(readFileSync(join(workdir,'supabase/.temp/project-ref'),'utf8').trim(),'ikagfuchasnsakpouosg');
const require=createRequire(import.meta.url);
const binary=join(require.resolve('@supabase/cli-windows-x64/package.json'),'..','bin/supabase.exe');
const version='20261103103000',name='fix_quadrennial_club_prize_ownership';
const source=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r\n','\n');
const hash=value=>createHash('md5').update(value).digest('hex');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const artifactDirectory='C:/Dev/artifacts/jq-club-prizes-20261103';
function query(sql){
 const directory=mkdtempSync(join(tmpdir(),'jq-club-ownership-')),file=join(directory,'query.sql');
 try{
  writeFileSync(file,sql);
  const raw=execFileSync(binary,['db','query','--linked','--workdir',workdir,'--file',file,'--output','json'],{encoding:'utf8',timeout:25000,maxBuffer:400000});
  return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
 }finally{unlinkSync(file);rmdirSync(directory);}
}
const read=sql=>query(`begin read only;set local statement_timeout='5s';set local lock_timeout='500ms';set local application_name='jq-club-prizes-delivery';${sql};commit;`);
function state(){return read(`select true database_ok,
 (select md5(statements[1]) from supabase_migrations.schema_migrations where version='${version}') recorded_hash,
 to_regprocedure('private.get_quadrennial_games_club_beneficiaries(uuid)') is not null helper_exists,
 (select jsonb_build_object('acl',p.proacl::text,'config',p.proconfig,'definer',p.prosecdef,
 'patched',position('private.get_quadrennial_games_club_beneficiaries' in pg_get_functiondef(p.oid))>0)
 from pg_proc p where p.oid='public.settle_quadrennial_games_cash_prizes(uuid)'::regprocedure) settlement`)[0];}
const before=state();assert(before.database_ok);
if(before.recorded_hash)assert.equal(before.recorded_hash,hash(source),'Migration version collision; stop.');
if(mode==='--inspect'){
 console.log(JSON.stringify({databaseHealthy:true,recorded:Boolean(before.recorded_hash),helperExists:before.helper_exists,...before.settlement}));
 process.exit(0);
}
let baseline;
if(!before.recorded_hash){
 assert.equal(mode,'--apply','Migration not installed.');assert(!before.helper_exists&&!before.settlement.patched,'Unrecorded ownership patch exists; inspect first.');
 const manifest=JSON.parse(readFileSync('.codex-tools/lionel-jq-jq-historical-missing-detail-20261103.json','utf8')).rows;
 assert.equal(manifest.length,10);assert.equal(manifest.reduce((sum,r)=>sum+Number(r.expected_prize),0),46000);
 const summary=read(readFileSync('.codex-tools/jq-historical-beneficiary-summary.sql','utf8'));
 assert.equal(summary.length,2);
 assert.equal(summary.reduce((sum,r)=>sum+r.missing_prizes,0),10);
 assert.equal(summary.reduce((sum,r)=>sum+Number(r.missing_total),0),46000);
 for(const row of summary)assert.equal(row.missing_members+row.missing_club_accounts+row.existing_wrong_recipient+row.existing_ledger_mismatches,0);
 baseline={checkedAt:new Date().toISOString(),summary,manifest,settlement:before.settlement};
 mkdirSync(artifactDirectory,{recursive:true});writeFileSync(join(artifactDirectory,'before.json'),JSON.stringify(baseline,null,2));
 query(source.replace(/commit;\s*$/,()=>`insert into supabase_migrations.schema_migrations(version,name,statements)
 values('${version}','${name}',array[${quote(source)}]);commit;`));
}else baseline=JSON.parse(readFileSync(join(artifactDirectory,'before.json'),'utf8'));
const after=state();assert.equal(after.recorded_hash,hash(source));assert(after.helper_exists&&after.settlement.patched);
const attrs=({acl,config,definer})=>({acl,config,definer});
assert.deepEqual(attrs(after.settlement),attrs(baseline.settlement),'Settlement ACL/settings changed.');
const manifest=baseline.manifest;
const recovered=read(`select ev.rider_id,ev.team_season_id,ev.cash_prize,ev.source_reference,
 tx.id transaction_id,tx.amount,tx.status,tx.day_number,tx.description,tx.posted_at
 from public.reward_events ev left join public.team_finance_transactions tx
 on tx.team_season_id=ev.team_season_id and tx.source_reference='reward:'||ev.source_reference
 where ev.source_reference in (${manifest.map(r=>quote(`quadrennial-games:${r.edition_id}:roster:${r.race_roster_id}:club:v1`)).join(',')})
 order by ev.source_reference`);
assert.equal(recovered.length,10);
for(const expected of manifest){
 const row=recovered.find(r=>r.source_reference===`quadrennial-games:${expected.edition_id}:roster:${expected.race_roster_id}:club:v1`);
 assert(row);assert.equal(row.team_season_id,expected.team_season_id);assert.equal(Number(row.cash_prize),Number(expected.expected_prize));
 assert(row.transaction_id);assert.equal(row.status,'posted');assert.equal(Number(row.amount),Number(expected.expected_prize));assert.equal(row.day_number,24);
}
const teams=[...new Set(manifest.map(r=>r.team_season_id))];
const balances=read(`select ts.id,ts.display_name,ts.cash_balance,ts.opening_cash_balance,
 coalesce(sum(t.amount) filter(where t.status='posted'),0) posted_net,
 ts.cash_balance-ts.opening_cash_balance-coalesce(sum(t.amount) filter(where t.status='posted'),0) discrepancy
 from public.team_seasons ts left join public.team_finance_transactions t on t.team_season_id=ts.id
 where ts.id in (${teams.map(quote).join(',')}) group by ts.id`);
for(const row of balances)assert.equal(Number(row.discrepancy),0,'Balance does not reconcile with ledger.');
const receipts=read(`select race_edition_id,club_prize_count,club_prize_total,federation_prize,settled_at from public.quadrennial_games_cash_settlements order by race_edition_id`);
assert.equal(receipts.reduce((sum,r)=>sum+r.club_prize_count,0),235);
assert.equal(receipts.reduce((sum,r)=>sum+Number(r.club_prize_total),0),4314000);
const summary=read(readFileSync('.codex-tools/jq-historical-beneficiary-summary.sql','utf8'));
for(const row of summary)assert.equal(row.missing_prizes+row.missing_members+row.missing_club_accounts+row.existing_wrong_recipient+row.existing_ledger_mismatches,0);
const proof={checkedAt:new Date().toISOString(),databaseHealthy:true,version,recoveredCount:recovered.length,recoveredTotal:46000,teams:balances,recovered,receipts,summary,privilegesPreserved:true};
mkdirSync(artifactDirectory,{recursive:true});writeFileSync(join(artifactDirectory,'verified.json'),JSON.stringify(proof,null,2));
console.log(JSON.stringify(proof,null,2));
