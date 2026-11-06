// Entirely isolated PostgreSQL fixtures. No network or live data.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
if(!process.argv[2]?.replaceAll('\\','/').endsWith('/pglite/dist/index.js'))throw Error('Pass an existing local PGlite module.');
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const migration=readFileSync('supabase/migrations/20261106103000_draft_auto_enabled_by_default.sql','utf8').replaceAll('\r','');
const q=async(sql,args=[])=>(await db.query(sql,args)).rows;
const value=async(sql,args=[])=>(await q(sql,args))[0]?.value;
let checks=0;
const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const frozen=()=>value("select jsonb_build_object('editions',(select jsonb_agg(to_jsonb(e) order by id) from season_draft_editions e),'participants',(select jsonb_agg(to_jsonb(p) order by id) from season_draft_participants p),'riders',(select jsonb_agg(to_jsonb(r) order by rider_id) from season_draft_riders r),'settings',(select to_jsonb(s) from season_draft_settings s)) value");
const participant=n=>value('select to_jsonb(p) value from season_draft_participants p where id=$1',[id(n)]);
const edition=n=>value('select to_jsonb(e) value from season_draft_editions e where id=$1',[id(n)]);
const defaultValue=()=>value("select pg_get_expr(d.adbin,d.adrelid) value from pg_attrdef d join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum where d.adrelid='public.season_draft_participants'::regclass and a.attname='auto_enabled'");
try{
 await db.exec(`
  create role anon;create role authenticated;create role service_role;
  create table season_draft_editions(id uuid primary key,status text,starts_at timestamptz,version integer,current_position integer,pick_deadline timestamptz);
  create table season_draft_participants(id uuid primary key,edition_id uuid references season_draft_editions,team_id uuid,status text,preferences uuid[] not null default '{}',auto_enabled boolean not null default false);
  create table season_draft_riders(edition_id uuid,rider_id uuid,selected_team_id uuid,salary_per_season numeric);
  create table season_draft_settings(singleton boolean,pick_seconds integer check(pick_seconds=600));
  insert into season_draft_settings values(true,600);
  grant select on season_draft_participants,season_draft_editions to authenticated;
  create function advance_season_draft(uuid) returns void language plpgsql as $$begin raise exception 'Advancement must not run in a default migration';end$$;
  create function process_season_draft() returns void language plpgsql as $$begin raise exception 'Worker must not run in a default migration';end$$;
  create function reserve_season_draft_pool(uuid,integer) returns void language plpgsql as $$begin raise exception 'Reservation must not run in a default migration';end$$;
  insert into season_draft_editions values
    ('${id(1)}','preparing',now()+interval '1 hour',9,null,null),
    ('${id(2)}','preparing',now()+interval '2 hours',19,null,null),
    ('${id(3)}','running',now()+interval '1 hour',29,1,now()+interval '10 minutes'),
    ('${id(4)}','completed',now()-interval '1 hour',39,null,null),
    ('${id(5)}','preparing',now()-interval '1 hour',49,null,null),
    ('${id(6)}','scheduled',now()+interval '1 day',59,null,null),
    ('${id(7)}','cancelled',now()-interval '1 day',69,null,null),
    ('${id(8)}','preparing',now()+interval '2 hours',79,null,null);
  insert into season_draft_participants values
    ('${id(101)}','${id(1)}','${id(201)}','pending','{}',false),
    ('${id(102)}','${id(1)}','${id(202)}','pending','{}',false),
    ('${id(103)}','${id(1)}','${id(203)}','pending','{}',true),
    ('${id(104)}','${id(1)}','${id(204)}','pending','{${id(902)},${id(901)}}',false),
    ('${id(105)}','${id(1)}','${id(205)}','picked','{}',false),
    ('${id(106)}','${id(1)}','${id(206)}','passed','{}',false),
    ('${id(107)}','${id(2)}','${id(207)}','pending','{${id(901)}}',false),
    ('${id(108)}','${id(3)}','${id(208)}','pending','{}',false),
    ('${id(109)}','${id(4)}','${id(209)}','pending','{}',false),
    ('${id(110)}','${id(5)}','${id(210)}','pending','{}',false),
    ('${id(111)}','${id(6)}','${id(211)}','pending','{}',false),
    ('${id(112)}','${id(7)}','${id(212)}','pending','{}',false),
    ('${id(113)}','${id(8)}','${id(213)}','pending','{}',true);
  insert into season_draft_riders values('${id(1)}','${id(901)}',null,10000),('${id(3)}','${id(902)}','${id(201)}',20000);
 `);
 const before=await frozen();
 const permissions=await q("select oid::text,relacl::text from pg_class where oid in('public.season_draft_participants'::regclass,'public.season_draft_editions'::regclass) order by oid");
 check(await defaultValue(),'false','Reproduces the old unchecked default');
 await db.exec(migration);
 check(await defaultValue(),'true','Future participants default to automatic mode');
 for(const n of [101,102])check((await participant(n)).auto_enabled,true,'Unprepared pending participant '+n+' is checked');
 check((await edition(1)).version,10,'An edition with two changed participants increments only once');
 check(await participant(104),before.participants.find(p=>p.id===id(104)),'A recorded nonempty manual list retains mode and preference order');
 for(const n of [103,105,106,107,108,109,110,111,112,113]){
  check(await participant(n),before.participants.find(p=>p.id===id(n)),'Already prepared, resolved or out-of-window participant '+n+' is preserved');
 }
 for(const n of [2,3,4,5,6,7,8])check(await edition(n),before.editions.find(e=>e.id===id(n)),'Untouched edition '+n+' retains version and deadlines');
 const after=await frozen();
 check(after.riders,before.riders,'No rider is recruited, reserved or repriced');
 check(after.settings,before.settings,'The ten-minute turn setting is unchanged');
 check(await q("select oid::text,relacl::text from pg_class where oid in('public.season_draft_participants'::regclass,'public.season_draft_editions'::regclass) order by oid"),permissions,'Table identity and permissions are preserved');
 const expected=structuredClone(before);expected.editions.find(e=>e.id===id(1)).version=10;
 for(const n of [101,102])expected.participants.find(p=>p.id===id(n)).auto_enabled=true;
 check(after,expected,'Only the two eligible empty lists and their one version change are mutated');
 await db.exec(migration);check(await frozen(),after,'A retry changes no data or version');
 check(await defaultValue(),'true','A retry keeps the true default');
 await db.query("insert into season_draft_participants(id,edition_id,team_id,status) values($1,$2,$3,'pending')",[id(114),id(6),id(214)]);
 check((await participant(114)).auto_enabled,true,'The canonical future insert with an omitted auto column starts checked');
 await db.query("insert into season_draft_participants(id,edition_id,team_id,status,preferences,auto_enabled) values($1,$2,$3,'pending',$4::uuid[],false)",[id(115),id(6),id(215),[id(902),id(901)]]);
 check((await participant(115)).auto_enabled,false,'An explicit future manual choice remains possible');
 const beforeFinal=await frozen();await db.exec(migration);check(await frozen(),beforeFinal,'Further retries preserve newly recorded manual choices');
 console.log(JSON.stringify({checks,isolated:true,productionTouched:false}));
}finally{await db.close();}
