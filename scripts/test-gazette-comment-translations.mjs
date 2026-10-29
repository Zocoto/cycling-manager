// Local PostgreSQL/WASM only. No network, production fixtures or provider calls.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const modulePath=process.argv[2];
if(process.argv.length!==3||!isAbsolute(modulePath??'')||!modulePath.replaceAll('\\','/').endsWith('/@electric-sql/pglite/dist/index.js'))throw Error('Absolute local PGlite module required; production URLs unsupported.');
const {PGlite}=await import(pathToFileURL(modulePath).href);
const db=new PGlite();
let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const rows=async(sql,values=[]) => (await db.query(sql,values)).rows;
const scalar=async(sql,values=[]) => Object.values((await rows(sql,values))[0])[0];
const one='11111111-1111-4111-8111-111111111111',two='22222222-2222-4222-8222-222222222222';
const item=(message_id,text='Bonjour')=>({message_id,source_fingerprint:createHash('sha256').update(text).digest('hex'),characters:text.length});
const claim=async(owner,locale,items)=>scalar('select public.claim_gazette_comment_translation_batch($1,$2,$3::jsonb)',[owner,locale,JSON.stringify(items)]);
const complete=(ticket,results,success=true)=>db.query('select public.complete_gazette_comment_translation_batch($1,$2::jsonb,$3)',[ticket,JSON.stringify(results),success]);
const budget=()=>rows('select * from gazette_comment_translation_daily_budget');
const result=(messageId,text='Hello')=>({messageId,translatedText:text,detectedSourceLocale:'fr',provider:'vercel-ai-gateway'});
try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create table sporting_directors(id uuid primary key);
    create table global_chat_translation_daily_budget(budget_date date,reserved_characters int,reserved_generations int);
    insert into global_chat_translation_daily_budget values(current_date,1234,42);
    insert into sporting_directors values('${one}'),('${two}');`);
  const chat=await rows('select * from global_chat_translation_daily_budget');
  await db.exec(await readFile(new URL('../supabase/migrations/20261029120000_add_gazette_comment_translations.sql',import.meta.url),'utf8'));
  const [first]=await claim(one,'en',[item('pre:first')]);
  eq(first.status,'claimed','first reader claims a generation');
  eq((await claim(two,'en',[item('post:other')]))[0].status,'busy','concurrent readers share one in-flight job by content');
  eq(await scalar('select count(*)::int from gazette_comment_translation_requests'),1,'busy reads consume no generation quota');
  await complete(first.ticket,[result('pre:first')]);
  const before=await budget();
  const [cached]=await claim(two,'en',[item('another-issue')]);
  eq([cached.status,cached.translatedText],['cached','Hello'],'identical published words share a cache across editions/fields');
  eq(await budget(),before,'cache hits never update budget');
  eq(await scalar('select count(*)::int from gazette_comment_translation_requests'),1,'cache hits do not count against the reader');
  const [edited]=await claim(one,'en',[item('pre:first','Un texte modifié')]);
  eq(edited.status,'claimed','edited text invalidates only its own fingerprint');
  await complete(first.ticket,[result('pre:first','stale')]);
  eq(await scalar('select count(*)::int from gazette_comment_translations'),1,'late stale completion cannot write a new generation');
  await complete(edited.ticket,[result('pre:first','Edited text')]);
  eq(await scalar('select count(*)::int from gazette_comment_translations'),2,'older published snapshots retain their own cached copy');
  const [french]=await claim(one,'fr',[item('pre:first')]);
  eq(french.status,'claimed','French and English caches are separate');
  await complete(french.ticket,[],false);
  eq((await claim(two,'fr',[item('new','New English quote')]))[0].status,'unavailable','failure opens only the Gazette circuit breaker');
  eq((await claim(two,'fr',[item('pre:first')]))[0].status,'busy','failed jobs are cooled down instead of retried on every read');
  eq(await rows('select * from global_chat_translation_daily_budget'),chat,'Gazette requests never consume chat budget');
  await db.exec('truncate gazette_comment_translation_jobs,gazette_comment_translations,gazette_comment_translation_requests,gazette_comment_translation_daily_budget');
  for(let batch=0;batch<6;batch++) {
    const response=await claim(one,'en',Array.from({length:5},(_,i)=>item(`q:${batch}:${i}`,`Unique content ${batch}-${i}`)));
    eq(response.every(r=>r.status==='claimed'),true,'one bounded batch');
  }
  eq((await claim(one,'en',[item('over-quota','One more')]))[0].status,'quota','30 new texts maximum per reader per hour');
  await db.exec('update gazette_comment_translation_daily_budget set reserved_generations=200');
  eq((await claim(two,'en',[item('daily-max','Day budget')]))[0].status,'budget','global daily generation cap');
  await db.exec('update gazette_comment_translation_daily_budget set reserved_generations=0,reserved_characters=14999');
  eq((await claim(two,'en',[item('char-max','More than one character')]))[0].status,'budget','global daily character cap');
  const quotaBefore=await scalar('select count(*)::int from gazette_comment_translation_requests');
  const budgetBefore=await budget();
  await assert.rejects(claim(two,'en',[item('valid'),{...item('bad'),characters:601}]),/Invalid translation source/);checks++;
  eq(await budget(),budgetBefore,'invalid mixed batch rolls its reservation back atomically');
  eq(await scalar('select count(*)::int from gazette_comment_translation_requests'),quotaBefore,'invalid mixed batch leaves no quota writes');
  for(const [locale,items] of [['es',[item('a')]],['en',[]],['en',Array.from({length:6},(_,i)=>item(String(i)))],['en',[{...item('a'),source_fingerprint:'bad'}]]]){
    await assert.rejects(claim(one,locale,items),/Invalid translation/);checks++;
  }
  await db.exec('set role authenticated');
  await assert.rejects(claim(one,'en',[item('direct')]),/permission denied/);checks++;
  await assert.rejects(db.exec('select * from gazette_comment_translations'),/permission denied/);checks++;
  await db.exec('reset role');
  console.log(JSON.stringify({isolatedPostgresChecks:checks,chatBudgetPreserved:true,productionAccess:false,providerCalls:0}));
} finally {await db.close();}
