// Requested real publication through the existing audited editor routines.
// Creates a new leading article; never edits/deletes the previous release note.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const mode=process.argv[2];if(process.argv.length!==3||!['--inspect','--publish-reviewed'].includes(mode)||readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg')throw Error('Exact mode and project required');
const id='9058f719-d72b-4990-91ab-1722a15bac82',owner='58140add-54c6-40af-9528-f823d0051d0f';
const document=JSON.parse(readFileSync('Docs/gala-s4-announcement-20261023.json','utf8'));
if(document.link_url!=='/jeu/gala-saison-4'||document.image_path!=='/images/gala/gala-s4-announcement.svg'||/draft/i.test(JSON.stringify(document)))throw Error('Unexpected publication document');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const require=createRequire(import.meta.url),binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const directory='artifacts/gala-s4-publication-20261023';mkdirSync(directory,{recursive:true});
function run(sql){const file=path.resolve(directory,'reviewed-news-command.sql');writeFileSync(file,sql);const raw=execFileSync(binary,['db','query','--linked','--file',file,'--output','json'],{encoding:'utf8',timeout:20000,maxBuffer:50000});return JSON.parse(raw.slice(raw.indexOf('{'))).rows;}
if(mode==='--inspect'){
 console.log(JSON.stringify(run(`begin read only;set local statement_timeout='3s';set local application_name='gala-news-inspect';select id,revision,published_at,published->>'title' title from private.game_product_news where id='${id}' or id=(select id from private.game_product_news where published is not null order by published_at desc,id desc limit 1) order by published_at desc nulls last;commit;`)));process.exit(0);
}
const asset=await fetch('https://cyclostratege.fr'+document.image_path,{signal:AbortSignal.timeout(10000)});
if(asset.status!==200||!(await asset.text()).includes('<svg'))throw Error('Deploy the gala page and illustration before publishing');
const result=run(`begin;set local statement_timeout='5s';set local lock_timeout='1s';set local application_name='gala-news-requested-publication';
select set_config('request.jwt.claim.sub','${owner}',true);
do $publication$ declare v_document jsonb := ${quote(JSON.stringify(document))}::jsonb;v_existing private.game_product_news%rowtype;begin
 if not pg_try_advisory_xact_lock(hashtextextended('gala-s4-news:${id}',0)) then raise exception 'Publication already in progress'; end if;
 select * into v_existing from private.game_product_news where id='${id}' for update;
 if found then
  if v_existing.published is not distinct from v_document then return; end if;
  raise exception 'Existing announcement differs; do not overwrite';
 end if;
 perform public.save_game_news_draft('${id}',0,v_document);
 perform public.publish_game_news('${id}',1);
end;$publication$;
select id,revision,published_at,published->>'title' title from private.game_product_news where id='${id}';commit;`);
writeFileSync(path.join(directory,'news-publication-receipt.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
