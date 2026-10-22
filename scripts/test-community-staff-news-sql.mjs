// Isolated PostgreSQL/WASM only: this script has no network, URL or credentials.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const modulePath = process.env.COMMUNITY_SQL_TEST_MODULE ?? resolve('artifacts/.tmp-performance-preparations/node_modules/@electric-sql/pglite/dist/index.js');
const {PGlite} = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let checks = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const rows = async (query, params = []) => (await db.query(query, params)).rows;
const scalar = async (query, params = []) => Object.values((await rows(query, params))[0])[0];
const auth = async (n, role = 'authenticated') => {
  await db.exec('reset role');
  await db.query("select set_config('test.auth_uid',$1,false)", [n === null ? '' : id(n)]);
  await db.exec(`set role ${role}`);
};
const rejects = async (query, params = [], code) => {
  await assert.rejects(() => db.query(query, params), error => code ? error.code === code : true);
  checks++;
};
const document = {
  title: 'Une nouveauté du peloton 🚴', category: 'Nouveauté',
  summary: 'Découvrez les nouvelles fonctionnalités de votre équipe.',
  body: '**Bonjour les DS !**\n\n✅ Une vraie nouveauté, sans perdre votre session. 🎉',
  title_en: 'A new feature for the peloton', category_en: 'Game update',
  summary_en: 'Discover the new features available for your team.',
  body_en: '**Hello managers!**\n\nYour game session remains active.',
  image_path: '/images/announcements/saison-3-federations.webp',
  image_alt: 'Une route de montagne', link_url: '/jeu/federation', link_label: 'Découvrir',
};
const save = async (n, revision, doc = document) => rows('select * from public.save_game_news_draft($1,$2,$3)', [n === null ? null : id(n), revision, doc]);
const publish = async (n, revision) => rows('select * from public.publish_game_news($1,$2)', [id(n), revision]);
const published = async (n = null, limit = 20) => rows('select * from public.get_published_game_news($1,$2)', [limit, n === null ? null : id(n)]);

