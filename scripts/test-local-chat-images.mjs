// Isolated in-memory PostgreSQL. Never loads env files or connects to Supabase.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const uid = "12345678-1234-4234-8234-123456789abc";
const other = "22345678-1234-4234-8234-123456789abc";
const rid = "32345678-1234-4234-8234-123456789abc";
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,storage to anon,authenticated,service_role;
    create table public.sporting_directors(id uuid primary key, auth_user_id uuid, status text);
    create table public.teams(id uuid primary key, status text);
    create table public.team_manager_assignments(sporting_director_id uuid,team_id uuid,role text,status text);
    create table public.global_chat_messages(id uuid primary key default gen_random_uuid(), sporting_director_id uuid, message text, created_at timestamptz default now());
    alter table public.global_chat_messages enable row level security;
    create policy read_global on public.global_chat_messages for select to authenticated using(true);
    grant select on public.global_chat_messages to authenticated,service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(bucket_id text,name text,primary key(bucket_id,name));
    alter table storage.objects enable row level security;
    grant select on storage.objects to authenticated;
    create function public.post_global_chat_message_v4(
      p_message text,p_preview_type text,p_preview_entity_identifier text,p_reply_to_message_id uuid,
      p_mentioned_sporting_director_ids uuid[],p_preview_team_primary_color text,p_preview_team_secondary_color text,
      p_preview_team_accent_color text,p_preview_jersey_pattern text,p_preview_jersey_status text
    ) returns public.global_chat_messages language plpgsql as $$
      declare r public.global_chat_messages;
      begin
        if p_message='simulate-error' then raise exception 'post failed'; end if;
        insert into public.global_chat_messages(sporting_director_id,message) values(auth.uid(),p_message) returning * into r;
        return r;
      end; $$;
    insert into public.sporting_directors values('${uid}','${uid}','active'),('${other}','${other}','active');
    insert into public.teams values('${uid}','active'),('${other}','active');
    insert into public.team_manager_assignments values('${uid}','${uid}','general_manager','active'),('${other}','${other}','general_manager','active');
  `);
  await db.exec(await readFile("supabase/migrations/20261006170000_add_pasted_global_chat_images.sql", "utf8"));
  await db.exec("set role authenticated");
  await assert.rejects(() => db.query("select public.reserve_global_chat_image_upload($1,$2)",[uid,rid]),/permission denied/);
  await assert.rejects(() => db.query("select * from public.global_chat_image_uploads"),/permission denied/);
  await assert.rejects(() => db.query("select public.finish_global_chat_image_cleanup(array[]::uuid[])"),/permission denied/);
  await db.exec("reset role; set role service_role");
  await db.query("select public.reserve_global_chat_image_upload($1,$2)",[uid,rid]);
  await db.exec("reset role");
  await db.query("insert into storage.objects values('global-chat-images',$1)",[`${uid}/${rid}.webp`]);
  await db.query("insert into storage.objects values('global-chat-images','orphan.webp')");
  await db.query("update public.global_chat_image_uploads set width=600,height=300 where id=$1",[rid]);
  await db.exec("set role authenticated");
  assert.equal((await db.query("select * from storage.objects")).rows.length,0,"unpublished images are not readable");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);
  await assert.rejects(() => db.query("select public.post_global_chat_image_message($1,'hi')",[rid]),/appartient/);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
  await assert.rejects(() => db.query("select public.post_global_chat_image_message($1,'simulate-error')",[rid]),/post failed/);
  assert.equal((await db.query("select * from public.global_chat_messages")).rows.length,0,"failed post rolls back");
  const first = await db.query("select (public.post_global_chat_image_message($1,'')).*",[rid]);
  const second = await db.query("select (public.post_global_chat_image_message($1,'changed')).*",[rid]);
  assert.equal(first.rows[0].id,second.rows[0].id,"idempotent retries");
  assert.equal(second.rows[0].message,"Image jointe");
  assert.equal((await db.query("select * from public.global_chat_messages")).rows.length,1);
  assert.equal((await db.query("select * from storage.objects")).rows.length,1,"only published image is readable");
  await db.exec("reset role; set role anon");
  await assert.rejects(() => db.query("select public.post_global_chat_image_message($1,'hi')",[rid]),/permission denied/);
  await assert.rejects(() => db.query("select * from storage.objects"),/permission denied/);
  await db.exec("reset role; set role service_role");
  for(let i=1;i<=9;i++) await db.query("select public.reserve_global_chat_image_upload($1,$2)",[uid,`42345678-1234-4234-8234-${String(i).padStart(12,"0")}`]);
  await assert.rejects(() => db.query("select public.reserve_global_chat_image_upload($1,$2)",[uid,"42345678-1234-4234-8234-000000000010"]),/10 images/);
  await db.exec("reset role");
  await db.query("update public.global_chat_image_uploads set created_at=now()-interval '31 days' where id=$1",[rid]);
  await db.exec("set role service_role");
  assert.equal((await db.query("select * from public.get_expired_global_chat_images(100)")).rows.length,1);
  await db.query("select public.finish_global_chat_image_cleanup(array[$1]::uuid[])",[rid]);
  assert.equal((await db.query("select image_path from public.global_chat_messages")).rows[0].image_path,null);
  await db.exec("reset role");
  assert.equal((await db.query("select public from storage.buckets")).rows[0].public,false);
  assert.equal((await db.query("select count(*)::integer as n from storage.objects")).rows[0].n,2,"SQL never deletes Storage objects directly");
  console.log("PASS: migration, private reads, ownership, server-only upload reservation, rollback, idempotency, quota and bounded cleanup.");
} finally { await db.close(); }
