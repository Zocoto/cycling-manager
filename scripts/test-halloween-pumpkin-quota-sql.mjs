// In-memory PostgreSQL only; this script cannot connect to production.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
if(!process.env.HALLOWEEN_SQL_TEST_MODULE) throw new Error('Isolated PGlite module required');
const {PGlite}=await import(pathToFileURL(process.env.HALLOWEEN_SQL_TEST_MODULE).href);
const db=new PGlite();
const user='00000000-0000-4000-8000-000000000001';
const request=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let checks=0;
const equal=(a,b)=>{assert.deepEqual(a,b);checks++;};
const buy=(n,item='pumpkin-juice')=>db.query(`select halloween_action($1,$2,'buy',$3::jsonb)`,[user,request(n),JSON.stringify({item})]);
const wallet=async()=> (await db.query(`select coins,inventory,obtained,purchases from halloween_wallets where user_id=$1`,[user])).rows[0];
try{
  await db.exec(`create schema auth;create table auth.users(id uuid primary key);create table riders(id uuid primary key);
    create table sporting_directors(id uuid,auth_user_id uuid,status text);
    create table team_manager_assignments(sporting_director_id uuid,status text,role text);`);
  const base=readFileSync('supabase/migrations/20261008210000_create_halloween_event.sql','utf8');
  await db.exec(base.slice(0,base.indexOf('do $$ declare t text;')).replace(/^begin;\s*/,''));
  for(const fn of JSON.parse(readFileSync('artifacts/.tmp-pumpkin-quota/functions.json','utf8'))) await db.exec(fn.definition);
  await db.exec(`insert into auth.users values('${user}');insert into sporting_directors values('${user}','${user}','active');
    insert into team_manager_assignments values('${user}','active','general_manager');
    update halloween_editions set enabled=true,starts_at=now()-interval '3 days',ends_at=now()+interval '2 days',shop_ends_at=now()+interval '3 days';
    insert into halloween_catalog(id,name,kind,price,max_obtained,effect) values
      ('pumpkin-juice','Jus de citrouille','consumable',12,30,'{"purchaseLimit":30}'),
      ('mummy-bandage','Bandage','consumable',16,30,'{"purchaseLimit":30}'),
      ('pumpkin-cap','Casquette','cosmetic',14,1,'{}');
    insert into halloween_wallets(edition_id,user_id,coins,inventory,obtained,purchases) values
      ('halloween-2026','${user}',137,'{"pumpkin-juice":1}','{"pumpkin-juice":30}','{"pumpkin-juice":30}');`);
  await assert.rejects(buy(10),/Limite d’achat/);checks++;
  const before=await wallet();
  await db.exec(readFileSync('supabase/migrations/20261016170000_unlimit_halloween_pumpkin_juice.sql','utf8'));
  equal(await wallet(),before);
  await buy(11);
  equal(await wallet(),{coins:125,inventory:{'pumpkin-juice':2},obtained:{'pumpkin-juice':31},purchases:{'pumpkin-juice':31}});
  await buy(11);equal(await wallet(),{coins:125,inventory:{'pumpkin-juice':2},obtained:{'pumpkin-juice':31},purchases:{'pumpkin-juice':31}});
  await db.query(`select halloween_gift('halloween-2026',$1,'test:gift','{"item":"pumpkin-juice"}'::jsonb)`,[user]);
  equal((await wallet()).inventory['pumpkin-juice'],3);equal((await wallet()).coins,125);
  await db.exec(`update halloween_wallets set coins=10000`);
  for(const [index,count] of [100,10000].entries()){
    await db.query(`update halloween_wallets set purchases=jsonb_build_object('pumpkin-juice',$1::int),obtained=jsonb_build_object('pumpkin-juice',$1::int)`,[count]);
    await buy(20+index);equal((await wallet()).purchases['pumpkin-juice'],count+1);
  }
  await db.exec(`update halloween_wallets set coins=11`);
  const poor=await wallet();await assert.rejects(buy(30),/insuffisantes/);checks++;equal(await wallet(),poor);
  await db.exec(`update halloween_wallets set coins=10000,purchases=purchases||'{"mummy-bandage":30,"pumpkin-cap":1}',obtained=obtained||'{"mummy-bandage":30,"pumpkin-cap":1}'`);
  await assert.rejects(buy(31,'mummy-bandage'),/Limite d’achat/);checks++;
  await assert.rejects(buy(32,'pumpkin-cap'),/Limite d’achat/);checks++;
  const catalog=(await db.query(`select id,price,max_obtained from halloween_catalog order by id`)).rows;
  equal(catalog,[{id:'mummy-bandage',price:16,max_obtained:30},{id:'pumpkin-cap',price:14,max_obtained:1},{id:'pumpkin-juice',price:12,max_obtained:null}]);
  await assert.rejects(db.exec(`update halloween_catalog set max_obtained=null where id='mummy-bandage'`),/other_items_remain_capped/);checks++;
  await db.exec(`update halloween_editions set starts_at=now()-interval '3 days',ends_at=now()-interval '2 days',shop_ends_at=now()-interval '1 day'`);
  await assert.rejects(buy(33),/terminée/);checks++;
  console.log(JSON.stringify({isolatedPostgres:true,checks,productionPurchases:false}));
}finally{await db.close();}
