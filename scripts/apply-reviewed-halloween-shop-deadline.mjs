// Only the owner-approved shop deadline and one obsolete error message change.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
const mode = process.argv[2];
assert(['--inspect','--apply'].includes(mode));
assert.equal(readFileSync('supabase/.temp/project-ref','utf8').trim(),'ikagfuchasnsakpouosg');
const version='20261030130000', name='close_halloween_shop_with_season_four';
const source=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r\n','\n');
const hash=value=>createHash('md5').update(value).digest('hex');
const quote=value=>`'${value.replaceAll("'","''")}'`;
const require=createRequire(import.meta.url);
const binary=join(dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin','supabase.exe');
function query(sql) {
  const directory=mkdtempSync(join(tmpdir(),'halloween-shop-reviewed-')), file=join(directory,'query.sql');
  try {
    writeFileSync(file,sql);
    const output=execFileSync(binary,['db','query','--linked','--file',file,'--output','json'],{
      encoding:'utf8',timeout:30000,maxBuffer:200000,
    });
    assert(output.includes('{'),'Missing receipt; inspect before retrying.');
    return JSON.parse(output.slice(output.indexOf('{'))).rows;
  } finally {rmSync(file,{force:true});rmdirSync(directory);}
}
function inspect() {
  return query(`begin read only;
    set local application_name='halloween-shop-deadline-receipt-20261030';
    set local statement_timeout='3s';set local lock_timeout='500ms';
    select true as database_ok,
      (select md5(statements[1]) from supabase_migrations.schema_migrations where version=${quote(version)}) as recorded_hash,
      (select to_jsonb(edition) from public.halloween_editions edition where id='halloween-2026') as edition,
      (select max(day.calendar_date) from public.season_days day join public.seasons season on season.id=day.season_id where season.game_year=4) as last_season_four_day,
      replace(pg_get_functiondef('public.halloween_action(uuid,uuid,text,jsonb)'::regprocedure),chr(13),'') as action_definition,
      (select jsonb_build_object('acl',proacl::text,'definer',prosecdef,'config',proconfig) from pg_proc
        where oid='public.halloween_action(uuid,uuid,text,jsonb)'::regprocedure) as action_attributes,
      (select jsonb_object_agg(oid::regprocedure::text,md5(pg_get_functiondef(oid))) from pg_proc where oid in(
        'public.get_current_halloween_state()'::regprocedure,'public.settle_halloween_event()'::regprocedure,
        'public.halloween_use_item(uuid,text,uuid)'::regprocedure,'public.halloween_use_items(uuid,text,uuid,integer)'::regprocedure)) as protected_functions;
    commit;`)[0];
}
const summarize=row=>({database_ok:row.database_ok,recorded:Boolean(row.recorded_hash),
  shop_ends_at:row.edition.shop_ends_at,games_end_at:row.edition.ends_at,
  last_season_four_day:row.last_season_four_day,action_hash:hash(row.action_definition),protected_functions:row.protected_functions});
const before=inspect();
assert(before.database_ok && before.last_season_four_day==='2026-11-05');
if(before.recorded_hash)assert.equal(before.recorded_hash,hash(source),'Recorded migration differs.');
if(mode==='--inspect'){console.log(JSON.stringify(summarize(before)));process.exit(0);}
if(!before.recorded_hash){
  const old=source.split('$old_message$')[1],replacement=source.split('$new_message$')[1];
  assert(old&&replacement);
  assert.equal(before.action_definition.split(old).length,2);
  assert.equal(Object.keys(before.protected_functions).length,4);
  query(source.replace(/commit;\s*$/,()=>`insert into supabase_migrations.schema_migrations(version,name,statements)
    values(${quote(version)},${quote(name)},array[${quote(source)}]);\ncommit;`));
  const after=inspect();
  assert(after.database_ok);
  assert.equal(after.recorded_hash,hash(source));
  assert.equal(after.action_definition,before.action_definition.replace(old,replacement));
  assert.deepEqual(after.action_attributes,before.action_attributes);
  assert.deepEqual(after.protected_functions,before.protected_functions);
  const expectedEdition={...before.edition,shop_ends_at:after.edition.shop_ends_at};
  assert.deepEqual(after.edition,expectedEdition,'Unexpected event change outside the shop deadline.');
  assert.equal(Date.parse(after.edition.shop_ends_at),Date.parse('2026-11-05T23:00:00Z'));
  assert.equal(Date.parse(after.edition.ends_at),Date.parse('2026-11-02T23:00:00Z'));
  console.log(JSON.stringify({...summarize(after),other_event_fields_and_inventory_functions_preserved:true}));
}else{
  assert.equal(Date.parse(before.edition.shop_ends_at),Date.parse('2026-11-05T23:00:00Z'));
  console.log(JSON.stringify({...summarize(before),already_applied:true}));
}
