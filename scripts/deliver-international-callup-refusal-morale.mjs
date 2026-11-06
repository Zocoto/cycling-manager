// Reviewed schema/function policy only. No live refusal, fixture or morale backfill.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import path from 'node:path';
const mode=process.argv[2],linked=path.resolve(process.argv[3]??'.');
assert([3,4].includes(process.argv.length)&&['--preflight','--apply-reviewed','--verify'].includes(mode));
assert.equal(readFileSync(path.join(linked,'supabase/.temp/project-ref'),'utf8').trim(),'ikagfuchasnsakpouosg');
const version='20261106170000',name='add_international_callup_refusal_morale';
const source=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r\n','\n');
const hash=createHash('md5').update(source).digest('hex');
assert.equal(hash,'62485b487b2198ad494589d5b15c28fb','Reviewed migration changed');
const fixture=JSON.parse(readFileSync('scripts/fixtures/international-callup-refusal-baseline.json','utf8')).rows;
const signatures=fixture.map(row=>row.signature);
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const folder=path.resolve('artifacts/international-callup-refusal-20261106');mkdirSync(folder,{recursive:true});
const beforeFile=path.join(folder,'delivery-before.json');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
function query(sql){
  const file=path.join(folder,'delivery.sql');writeFileSync(file,sql);
  const raw=execFileSync(binary,['db','query','--linked','--workdir',linked,'--file',file,'--output','json'],
    {encoding:'utf8',timeout:20000,maxBuffer:200000});
  return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
}
const read=sql=>query(`begin read only;set local statement_timeout='5s';set local lock_timeout='500ms';set local search_path='';set local application_name='callup-refusal-morale-inspect';${sql};commit;`);
const receipt=()=>read(`select name,md5(replace(statements[1],chr(13),'')) hash from supabase_migrations.schema_migrations where version='${version}' limit 1`)[0];
const definitions=()=>read(`select p.oid::regprocedure::text signature,replace(pg_get_functiondef(p.oid),chr(13),'') definition,p.proacl::text acl
  from pg_proc p where p.oid in(${signatures.map(s=>quote(s)+'::regprocedure').join(',')}) order by signature`);
const constraints=()=>read(`select conname,pg_get_expr(conbin,conrelid) expression,convalidated from pg_constraint
  where (conrelid='public.rider_morale_events'::regclass and conname='rider_morale_events_source_allowed')
    or (conrelid='public.youth_rider_morale_events'::regclass and conname='youth_rider_morale_events_source_allowed') order by conname`);
const refusalBlocks=[...source.matchAll(/\$refusal\$([\s\S]*?)\$refusal\$/g)].map(match=>match[1]);
assert.equal(refusalBlocks.length,2);
function expected(before){
  return before.map(row=>{
    let definition=row.definition;
    const replace=(oldText,newText)=>{assert.equal(definition.split(oldText).length-1,1,row.signature);definition=definition.replace(oldText,newText);};
    if(row.signature.startsWith('public.apply_rider_morale_event(')||row.signature.startsWith('public.apply_youth_rider_morale_event(')){
      replace("'manual_adjustment'","'manual_adjustment', 'international_callup_refusal'");
    }else if(row.signature==='public.respond_to_national_federation_preselection(uuid,boolean)'){
      replace('  v_callup_departure timestamptz;','  v_callup_departure timestamptz;\n  v_morale_race_edition_id uuid;');
      replace('  select schedule.departure_at into v_callup_departure','  select schedule.departure_at, schedule.race_edition_id into v_callup_departure, v_morale_race_edition_id');
      replace('  where id = v_member.id;','  where id = v_member.id;'+refusalBlocks[0]);
    }else if(row.signature==='public.respond_to_international_championship_selection(uuid,boolean)'){
      const old="    set response_status = 'declined', is_selected = false, responded_at = now()\n    where id = v_candidate.id;";
      replace(old,old+refusalBlocks[1]);
    }
    return {...row,definition};
  });
}
const stamp=receipt();if(stamp)assert.deepEqual(stamp,{name,hash});
if(mode==='--preflight'){
  if(!stamp){
    const functions=definitions();
    assert.deepEqual(functions.map(({signature,definition})=>({signature,definition})),fixture.map(({signature,definition})=>({signature,definition})));
    expected(functions);
    const sources=constraints();assert.equal(sources.length,2);
    assert(sources.every(c=>c.convalidated&&!c.expression.includes('international_callup_refusal')));
    assert.equal(read("select to_regprocedure('private.apply_international_callup_refusal_morale(uuid,uuid,uuid,text,jsonb)') is null absent")[0].absent,true);
    writeFileSync(beforeFile,JSON.stringify({hash,functions,sources},null,2));
  }
  console.log(JSON.stringify({readOnly:true,alreadyInstalled:!!stamp,functions:signatures.length,hash}));
}else{
  assert(existsSync(beforeFile));const before=JSON.parse(readFileSync(beforeFile,'utf8'));assert.equal(before.hash,hash);
  if(mode==='--apply-reviewed'&&!stamp){
    assert.deepEqual(definitions(),before.functions);assert.deepEqual(constraints(),before.sources);
    query(source.replace(/commit;\s*$/,()=>`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[${quote(source)}]);commit;`));
  }
  assert.deepEqual(receipt(),{name,hash});assert.deepEqual(definitions(),expected(before.functions));
  const sources=constraints();assert.equal(sources.length,2);
  for(const previous of before.sources){
    const installed=sources.find(c=>c.conname===previous.conname);
    assert(installed.expression.includes(previous.expression));assert(installed.expression.includes('international_callup_refusal'));
  }
  const policy=read(`select pg_get_functiondef('private.apply_international_callup_refusal_morale(uuid,uuid,uuid,text,jsonb)'::regprocedure) definition,
    not has_function_privilege('authenticated','private.apply_international_callup_refusal_morale(uuid,uuid,uuid,text,jsonb)','execute') protected,
    not has_function_privilege('anon','private.apply_international_callup_refusal_morale(uuid,uuid,uuid,text,jsonb)','execute') anonymous_denied,
    exists(select 1 from pg_constraint where conrelid='public.rider_morale_events'::regclass and conname='rider_morale_events_unique') pro_unique,
    exists(select 1 from pg_constraint where conrelid='public.youth_rider_morale_events'::regclass and conname='youth_rider_morale_events_unique') junior_unique,
    1 database_ok`)[0];
  const body=source.split('as $$\n')[1].split('\n$$;')[0];assert(policy.definition.includes(body));
  assert(policy.protected&&policy.anonymous_denied&&policy.pro_unique&&policy.junior_unique&&policy.database_ok===1);
  const response=await fetch('https://cyclostratege.fr/guide',{signal:AbortSignal.timeout(10000)});assert.equal(response.status,200);
  const proof={checkedAt:new Date().toISOString(),migration:version,hash,databaseOk:true,http:response.status,
    exactFunctionPatchesVerified:true,existingPermissionsUnchanged:true,sourceConstraintsPreserved:true,
    helperProtected:true,idempotencyConstraintsPresent:true,gameplayBackfill:false,productionFixtures:0};
  writeFileSync(path.join(folder,'verified.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}
