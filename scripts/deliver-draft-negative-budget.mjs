// Requested policy change only. Never reopens a resolved draft participant.
import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';import {createHash} from 'node:crypto';import path from 'node:path';
const mode=process.argv[2];assert.ok(process.argv.length===3&&['--preflight','--apply-reviewed','--verify','--advance-live'].includes(mode));
assert.equal(readFileSync('supabase/.temp/project-ref','utf8').trim(),'ikagfuchasnsakpouosg');
const require=createRequire(import.meta.url),binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const version='20261106203000',name='allow_draft_recruitment_with_negative_projection';
const source=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r\n','\n');
const hash=createHash('md5').update(source).digest('hex');const quote=s=>"'"+s.replaceAll("'","''")+"'";
const dir='C:/Dev/artifacts/draft-auto-20261106';mkdirSync(dir,{recursive:true});const beforeFile=path.join(dir,'negative-budget-before.json');
const query=sql=>{const file=path.join(dir,'delivery.sql');writeFileSync(file,sql);const raw=execFileSync(binary,['db','query','--linked','--file',file,'--output','json'],{encoding:'utf8',timeout:20000,maxBuffer:200000});return JSON.parse(raw.slice(raw.indexOf('{'))).rows;};
const ro=sql=>query(`begin read only;set local statement_timeout='5s';set local lock_timeout='500ms';set local application_name='draft-negative-budget-delivery';${sql};commit;`);
const receipt=()=>ro(`select name,md5(replace(statements[1],chr(13),''))hash from supabase_migrations.schema_migrations where version='${version}'limit 1`)[0];
const functions=()=>ro("select p.oid::regprocedure::text signature,md5(pg_get_functiondef(p.oid))hash from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('process_season_draft','initialize_season_draft','reserve_season_draft_pool','get_season_draft_view','save_current_season_draft_preferences','select_current_season_draft_rider','can_team_reserve_roster_rider')order by signature");
const changed=()=>ro("select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid)definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('advance_season_draft','try_season_draft_pick')order by signature");
const state=()=>ro("select id,status,current_position,pick_deadline,version from public.season_draft_editions where game_year=5 limit 1")[0];
const resolved=()=>ro("select p.team_id,md5(to_jsonb(p)::text)hash from public.season_draft_participants p join public.season_draft_editions e on e.id=p.edition_id where e.game_year=5 and p.status<>'pending' order by p.team_id limit 500");
const stamp=receipt();if(stamp)assert.deepEqual(stamp,{name,hash});
if(mode==='--preflight'){
 if(!stamp){const defs=changed();const captured=JSON.parse(readFileSync(dir+'/functions.json','utf8'));
 for(const f of defs)assert.equal(f.definition.replaceAll('\r\n','\n'),captured.find(c=>c.signature===f.signature).definition.replaceAll('\r\n','\n'));
 writeFileSync(beforeFile,JSON.stringify({protected:functions(),resolved:resolved(),state:state()},null,2));}
 console.log(JSON.stringify({readOnly:true,alreadyInstalled:!!stamp}));
}else{
 assert.ok(existsSync(beforeFile));const before=JSON.parse(readFileSync(beforeFile,'utf8'));
 if(mode==='--apply-reviewed'&&!stamp){assert.deepEqual(functions(),before.protected);
 query(source.replace(/commit;\s*$/,()=>`insert into supabase_migrations.schema_migrations(version,name,statements)values('${version}','${name}',array[${quote(source)}]);commit;`));}
 assert.deepEqual(receipt(),{name,hash});assert.deepEqual(functions(),before.protected);
 const current=resolved();for(const previous of before.resolved)assert.deepEqual(current.find(p=>p.team_id===previous.team_id),previous,'A previously resolved choice changed');
 const definitions=changed();for(const f of definitions)assert.ok(!f.definition.includes('get_projected_transfer_budget'),'Draft projection guard remains');
 const pick=definitions.find(f=>f.signature.startsWith('try_')).definition;assert.ok(pick.includes('can_team_reserve_roster_rider(p_team,v_year+1,p_rider)'));assert.ok(pick.includes('salary_per_season'));
 if(mode==='--advance-live'){
  const live=state();if(live.status==='running'){
   assert.match(live.id,/^[0-9a-f-]{36}$/i);
   query(`begin;set local statement_timeout='5s';set local lock_timeout='500ms';set local application_name='draft-negative-budget-live-advance';select public.advance_season_draft(${quote(live.id)}::uuid);commit;`);
  }
 }
 const after=state();const afterResolved=resolved();for(const previous of before.resolved)assert.deepEqual(afterResolved.find(p=>p.team_id===previous.team_id),previous);
 const http=await fetch('https://cyclostratege.fr/guide',{signal:AbortSignal.timeout(10000)});assert.equal(http.status,200);
 const proof={checkedAt:new Date().toISOString(),migration:version,pastChoicesPreserved:before.resolved.length,negativeProjectionAllowed:true,protectedFunctions:before.protected.length,state:after,http:http.status};
 writeFileSync(dir+'/negative-budget-verified.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}