try {
  await db.exec(`
    create schema private; create schema auth;
    create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public, auth to anon, authenticated, service_role;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.auth_uid',true),'')::uuid $$;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create table public.sporting_directors(id uuid primary key,auth_user_id uuid unique references auth.users(id),
      display_name text,username text,status text default 'active');
    create function public.get_current_game_header_indicators_v2()
    returns table(current_sporting_director_id uuid,mailbox_unread_count integer,
      direct_message_unread_count integer,has_unread_global_chat boolean,has_unread_cyclogazette boolean)
    language sql stable security definer set search_path='' as $$
      select d.id, 7, 3, true, false from public.sporting_directors d where d.auth_user_id=auth.uid() $$;
    insert into auth.users(id,email) values
      ('${id(1)}','Paul.Leblanc22@gmail.com'),('${id(2)}','staff@example.invalid'),
      ('${id(3)}','member@example.invalid'),('${id(4)}','paul.leblanc22+fake@gmail.com'),
      ('${id(5)}','suspended@example.invalid'),('${id(6)}','retired@example.invalid');
    insert into public.sporting_directors values
      ('${id(11)}','${id(1)}','Zocoto','zocoto','active'),
      ('${id(12)}','${id(2)}','Aide Delivery','delivery','active'),
      ('${id(13)}','${id(3)}','Membre ordinaire','member','active'),
      ('${id(14)}','${id(4)}','Faux propriétaire','fake-owner','active'),
      ('${id(15)}','${id(5)}','Suspendu','suspended','suspended'),
      ('${id(16)}','${id(6)}','Retraité','retired','retired');
  `);
  const migration = readFileSync('supabase/migrations/20261022123001_community_staff_and_news.sql', 'utf8');
  // Even a manual migration must roll back completely when the principal
  // account has the right email but is not the expected Zocoto director.
  await db.query('update public.sporting_directors set username=$1 where id=$2',['another-director',id(11)]);
  await assert.rejects(()=>db.exec(migration),error=>error.code==='P0001');
  checks++;
  await db.exec('rollback');
  check(await scalar("select to_regclass('private.user_game_roles')::text"),null);
  await db.query('update public.sporting_directors set username=$1 where id=$2',['zocoto',id(11)]);
  await db.exec(migration);
  const headerV2Definition = await scalar("select pg_get_functiondef('public.get_current_game_header_indicators_v2()'::regprocedure)");
  check(await scalar('select count(*)::integer from private.user_game_roles'), 1);
  check(await scalar('select role from private.user_game_roles'), 'owner');
  // The unique partial index enforces a single founder even for PostgreSQL
  // access outside RPCs; delegated staff can never create a second founder.
  await rejects("insert into private.user_game_roles(auth_user_id,role) values($1,'owner')",[id(3)],'23505');
  check(await scalar('select auth_user_id from private.user_game_roles where role=$1',['owner']),id(1));
  check(await scalar('select count(*)::integer from private.user_game_role_events'), 1);
  check(await scalar("select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname in ('user_game_roles','user_game_role_events','game_product_news','game_product_news_events') and c.relrowsecurity"), 4);

  // Client roles never read private drafts, role assignments or audit tables.
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await auth(role === 'anon' ? null : 3, role);
    for (const table of ['user_game_roles', 'user_game_role_events', 'game_product_news', 'game_product_news_events']) {
      await rejects(`select * from private.${table}`, [], '42501');
    }
    await rejects('select private.current_game_role()', [], '42501');
    await rejects("insert into private.user_game_roles(auth_user_id,role) values($1,'owner')", [id(3)], '42501');
  }
  await auth(null, 'anon');
  check(await published(), []);
  for (const query of [
    'select public.get_current_user_game_role()', 'select * from public.get_current_game_header_indicators_v3()', 'select * from public.get_game_staff_directory()',
    'select * from public.get_game_staff_members()', "select * from public.search_game_staff_candidates('de',10)",
    'select * from public.get_game_news_editor(null)',
    `select * from public.save_game_news_draft(null,0,'{}')`,
    `select * from public.publish_game_news('${id(100)}',1)`,
    `select public.set_game_staff_role('${id(3)}',true)`,
  ]) await rejects(query, [], '42501');

  await auth(3);
  check(await scalar('select public.get_current_user_game_role()'), null);
  check(await rows('select * from public.get_current_game_header_indicators_v3()'), [{current_sporting_director_id:id(13),mailbox_unread_count:7,direct_message_unread_count:3,has_unread_global_chat:true,has_unread_cyclogazette:false,game_role:null}]);
  check(await rows('select * from public.get_game_staff_directory()'), [{sporting_director_id: id(11)}]);
  for (const query of ['select * from public.get_game_staff_members()', "select * from public.search_game_staff_candidates('de',10)", 'select * from public.get_game_news_editor(null)', `select public.set_game_staff_role('${id(3)}',true)`]) {
    await rejects(query, [], '42501');
  }
  await rejects('select * from public.save_game_news_draft($1,0,$2)', [id(100), document], '42501');
  await rejects('select * from public.publish_game_news($1,1)', [id(100)], '42501');
  await auth(4);
  check(await scalar('select public.get_current_user_game_role()'), null);

  // Owner-only delegation, exact account identity and no metadata escalation.
  await db.exec('reset role');
  await db.query('update auth.users set raw_user_meta_data=$2::jsonb where id=$1', [id(3),{role:'owner',game_staff:true}]);
  await auth(3);
  check(await scalar('select public.get_current_user_game_role()'), null);
  await auth(1);
  check(await scalar('select public.get_current_user_game_role()'), 'owner');
  check((await rows('select * from public.get_current_game_header_indicators_v3()'))[0].game_role, 'owner');
  check((await rows('select * from public.get_game_staff_members()')).length, 1);
  check(await rows("select * from public.search_game_staff_candidates('de',10)"), [{user_id:id(2),director_id:id(12),display_name:'Aide Delivery',username:'delivery'}]);
  check(await rows("select * from public.search_game_staff_candidates('d',10)"), []);
  check(await rows("select * from public.search_game_staff_candidates('%%',100)"), []);
  check(await rows("select * from public.search_game_staff_candidates('suspended',10)"), []);
  await rejects('select public.set_game_staff_role($1,true)', [id(5)], '22023');
  await rejects('select public.set_game_staff_role($1,true)', [id(6)], '22023');
  await rejects('select public.set_game_staff_role($1,true)', [id(999)], '22023');
  await rejects('select public.set_game_staff_role($1,null)', [id(2)], '22023');
  await rejects('select public.set_game_staff_role($1,false)', [id(1)], '42501');
  await rejects('select public.set_game_staff_role($1,true)', [id(1)], '42501');
  await db.query('select public.set_game_staff_role($1,true)', [id(2)]);
  await db.query('select public.set_game_staff_role($1,true)', [id(2)]); // Idempotent, no duplicate event.
  check((await rows('select * from public.get_game_staff_members()')).length, 2);
  await db.exec('reset role');
  check(await scalar('select count(*)::integer from private.user_game_role_events'), 2);
  await auth(null, 'service_role');
  check((await rows('select * from public.get_game_staff_directory()')).length, 2);
  await rejects('select * from public.get_current_game_header_indicators_v3()', [], '42501');
  await rejects('select * from public.get_game_news_editor(null)', [], '42501');
  await auth(2);
  check(await scalar('select public.get_current_user_game_role()'), 'game_staff');
  check((await rows('select * from public.get_current_game_header_indicators_v3()'))[0].game_role, 'game_staff');
  await rejects('select public.set_game_staff_role($1,true)', [id(3)], '42501');
  await rejects('select public.set_game_staff_role($1,false)', [id(3)], '42501');
  await rejects('select public.set_game_staff_role($1,false)', [id(2)], '42501');
  await rejects('select public.set_game_staff_role($1,true)', [id(1)], '42501');
  await rejects('select public.set_game_staff_role($1,false)', [id(1)], '42501');
  await rejects("update private.user_game_roles set role='owner' where auth_user_id=$1",[id(2)],'42501');
  await rejects('select * from public.get_game_staff_members()', [], '42501');
  await rejects("select * from public.search_game_staff_candidates('me',10)", [], '42501');

  // A client-generated UUID survives a lost creation response. Only an exact
  // retry by the creator is idempotent; it cannot overwrite or claim a draft.
  const [retryDraft]=await save(90,0);
  const [retriedDraft]=await save(90,0,{...document,title:`  ${document.title}  `});
  check(retriedDraft,retryDraft);
  await rejects('select * from public.save_game_news_draft($1,0,$2)',[id(90),{...document,title:'Un autre texte ne peut pas écraser le brouillon'}],'40001');
  await auth(1);
  await rejects('select * from public.save_game_news_draft($1,0,$2)',[id(90),document],'40001');
  await db.exec('reset role');
  check(await scalar('select count(*)::integer from private.game_product_news where id=$1',[id(90)]),1);
  check(await scalar('select count(*)::integer from private.game_product_news_events where news_id=$1',[id(90)]),1);
  await auth(2);

  // Drafts can be incomplete. Publishing requires complete, bounded content.
  const [draft] = await save(100, 0, {title: 'Brouillon'});
  check(draft.revision, 1);
  check(draft.has_unpublished_changes, true);
  check(draft.published, null);
  check(draft.draft, {title:'Brouillon',category:'',summary:'',body:''});
  await rejects('select * from public.publish_game_news($1,1)', [id(100)], '22023');
  await auth(null, 'anon');
  check(await published(), []);
  await auth(2);
  const [saved] = await save(100, 1);
  check(saved.revision, 2);
  check(saved.draft, document);
  await rejects('select * from public.save_game_news_draft($1,1,$2)', [id(100), {...document,title:'Écrasement interdit'}], '40001');
  await rejects('select * from public.save_game_news_draft($1,0,$2)', [id(100), document], '40001');
  await rejects('select * from public.publish_game_news($1,1)', [id(100)], '40001');
  const [firstPublication] = await publish(100, 2);
  check(firstPublication.revision, 3);
  check(firstPublication.has_unpublished_changes, false);
  check(firstPublication.published, document);
  const [publicFirst] = await published(100);
  check(publicFirst.revision, 3);
  check(publicFirst.document, document);
  check(Object.keys(publicFirst).sort(), ['document','id','published_at','revision','updated_at']);
  const edited = {...document,title:'Nouvelle version encore secrète 📝',body:'Un nouveau corps de texte conservé dans le brouillon.'};
  const [editedDraft] = await save(100, 3, edited);
  check(editedDraft.revision, 4);
  check(editedDraft.has_unpublished_changes, true);
  check(editedDraft.published, document);
  await auth(null, 'anon');
  check(await published(100), [publicFirst]); // No draft title, timestamp or revision leaks.
  await auth(3);
  check(await published(100), [publicFirst]);
  await rejects('select * from public.get_game_news_editor($1)', [id(100)], '42501');
  await auth(1);
  const [republished] = await publish(100, 4);
  check(republished.revision, 5);
  check(republished.has_unpublished_changes, false);
  check(republished.published_at, firstPublication.published_at);
  check((await published(100))[0].document, edited);
  check((await published(100))[0].revision, 5);
  await rejects('select * from public.publish_game_news($1,4)', [id(100)], '40001');
  await db.exec('reset role');
  check(await scalar('select count(*)::integer from private.game_product_news_events where news_id=$1', [id(100)]), 5);
  check(await scalar("select count(*)::integer from private.game_product_news_events where news_id=$1 and action='published'", [id(100)]), 2);

  // Every route validates even if clients skip form constraints. Unicode and
  // literal HTML are text; unsafe URLs and raw document structures are rejected.
  await auth(2);
  for (const malformed of [null, [], 'text', {...document,unexpected:'value'}, {...document,title:3}, {...document,image_alt:null}, {...document,title:'x'.repeat(161)}, {...document,category:'x'.repeat(61)}, {...document,summary:'x'.repeat(501)}, {...document,body:'x'.repeat(30001)}, {...document,body_en:'x'.repeat(30001)}, {...document,image_alt:'x'.repeat(251)}, {...document,link_label:'x'.repeat(101)}, {...document,image_path:'https://evil.invalid/x.png'}, {...document,image_path:'/images/../private'}, {...document,image_path:'/images//evil'}, {...document,image_path:'/images/test.png?attack=1'}, {...document,link_url:'javascript:alert(1)'}, {...document,link_url:'data:text/html,evil'}, {...document,link_url:'//evil.invalid'}, {...document,link_url:'/\\evil.invalid'}, {...document,link_url:'/%2fevil.invalid'}, {...document,link_url:'https://evil.invalid/\npath'}]) {
    await rejects('select * from public.save_game_news_draft($1,0,$2)', [id(110),JSON.stringify(malformed)], '22023');
  }
  const [literalHtml] = await save(110, 0, {...document,body:'<script>alert("not executed")</script>\n🙂 **Texte seulement**',link_url:'https://cyclostratege.fr/nouveautes'});
  check(literalHtml.draft.body, '<script>alert("not executed")</script>\n🙂 **Texte seulement**');
  await rejects('select * from public.save_game_news_draft(null,null,$1)', [document], '22023');
  await rejects('select * from public.save_game_news_draft(null,-1,$1)', [document], '22023');
  await rejects('select * from public.publish_game_news(null,1)', [], '22023');
  const [generated] = await save(null, 0);
  check(typeof generated.id, 'string');
  check(generated.revision, 1);
  // Optional translations are allowed to be absent and empty optional fields
  // disappear, rather than accidentally overriding the French fallback.
  const [simple] = await save(111,0,{title:'Nouveauté simple',category:'Jeu',summary:'Une description courte.',body:'Un article simple, sans traduction.',title_en:'  ',image_path:'',link_url:''});
  check(simple.draft, {title:'Nouveauté simple',category:'Jeu',summary:'Une description courte.',body:'Un article simple, sans traduction.'});
  await publish(111,1);
  await save(112,0,{...document,title_en:'abc'});
  await rejects('select * from public.publish_game_news($1,1)',[id(112)],'22023');

  // Revocations and account suspension take effect without waiting for a JWT
  // refresh, including editors that were already open before the change.
  await auth(1);
  await db.query('select public.set_game_staff_role($1,false)', [id(2)]);
  await db.query('select public.set_game_staff_role($1,false)', [id(2)]);
  await auth(2);
  check(await scalar('select public.get_current_user_game_role()'), null);
  await rejects('select * from public.save_game_news_draft($1,5,$2)', [id(100),document], '42501');
  await rejects('select * from public.publish_game_news($1,5)', [id(100)], '42501');
  await auth(1);
  await db.query('select public.set_game_staff_role($1,true)', [id(2)]);
  await db.exec('reset role');
  await db.query("update public.sporting_directors set status='suspended' where auth_user_id=$1", [id(2)]);
  await auth(2);
  check(await scalar('select public.get_current_user_game_role()'), null);
  check(await rows('select * from public.get_game_staff_directory()'), [{sporting_director_id:id(11)}]);
  await rejects('select * from public.get_game_news_editor(null)', [], '42501');

  // SQL privileges are narrowly scoped. Public reads cannot expose draft audit,
  // roles, arbitrary tables, functions, payouts or database administration.
  await db.exec('reset role');
  check(await scalar("select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public') and p.proname in ('current_game_role','validate_game_news_document','get_current_user_game_role','get_current_game_header_indicators_v3','get_game_staff_directory','get_game_staff_members','search_game_staff_candidates','set_game_staff_role','get_published_game_news','get_game_news_editor','save_game_news_draft','publish_game_news') and p.proconfig @> array['search_path=\"\"']"), 12);
  check(await scalar("select pg_get_functiondef('public.get_current_game_header_indicators_v2()'::regprocedure)"), headerV2Definition);
  check(await scalar("select has_function_privilege('anon','public.get_published_game_news(integer,uuid)','execute')"), true);
  check(await scalar("select has_function_privilege('anon','public.publish_game_news(uuid,integer)','execute')"), false);
  check(await scalar("select has_function_privilege('authenticated','private.current_game_role()','execute')"), false);
  check(await scalar("select has_function_privilege('service_role','public.set_game_staff_role(uuid,boolean)','execute')"), false);
  check(await scalar('select count(*)::integer from private.user_game_role_events'), 4);
  check(await scalar('select count(*)::integer from private.game_product_news where published is not null'), 2);

  // Public caps and private editor caps are tested with local-only content.
  await db.query(`insert into private.game_product_news(draft,published,published_revision,published_at,published_updated_at)
    select $1,$1,1,now()-n*interval '1 second',now() from generate_series(1,120) n`,[document]);
  await auth(null,'anon');
  check((await published(null,10000)).length,50);
  check((await published(null,null)).length,20);
  check((await published(null,-100)).length,1);
  check(await published(999),[]);
  await auth(1);
  check((await rows('select * from public.get_game_news_editor(null)')).length,100);
  check((await rows('select * from public.get_game_news_editor($1)',[id(100)])).length,1);
  await db.exec('reset role');
  await db.query(`insert into auth.users(id,email) select ('00000000-0000-4000-8000-'||lpad((1000+n)::text,12,'0'))::uuid, 'candidate-'||n||'@example.invalid' from generate_series(1,30) n`);
  await db.query(`insert into sporting_directors(id,auth_user_id,display_name,username) select ('00000000-0000-4000-8000-'||lpad((2000+n)::text,12,'0'))::uuid, ('00000000-0000-4000-8000-'||lpad((1000+n)::text,12,'0'))::uuid,'Candidat '||n,'candidate-'||n from generate_series(1,30) n`);
  await auth(1);
  check((await rows("select * from public.search_game_staff_candidates('candidate-',10000)")).length,20);
  check((await rows("select * from public.search_game_staff_candidates('candidate-',null)")).length,10);

  // Exact legacy home-page import: run twice locally, verify no duplicate cards,
  // timestamps or audits, then prove every imported article remains editable.
  await db.exec('reset role; delete from private.game_product_news_events; delete from private.game_product_news;');
  const importMigration = readFileSync('supabase/migrations/20261022123002_import_existing_game_product_news.sql','utf8');
  const legacyDocuments = [...importMigration.matchAll(/\$legacynews\$(.*?)\$legacynews\$/gs)].map(match=>JSON.parse(match[1]));
  check(legacyDocuments.length,9);
  check(legacyDocuments.map(doc=>doc.title),[
    'La nuit tombe : l’Équipier sans tête entre en chasse',
    'La Saison 3 donne le pouvoir aux fédérations',
    'Le parrainage passe à la vitesse supérieure',
    'Le Patch 4 développe vos infrastructures',
    'Le Patch 3 est déployé',
    'Le Patch 2 est déployé',
    'Le Patch 1 pose les premières fondations',
    'MVP déployé, pré-alpha lancée',
    'Le Discord ouvre ses portes',
  ]);
  await db.exec(importMigration);
  const legacySnapshot=await scalar("select jsonb_agg(to_jsonb(n) order by n.id)::text from private.game_product_news n");
  const auditSnapshot=await scalar("select jsonb_agg(to_jsonb(e) order by e.id)::text from private.game_product_news_events e");
  await db.exec(importMigration);
  check(await scalar("select jsonb_agg(to_jsonb(n) order by n.id)::text from private.game_product_news n"),legacySnapshot);
  check(await scalar("select jsonb_agg(to_jsonb(e) order by e.id)::text from private.game_product_news_events e"),auditSnapshot);
  check(await scalar('select count(*)::integer from private.game_product_news'),9);
  check(await scalar("select count(*)::integer from private.game_product_news_events where action='legacy_import'"),9);
  const legacyRows=await rows('select draft,published,revision,published_revision from private.game_product_news order by id');
  for(const [index,legacy] of legacyRows.entries()) {
    const expected=Object.fromEntries(Object.entries(legacyDocuments[index]).filter(([key,value])=>['title','category','summary','body'].includes(key)||String(value).trim()!==''));
    check(legacy.draft,expected);check(legacy.published,expected);check(legacy.revision,1);check(legacy.published_revision,1);
  }
  await auth(1);
  check((await rows('select * from public.get_game_news_editor(null)')).length,9);
  await auth(null,'anon');
  check((await published()).length,9);
  const seededId='22a00000-0000-4000-8000-000000000001';
  const originalSeededPublic=await rows('select * from public.get_published_game_news(1,$1)',[seededId]);
  await auth(1);
  const [seededDraft]=await rows('select * from public.save_game_news_draft($1,1,$2)',[seededId,document]);
  check(seededDraft.revision,2);check(seededDraft.has_unpublished_changes,true);
  check(await rows('select * from public.get_published_game_news(1,$1)',[seededId]),originalSeededPublic);
  await db.exec('reset role');
  await db.exec(importMigration); // A later deployment never overwrites a real edit.
  check((await rows('select draft from private.game_product_news where id=$1',[seededId]))[0].draft,document);
  await auth(1);
  const [seededPublication]=await rows('select * from public.publish_game_news($1,2)',[seededId]);
  check(seededPublication.revision,3);check(seededPublication.has_unpublished_changes,false);
  console.log(`Community staff / news SQL: ${checks} isolated checks passed.`);
} finally {
  await db.close();
}
