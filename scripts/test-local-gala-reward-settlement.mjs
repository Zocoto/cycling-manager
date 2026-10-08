// Isolated, in-memory PostgreSQL only; this script has no network access.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

if (!process.argv[2]) throw new Error("Provide the local PGlite module path.");
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const migrationPath = "supabase/migrations/20261008200000_settle_pcm_gala_rewards.sql";
const uuid = (value) => db.query("select md5($1)::uuid::text as id", [value]).then((r) => r.rows[0].id);
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table seasons(id uuid primary key,status text);
    create table teams(id uuid primary key);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,status text);
    create table sporting_directors(id uuid primary key,auth_user_id uuid,display_name text,status text);
    create table team_manager_assignments(team_id uuid,sporting_director_id uuid,role text,status text);
    create table riders(id uuid primary key,first_name text,last_name text);
    create table pcm_gala_events(id uuid primary key,season_id uuid,event_key text,status text,updated_at timestamptz);
    create table pcm_gala_registrations(id uuid primary key,gala_event_id uuid,team_id uuid,season_id uuid);
    create table pcm_gala_registration_riders(registration_id uuid,rider_id uuid);
    create table equipment_catalog_items(
      id uuid primary key default gen_random_uuid(),catalog_key text unique,name text,slot_type text,
      status text,supplier_key text,supplier_name text,description text,price numeric,rarity text,
      image_path text,effect_summary text,effect_payload jsonb,acquisition_channel text,
      owner_team_id uuid,updated_at timestamptz,
      constraint equipment_catalog_items_acquisition_channel_allowed
      check(acquisition_channel in ('commercial','equipment_partner','research_prototype')),
      constraint equipment_catalog_items_prototype_owner_shape check(
        (acquisition_channel='research_prototype' and owner_team_id is not null) or
        (acquisition_channel<>'research_prototype' and owner_team_id is null))
    );
    create table team_equipment_inventory(
      team_season_id uuid references team_seasons(id),equipment_item_id uuid references equipment_catalog_items(id),
      quantity integer,last_purchase_price numeric,updated_at timestamptz,
      unique(team_season_id,equipment_item_id)
    );
    create table sporting_director_messages(
      sporting_director_id uuid,season_id uuid,team_season_id uuid,message_type text,sender_name text,
      subject text,preview text,body text,action_href text,action_label text,source_reference text,is_important boolean,
      unique(sporting_director_id,source_reference)
    );
    create function get_active_calendar_stage_equipment_effects(uuid[])
    returns table(id uuid,effect_payload jsonb) language sql as $$
      select item.id,case when item.acquisition_channel = 'commercial' then item.effect_payload else '{}'::jsonb end
      from equipment_catalog_items as item where item.acquisition_channel = 'commercial';
    $$;
    create table official_guard(form int,morale int,cash int,points int);
    insert into official_guard values(79,81,50000,45);
    insert into seasons values(md5('source-season')::uuid,'completed'),(md5('active-season')::uuid,'active');
    insert into pcm_gala_events values(md5('gala')::uuid,md5('source-season')::uuid,'gala-des-puncheurs','open',now());
    insert into teams select md5('team-'||i)::uuid from generate_series(1,8)i;
    insert into team_seasons select md5('team-season-'||i)::uuid,md5('team-'||i)::uuid,md5('active-season')::uuid,'active' from generate_series(1,8)i;
    insert into sporting_directors select md5('director-'||i)::uuid,md5('user-'||i)::uuid,'Manager '||i,'active' from generate_series(1,8)i;
    insert into team_manager_assignments select md5('team-'||i)::uuid,md5('director-'||i)::uuid,'general_manager','active' from generate_series(1,8)i;
    insert into riders select md5('rider-'||i||'-'||j)::uuid,'Coureur',i||'-'||j from generate_series(1,8)i cross join generate_series(1,2)j;
    insert into pcm_gala_registrations select md5('registration-'||i)::uuid,md5('gala')::uuid,md5('team-'||i)::uuid,md5('source-season')::uuid from generate_series(1,8)i;
    insert into pcm_gala_registration_riders select md5('registration-'||i)::uuid,md5('rider-'||i||'-'||j)::uuid from generate_series(1,8)i cross join generate_series(1,2)j;
    insert into equipment_catalog_items(catalog_key,name,status,acquisition_channel,effect_payload)
      values('regular-wheel','Commercial wheel','active','commercial','{"ratingBonuses":{"flat":1}}');
    insert into equipment_catalog_items(catalog_key,name,status,acquisition_channel,owner_team_id,effect_payload)
      values('old-prototype','Existing prototype','active','research_prototype',md5('team-1')::uuid,'{"ratingBonuses":{"flat":3}}');
  `);
  await db.exec(await readFile(migrationPath, "utf8"));
  const eventId = await uuid("gala");
  const winners = [[1,1,1,1],[1,2,2,1],[1,3,1,2],[1,4,3,1],[1,5,4,1],
    [2,1,5,1],[2,2,5,2],[2,3,6,1],[2,4,7,1],[2,5,8,1]];
  const rewards = await Promise.all(winners.map(async ([group_number,rank,team,rider]) => ({
    group_number,rank,team_id:await uuid(`team-${team}`),rider_id:await uuid(`rider-${team}-${rider}`),team_name:`Équipe ${team}`,
  })));
  const settle = (rows) => db.query("select settle_pcm_gala_rewards($1,$2::jsonb) as result", [eventId,JSON.stringify(rows)]).then((r) => r.rows[0].result);
  const count = (table) => db.query(`select count(*)::integer as n from ${table}`).then((r) => r.rows[0].n);

  const foreign = structuredClone(rewards);
  foreign[9].rider_id = await uuid("rider-1-1");
  // A different registered rider from the wrong team (still unique) must cause
  // failure after earlier loop entries, rolling back every preceding credit.
  foreign[9].rider_id = await uuid("rider-2-2");
  await assert.rejects(() => settle(foreign), /not registered/);
  assert.equal(await count("pcm_gala_reward_grants"),0);
  assert.equal(await count("team_equipment_inventory"),0);
  assert.equal(await count("sporting_director_messages"),0);
  assert.equal(await count("pcm_gala_reward_emails"),0);
  assert.equal((await db.query("select status from pcm_gala_events")).rows[0].status,"open");

  await assert.rejects(() => settle(rewards.slice(0,9)), /10 prizes/);
  const duplicates = structuredClone(rewards); duplicates[9] = {...duplicates[8]};
  await assert.rejects(() => settle(duplicates), /duplicate/);
  await db.exec("set role authenticated");
  await assert.rejects(() => settle(rewards), /permission denied/);
  await assert.rejects(() => db.query("insert into pcm_gala_reward_publications(gala_event_id) values($1)",[eventId]),/permission denied/);
  await db.exec("reset role");

  const first = await settle(rewards);
  assert.deepEqual(first,{allocatedCount:10,alreadyAllocatedCount:0,emailRecipientCount:8});
  assert.equal(await count("pcm_gala_reward_grants"),10);
  assert.equal(await count("sporting_director_messages"),8);
  assert.equal(await count("pcm_gala_reward_emails"),8);
  assert.equal((await db.query("select sum(quantity)::integer as n from team_equipment_inventory")).rows[0].n,10);
  assert.equal((await db.query("select status from pcm_gala_events")).rows[0].status,"closed");
  const retried = await settle(rewards);
  assert.deepEqual(retried,{allocatedCount:0,alreadyAllocatedCount:10,emailRecipientCount:8});
  assert.equal((await db.query("select sum(quantity)::integer as n from team_equipment_inventory")).rows[0].n,10);
  assert.equal(await count("sporting_director_messages"),8);
  assert.equal(await count("pcm_gala_reward_emails"),8);
  const replaced = structuredClone(rewards); replaced[0].team_name="Overwritten identity";
  await assert.rejects(() => settle(replaced), /cannot be overwritten/);

  await db.exec("set role authenticated");
  assert.equal((await db.query("select * from get_pcm_gala_published_rewards($1)",[eventId])).rows.length,10);
  await assert.rejects(() => db.query("select * from claim_pcm_gala_reward_emails($1)",[eventId]),/permission denied/);
  await db.exec("reset role");

  const emails = (await db.query("select * from claim_pcm_gala_reward_emails($1)",[eventId])).rows;
  assert.equal(emails.length,8);
  assert.equal((await db.query("select * from claim_pcm_gala_reward_emails($1)",[eventId])).rows.length,0);
  const twoPrizeEmail = emails.find((e) => e.team_name === "Équipe 1");
  assert.match(twoPrizeEmail.body,/Roue avant · Éclat de Gala/);
  assert.match(twoPrizeEmail.body,/Casque · Sérénité de Gala/);
  for (const email of emails.slice(1)) {
    await db.query("select mark_pcm_gala_reward_email($1,'sent',$2)",[email.id,`provider-${email.id}`]);
  }
  await db.query("select mark_pcm_gala_reward_email($1,'uncertain',null,'Timeout after send')",[emails[0].id]);
  assert.equal((await db.query("select * from claim_pcm_gala_reward_emails($1)",[eventId])).rows.length,0);
  assert.equal((await db.query("select mark_pcm_gala_reward_email($1,'failed') as changed",[emails[0].id])).rows[0].changed,false);
  assert.equal((await db.query("select * from get_active_calendar_stage_equipment_effects(null)")).rows.length,6);
  const wheelEffects = (await db.query("select effect_payload from equipment_catalog_items where catalog_key='gala-roue-avant-or'")).rows[0].effect_payload;
  assert.deepEqual(wheelEffects,{ratingBonuses:{hills:3,downhill:2,resistance:1}});
  const regular = (await db.query("select effect_payload from get_active_calendar_stage_equipment_effects(null) where id=(select id from equipment_catalog_items where catalog_key='regular-wheel')")).rows[0].effect_payload;
  assert.deepEqual(regular,{ratingBonuses:{flat:1}});
  // The gala migration must not change the old reader's prototype behavior.
  assert.equal((await db.query("select count(*)::int as n from get_active_calendar_stage_equipment_effects(null) where id=(select id from equipment_catalog_items where catalog_key='old-prototype')")).rows[0].n,0);
  assert.equal((await db.query("select count(*)::int as n from equipment_catalog_items where acquisition_channel='commercial'")).rows[0].n,1);
  assert.deepEqual((await db.query("select * from official_guard")).rows,[{form:79,morale:81,cash:50000,points:45}]);
  // Model lifecycle archiving, then physical deletion of the referenced gameplay
  // identities. All ten public result snapshots must survive these deletions.
  await db.exec("update sporting_directors set status='retired' where id=md5('director-8')::uuid; update team_seasons set status='completed' where team_id=md5('team-8')::uuid;");
  assert.equal(await count("pcm_gala_reward_grants"),10);
  await db.exec("delete from team_equipment_inventory where team_season_id=md5('team-season-8')::uuid; delete from team_seasons where id=md5('team-season-8')::uuid; delete from teams where id=md5('team-8')::uuid; delete from riders where id=md5('rider-8-1')::uuid; delete from sporting_directors where id=md5('director-8')::uuid;");
  const historical = (await db.query("select * from get_pcm_gala_published_rewards($1) where group_number=2 and rank=5",[eventId])).rows[0];
  assert.equal(historical.rider_id,null); assert.equal(historical.team_id,null);
  assert.equal(historical.rider_name,"Coureur 8-1"); assert.equal(historical.team_name,"Équipe 8");
  assert.equal(historical.manager_name,"Manager 8"); assert.equal(historical.item_name,"Lunettes · Ligne d’Horizon");
  assert.equal(await count("pcm_gala_reward_grants"),10);
  const orphan = (await db.query("select * from pcm_gala_reward_emails where team_name='Équipe 8'")).rows[0];
  assert.equal(orphan.sporting_director_id,null);
  // A manually reset orphan remains ineligible for external email delivery.
  await db.query("update pcm_gala_reward_emails set status='pending',attempt_count=0 where id=$1",[orphan.id]);
  assert.equal((await db.query("select * from claim_pcm_gala_reward_emails($1)",[eventId])).rows.length,0);
  console.log(JSON.stringify({isolated:true,awards:10,recipients:8,idempotency:true,foreignRiderRejected:true,
    playerSettlementDenied:true,exclusiveCatalog:true,futureEquipmentEffects:true,prototypeBehaviorUnchanged:true,
    ambiguousEmailNotRetried:true,sportsUnchanged:true,identityDeletionNotBlocked:true,resultSnapshotsPreserved:true,orphanEmailNotSent:true}));
} finally {
  await db.close();
}
