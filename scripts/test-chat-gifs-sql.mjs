// Local, in-memory PostgreSQL only. The base message fixture verifies that the
// new wrapper delegates without replacing the existing chat pipeline.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
if (!process.argv[2] || /^(?:https?|postgres):/i.test(process.argv[2])) throw Error("Local PGlite module path required");
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
let checks = 0;
const user = "11111111-1111-4111-8111-111111111111";
const request = "22222222-2222-4222-8222-222222222222";
const reply = "33333333-3333-4333-8333-333333333333";
const gif = { provider: "klipy", kind: "gif", id: "123", slug: "victory", title: "Victoire",
  url: "https://static.klipy.com/a.gif?delivery=preserved", previewUrl: "https://static1.klipy.com/a.jpg", width: 320, height: 240 };
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
  create table public.global_chat_messages(id uuid primary key default gen_random_uuid(), sporting_director_id uuid,
    message text not null, image_path text, reply_to_message_id uuid, mentioned_ids uuid[]);
  create table public.global_chat_message_reactions(message_id uuid, sporting_director_id uuid, reactor_display_name text,
    team_id uuid, team_display_name text, emoji text not null, primary key(message_id,sporting_director_id,emoji),
    constraint global_chat_message_reactions_emoji_allowed check(emoji in ('👍','❤️')));
  create function public.get_current_global_chat_identity() returns table(sporting_director_id uuid,display_name text,team_id uuid,team_name text)
    language sql stable as $$ select auth.uid(),'DS démo','44444444-4444-4444-8444-444444444444'::uuid,'Équipe démo' where auth.uid() is not null $$;
  create function public.post_global_chat_message_v4(p_message text,p_preview_type text default null,p_preview_entity_identifier text default null,
    p_reply_to_message_id uuid default null,p_mentioned_sporting_director_ids uuid[] default array[]::uuid[],
    p_primary text default null,p_secondary text default null,p_accent text default null,p_pattern text default null,p_status text default null)
    returns public.global_chat_messages language plpgsql as $$ declare r public.global_chat_messages; begin
      if p_message='BLOCKED' then raise exception 'Existing pipeline rejected'; end if;
      insert into public.global_chat_messages(sporting_director_id,message,reply_to_message_id,mentioned_ids)
      values(auth.uid(),p_message,p_reply_to_message_id,p_mentioned_sporting_director_ids) returning * into r; return r; end; $$;
  insert into public.global_chat_messages(sporting_director_id,message) values('${user}','Ancien message');
`);
await db.exec(readFileSync("supabase/migrations/20261019090000_add_klipy_chat_gifs_and_emoji_catalog.sql", "utf8"));
const scalar = async (sql, params = []) => (await db.query(sql, params)).rows[0];
async function rejects(sql, params = []) { await assert.rejects(() => db.query(sql, params)); checks++; }
await rejects("select public.post_global_chat_gif_message('', $1, $2)", [gif, request]);
await db.query("select set_config('test.user',$1,false)", [user]);
const first = await scalar("select (public.post_global_chat_gif_message('', $1, $2, $3, $4)).*", [gif, request, reply, [reply]]);
assert.equal(first.message, "GIF joint"); assert.deepEqual(first.gif_attachment, gif); assert.equal(first.reply_to_message_id, reply); assert.deepEqual(first.mentioned_ids, [reply]); checks += 4;
const retry = await scalar("select (public.post_global_chat_gif_message('retry', $1, $2)).*", [gif, request]);
assert.equal(retry.id, first.id); assert.equal(retry.message, "GIF joint"); checks += 2;
assert.equal((await scalar("select count(*)::int n from public.global_chat_messages")).n, 2); checks++;
for (const invalid of [null, { ...gif, url: "https://evil.test/x.gif" }, { ...gif, url: "https://static.klipy.com.evil.test/x.gif" },
  { ...gif, url: "http://static.klipy.com/x.gif" }, { ...gif, previewUrl: "https://me:secret@static.klipy.com/x.jpg" },
  { ...gif, width: 0 }, { ...gif, width: 9000 }, { ...gif, width: 1.5 }, { ...gif, title: "" }, { ...gif, provider: "other" }]) {
  await rejects("select public.post_global_chat_gif_message('', $1, gen_random_uuid())", [invalid]);
}
await rejects("select public.post_global_chat_gif_message('BLOCKED', $1, gen_random_uuid())", [gif]);
assert.equal((await scalar("select count(*)::int n from public.global_chat_messages")).n, 2); checks++;
await db.query("select set_config('test.user','55555555-5555-4555-8555-555555555555',false)");
const other = await scalar("select (public.post_global_chat_gif_message('Autre DS', $1, $2)).*", [gif, request]);
assert.notEqual(other.id, first.id); checks++;
const catalogue = (await scalar("select pg_get_functiondef('public.is_allowed_global_chat_reaction(text)'::regprocedure) source")).source;
const literal = catalogue.match(/array\[([^\]]+)\]/i)?.[1] ?? '';
const emojis = [...literal.matchAll(/'([^']+)'/gu)].map(match => match[1]);
assert.ok(emojis.length > 200); checks++;
for (const emoji of emojis) {
  assert.equal((await scalar("select public.toggle_global_chat_message_reaction($1,$2) active", [first.id, emoji])).active, true);
  assert.equal((await scalar("select public.toggle_global_chat_message_reaction($1,$2) active", [first.id, emoji])).active, false);
  checks += 2;
}
await rejects("select public.toggle_global_chat_message_reaction($1,'arbitrary string')", [first.id]);
assert.equal((await scalar("select has_function_privilege('anon','public.post_global_chat_gif_message(text,jsonb,uuid,uuid,uuid[])','EXECUTE') allowed")).allowed, false); checks++;
assert.equal((await scalar("select message from public.global_chat_messages where message='Ancien message'")).message, "Ancien message"); checks++;
await db.close();
console.log(JSON.stringify({ isolatedPostgres: true, checks, emojis: emojis.length, existingMessagePreserved: true, duplicateSendPrevented: true }));
