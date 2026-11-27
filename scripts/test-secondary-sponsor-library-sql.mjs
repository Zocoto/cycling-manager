// Isolated PostgreSQL/WASM only. No credentials, network, or production state.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.argv[2] ?? 'C:/Dev/.tmp-chat-translation-sql-20261005/node_modules/@electric-sql/pglite/dist/index.js').href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const read = file => readFileSync(new URL(file,import.meta.url),'utf8').replaceAll('\r\n','\n');
const migration = read('../supabase/migrations/20261127180000_use_canonical_secondary_sponsor_library.sql');
let checks=0;
const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const rows=async(sql,args=[])=>(await db.query(sql,args)).rows;
const scalar=async(sql,args=[])=>Object.values((await rows(sql,args))[0])[0];
const number=async(sql,args=[])=>Number(await scalar(sql,args));
const snapshot=table=>rows(`select to_jsonb(t) data from public.${table} t order by to_jsonb(t)::text`);
async function rejects(fn,pattern){await assert.rejects(fn,pattern);checks++;}
async function asUser(n,sql,args=[]){
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(n)]);
  await db.exec('set role authenticated');
  try{return await db.query(sql,args);}finally{await db.exec('reset role');}
}
try{
  // Reuse the shared isolated fixture schema, then load real migrations rather
  // than a second implementation of their eligibility/finance/quota behavior.
  const fixture=read('./test-secondary-sponsor-rebalance-sql.mjs').match(/await db\.exec\(`([\s\S]*?)`\);/)[1];
  await db.exec(fixture);
  await db.exec(`alter table public.team_sponsor_contracts add column budget_per_season numeric(14,2) default 2000000;
    alter table public.team_sponsor_contracts add column currency_code text default 'EUR';
    alter table public.sponsors add column name text,add column catalog_key text,add column status text default 'active';
    update public.sponsors set name='Existing primary '||id,catalog_key='existing-primary-'||id;
    create unique index fixture_sponsor_names on public.sponsors(lower(name));
    create unique index fixture_sponsor_keys on public.sponsors(catalog_key);
    create unique index fixture_country_codes on public.countries(iso_alpha2);`);
  const baseline=read('../supabase/migrations/20260927230000_add_s4_main_and_secondary_sponsors.sql');
  await db.exec(baseline.slice(baseline.indexOf('create table public.secondary_sponsor_catalog')));
  await db.exec(read('../supabase/migrations/20261106193000_remove_secondary_sponsor_country_suffixes.sql'));
  const reputation=read('../supabase/migrations/20260927200000_create_s4_reputation_system.sql');
  await db.exec(reputation.slice(reputation.indexOf('create or replace function private.apply_reputation_delta('),reputation.indexOf('create or replace function private.create_reputation_commitment(')));
  const finance=read('../supabase/migrations/20261016120000_add_financial_director.sql');
  await db.exec(finance.slice(finance.indexOf('create function private.credit_financial_director_transaction_bonus()'),finance.indexOf('create function public.settle_due_financial_director_income()')));
  await db.exec(read('../supabase/migrations/20261127130000_rebalance_secondary_sponsor_objectives.sql'));
  await db.exec(read('../supabase/migrations/20261127160000_cap_secondary_sponsor_rewards_to_primary_budget.sql'));
  const sourceSnapshot=migration.match(/-- BEGIN REVIEWED LIBRARY SNAPSHOT\n([\s\S]*?)-- END REVIEWED LIBRARY SNAPSHOT/)[1];
  await db.exec(`create table fixture_library(catalog_key text,name text,country_code text,prestige integer,primary_color text,accent_color text);`
    +sourceSnapshot.replaceAll('secondary_library_snapshot','fixture_library'));
  await db.exec(`insert into public.countries(id,name,iso_alpha2)
    select gen_random_uuid(),country_code,country_code from fixture_library group by country_code on conflict(iso_alpha2) do nothing;
    insert into public.sponsors(id,country_id,catalog_key,name,status)
    select gen_random_uuid(),country.id,library.catalog_key,library.name,'active'
    from fixture_library library join public.countries country on country.iso_alpha2=library.country_code;`);
  const legacy=async(country,slot)=>scalar('select id from public.secondary_sponsor_catalog where country_id=$1 and slot_number=$2',[id(country),slot]);
  const legacyFR=await legacy(2,9),legacyCO=await legacy(1,9),legacyAM=await legacy(3,9);
  const race=(n,cash=500000)=>({objective_kind:'race_result',race_edition_id:id(1000+n),race_slug:'race-'+n,
    race_label:'Race '+n,race_category_code:'elite',target_rank:2,cash_reward:cash,reputation_penalty:50});
  const oldPayload=[legacyFR,legacyCO,legacyAM].map((sponsor,n)=>({secondary_sponsor_id:sponsor,objectives:[race(n),race(n+1),race(n+2)]}));
  for(const team of [2,3])await scalar('select public.replace_secondary_sponsor_offers($1,$2,$3,$4::jsonb,2)',[id(100+team),id(300+team),id(501),JSON.stringify(oldPayload)]);
  // A historical active and a signed planned legacy agreement survive exactly.
  for(const [team,season,status] of [[0,501,'planned'],[1,500,'active']]){
    await db.query(`insert into public.secondary_sponsor_offers(id,sporting_director_id,team_id,target_season_id,secondary_sponsor_id,status,generation_version)
      values($1,$2,$3,$4,$5,'accepted',1)`,[id(1500+team),id(100+team),id(300+team),id(season),legacyFR]);
    await db.query(`insert into public.secondary_sponsor_contracts(offer_id,team_id,season_id,secondary_sponsor_id,status)
      values($1,$2,$3,$4,$5)`,[id(1500+team),id(300+team),id(season),legacyFR,status]);
    await db.query(`insert into public.secondary_sponsor_objectives(offer_id,display_order,race_edition_id,race_slug,race_label,race_category_code,target_rank,cash_reward,reputation_penalty,status)
      values($1,1,$2,'legacy','Legacy signed race','elite',1,900000,0,$3)`,[id(1500+team),id(1000),status==='planned'?'draft':'active']);
  }
  const preservedTables=['secondary_sponsor_contracts','secondary_sponsor_objectives','team_finance_transactions','team_seasons','reputation_ledger'];
  const before=Object.fromEntries(await Promise.all(preservedTables.map(async table=>[table,await snapshot(table)])));
  const offersBefore=await rows('select id,secondary_sponsor_id,status,principal_country_id,principal_budget_per_season,maximum_reward_budget from public.secondary_sponsor_offers order by id');
  const catalogBefore=await rows('select id,country_id,catalog_key,name,prestige,slot_number,primary_color,accent_color,logo_variant from public.secondary_sponsor_catalog order by id');
  check(await number("select count(distinct country_id) from public.secondary_sponsor_catalog where name='TerraNova'"),3,'Fixture reproduces one old brand cloned across countries');
  await db.exec(migration);
  for(const table of preservedTables)check(await snapshot(table),before[table],`${table} remains byte-for-byte unchanged`);
  check(await rows('select id,country_id,catalog_key,name,prestige,slot_number,primary_color,accent_color,logo_variant from public.secondary_sponsor_catalog where source_sponsor_id is null order by id'),catalogBefore,'Legacy brand identity, country and assets are preserved');
  const offersAfter=await rows('select id,secondary_sponsor_id,status,principal_country_id,principal_budget_per_season,maximum_reward_budget from public.secondary_sponsor_offers order by id');
  check(offersAfter,offersBefore.map(offer=>({...offer,status:offer.status==='open'?'withdrawn':offer.status})),'Only six unsigned clone offers are withdrawn');
  check(await number('select count(*) from public.secondary_sponsor_catalog where source_sponsor_id is not null'),630,'All existing real library identities are linked exactly once');
  check(await number('select count(distinct lower(btrim(name))) from public.secondary_sponsor_catalog where available_for_offers'),630,'Every available brand name is globally unique');
  check(await number('select count(*) from public.secondary_sponsor_catalog where source_sponsor_id is null and available_for_offers'),0,'Clones cannot produce new proposals');
  check(await number(`select count(*) from public.secondary_sponsor_catalog secondary join public.sponsors source on source.id=secondary.source_sponsor_id
    where secondary.country_id<>source.country_id or secondary.name<>source.name or secondary.catalog_key<>'library-'||source.catalog_key`),0,'Every canonical identity keeps its one source country');
  check((await scalar('select public.get_secondary_sponsor_offer_context($1,$2)',[id(302),id(501)])).principal_sponsor_id,id(600),'The existing context exposes the actual target-season principal identity');
  const canonical=async(code)=>scalar(`select secondary.id from public.secondary_sponsor_catalog secondary join public.countries country on country.id=secondary.country_id
    where secondary.available_for_offers and country.iso_alpha2=$1 order by secondary.prestige desc,secondary.id limit 1`,[code]);
  const fr=await canonical('FR'),co=await canonical('CO'),am=await canonical('AM');
  const payload=[{secondary_sponsor_id:fr,objectives:[race(0),race(1),race(2),race(3),{
    objective_kind:'roster_nationality',target_country_id:id(2),required_rider_count:2,cash_reward:200000,reputation_penalty:0
  }]},{secondary_sponsor_id:co,objectives:[race(4),race(5),race(6),race(7),race(8)]},
    {secondary_sponsor_id:am,objectives:[race(5),race(6),race(7),race(8),race(9)]}];
  const replace=(team,proposals=payload,version=3)=>scalar('select public.replace_secondary_sponsor_offers($1,$2,$3,$4::jsonb,$5)',[id(100+team),id(300+team),id(501),JSON.stringify(proposals),version]);
  await rejects(()=>replace(2,oldPayload),/bibliothèque/);
  await rejects(()=>replace(2,payload,2),/bibliothèque/);
  const duplicate=structuredClone(payload);duplicate[1].secondary_sponsor_id=fr;
  await rejects(()=>replace(2,duplicate),/trois marques distinctes/);
  const wrongQuota=structuredClone(payload);wrongQuota[0].objectives[4].target_country_id=id(3);
  await rejects(()=>replace(2,wrongQuota),/nationalité/);
  check(await replace(2),true,'Canonical V3 proposals use the real atomic replacement path');
  const newOffers=await rows("select id,generation_version,secondary_sponsor_id from public.secondary_sponsor_offers where team_id=$1 and status='open' order by id",[id(302)]);
  check(newOffers.length,3,'Exactly three canonical proposals are persisted');
  check(newOffers.map(offer=>offer.generation_version),[3,3,3],'All generated proposals are atomically marked V3');
  for(const offer of newOffers)check(await number('select sum(cash_reward) from public.secondary_sponsor_objectives where offer_id=$1',[offer.id]),600000,'Original 30 percent cap remains enforced');
  const firstNewSnapshot=await snapshot('secondary_sponsor_objectives');
  check(await replace(2),false,'Repeated generation does not reroll preferences or goals');
  check(await snapshot('secondary_sponsor_objectives'),firstNewSnapshot,'Idempotent V3 rerender preserves every objective');
  await db.exec('update public.team_sponsor_contracts set budget_per_season=1000000 where team_id=fixture_id(302)');
  for(const offer of newOffers){
    check(await number('select sum(cash_reward) from public.secondary_sponsor_objectives where offer_id=$1',[offer.id]),300000,'Budget changes retain their reviewed cap behavior');
    check(await number('select generation_version from public.secondary_sponsor_offers where id=$1',[offer.id]),3,'A budget change retains the V3 identity generation');
  }
  const pick=newOffers.find(offer=>offer.secondary_sponsor_id===fr).id;
  await rejects(()=>asUser(200,'select public.sign_secondary_sponsor_offer($1)',[pick]),/Actualisez/);
  const contract=(await asUser(202,'select public.sign_secondary_sponsor_offer($1)',[pick])).rows[0].sign_secondary_sponsor_offer;
  check(await scalar('select status from public.secondary_sponsor_contracts where id=$1',[contract]),'planned','Authorized canonical offer can be signed');
  check(await number('select sum(cash_reward) from public.secondary_sponsor_objectives where offer_id=$1',[pick]),300000,'Signing keeps capped rewards');
  check(await replace(2),false,'A signed agreement is never replaced by refresh');
  await rejects(()=>asUser(203,'select public.sign_secondary_sponsor_offer($1)',[offersBefore.find(offer=>offer.status==='open').id]),/Actualisez/);
  await rejects(()=>db.query('update public.secondary_sponsor_catalog set country_id=$1 where id=$2',[id(1),fr]),/permanents/);
  const frSource=await scalar('select source_sponsor_id from public.secondary_sponsor_catalog where id=$1',[fr]);
  await rejects(()=>db.query('update public.secondary_sponsor_catalog set source_sponsor_id=$1 where id=$2',[id(600),fr]),/permanents/);
  await rejects(()=>db.query('update public.sponsors set country_id=$1 where id=$2',[id(1),frSource]),/seul pays/);
  await rejects(()=>db.query("update public.secondary_sponsor_catalog set name='Forged country brand' where id=$1",[fr]),/identité et le pays/);
  const beforeNoop=await snapshot('secondary_sponsor_catalog');
  await db.query('update public.sponsors set name=name,catalog_key=catalog_key,status=status where id=$1',[frSource]);
  check(await snapshot('secondary_sponsor_catalog'),beforeNoop,'Ordinary sponsor sync no-op does not rewrite the catalogue');
  const originalParent=(await rows('select name,catalog_key,country_id from public.sponsors where id=$1',[frSource]))[0];
  await db.query("update public.sponsors set name='Reviewed rebrand',catalog_key='reviewed-rebrand' where id=$1",[frSource]);
  check((await rows('select name,catalog_key,country_id from public.secondary_sponsor_catalog where id=$1',[fr]))[0],
    {name:'Reviewed rebrand',catalog_key:'library-reviewed-rebrand',country_id:originalParent.country_id},'A parent rebrand synchronizes the same identity without nationality drift');
  await db.query('update public.sponsors set name=$1,catalog_key=$2 where id=$3',[originalParent.name,originalParent.catalog_key,frSource]);
  await db.query("update public.sponsors set status='inactive' where id=$1",[frSource]);
  check(await scalar('select available_for_offers from public.secondary_sponsor_catalog where id=$1',[fr]),false,'Inactive parent disables future secondary offers');
  check(await scalar('select status from public.secondary_sponsor_contracts where id=$1',[contract]),'planned','Disabling a brand does not cancel its signed agreement');
  await rejects(()=>replace(3),/marques distinctes/);
  await db.query("update public.sponsors set status='active' where id=$1",[frSource]);
  check(await scalar('select available_for_offers from public.secondary_sponsor_catalog where id=$1',[fr]),true,'Reactivation restores the same canonical identity');
  await db.query('update public.team_sponsor_contracts set sponsor_id=$1 where team_id=$2',[frSource,id(303)]);
  await rejects(()=>replace(3),/différentes du sponsor principal/);
  await db.query('update public.team_sponsor_contracts set sponsor_id=$1 where team_id=$2',[id(600),id(303)]);
  check(await replace(3),true,'A different principal permits a fresh secondary agreement');
  const anotherFR=await scalar(`select secondary.id from public.secondary_sponsor_catalog secondary join public.countries country on country.id=secondary.country_id
    where secondary.available_for_offers and country.iso_alpha2='FR' and secondary.id<>$1 order by secondary.prestige desc,secondary.id limit 1`,[fr]);
  const alternate=structuredClone(payload);alternate[0].secondary_sponsor_id=anotherFR;
  const beforeDisabledRefresh=await rows("select id from public.secondary_sponsor_offers where team_id=$1 and status='open' order by id",[id(303)]);
  await db.query("update public.sponsors set status='inactive' where id=$1",[frSource]);
  check(await replace(3,alternate),true,'Deactivating an unsigned brand permits an atomic refresh to another real brand');
  const afterDisabledRefresh=await rows("select id from public.secondary_sponsor_offers where team_id=$1 and status='open' order by id",[id(303)]);
  check(afterDisabledRefresh.some(offer=>beforeDisabledRefresh.some(old=>old.id===offer.id)),false,'Stale disabled offers do not survive the private V2 completeness shortcut');
  check(await replace(3,alternate),false,'The repaired available proposals remain stable');
  const damaged=await scalar("select id from public.secondary_sponsor_offers where team_id=$1 and status='open' and secondary_sponsor_id=$2",[id(303),am]);
  await db.query('delete from public.secondary_sponsor_objectives where id=(select id from public.secondary_sponsor_objectives where offer_id=$1 order by display_order limit 1)',[damaged]);
  check(await replace(3,alternate),true,'An incomplete unsigned objective set can be rebuilt atomically');
  check(await replace(3,alternate),false,'The rebuilt complete objective set does not reroll again');
  await db.query("update public.sponsors set status='active' where id=$1",[frSource]);
  check((await rows(`select has_function_privilege('service_role','public.replace_secondary_sponsor_offers(uuid,uuid,uuid,jsonb,integer)','execute') replace,
    has_function_privilege('authenticated','public.replace_secondary_sponsor_offers(uuid,uuid,uuid,jsonb,integer)','execute') playerreplace,
    has_function_privilege('service_role','private.replace_secondary_sponsor_offers_budgeted(uuid,uuid,uuid,jsonb,integer)','execute') oldreplace,
    has_function_privilege('authenticated','private.sign_secondary_sponsor_offer_budgeted(uuid)','execute') oldsign,
    has_function_privilege('authenticated','public.sign_secondary_sponsor_offer(uuid)','execute') sign`))[0],
    {replace:true,playerreplace:false,oldreplace:false,oldsign:false,sign:true},'Only the authenticated signing and service generation entry points remain callable');
  check(await snapshot('team_finance_transactions'),before.team_finance_transactions,'Library migration/generation/signing never invent a payment');
  check(await snapshot('reputation_ledger'),before.reputation_ledger,'Library changes never invent a reputation adjustment');
  console.log(`Secondary sponsor library SQL checks passed (${checks} assertions; 630 canonical brands, isolated database).`);
}catch(error){console.error('Secondary sponsor library SQL test failed:',error.message,error.where??'',error.detail??'');process.exitCode=1;}
finally{await db.close();}
