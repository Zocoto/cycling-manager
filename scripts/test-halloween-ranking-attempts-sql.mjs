import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const { PGlite } = await import(pathToFileURL(process.env.HALLOWEEN_RANKING_SQL_TEST_MODULE).href);
const db = new PGlite();
try {
  await db.exec(`
    create table halloween_runs(edition_id text,user_id uuid,day date,status text,score integer,distance integer,coins integer,finished_at timestamptz);
    create table sporting_directors(auth_user_id uuid,display_name text);
    insert into sporting_directors values('00000000-0000-0000-0000-000000000001','Player A'),('00000000-0000-0000-0000-000000000002','Player B');
    insert into halloween_runs values
      ('halloween-2026','00000000-0000-0000-0000-000000000001','2026-10-11','finished',100,100,0,'2026-10-11T12:00Z'),
      ('halloween-2026','00000000-0000-0000-0000-000000000001','2026-10-12','finished',200,200,0,'2026-10-12T12:00Z'),
      ('halloween-2026','00000000-0000-0000-0000-000000000001','2026-10-12','finished',150,150,0,'2026-10-12T13:00Z'),
      ('halloween-2026','00000000-0000-0000-0000-000000000001','2026-10-12','running',null,null,null,null),
      ('halloween-2026','00000000-0000-0000-0000-000000000002','2026-10-12','finished',200,200,0,'2026-10-12T14:00Z'),
      ('other-edition','00000000-0000-0000-0000-000000000001','2026-10-12','finished',900,900,0,'2026-10-12T15:00Z');
  `);
  const source = readFileSync('supabase/migrations/20261008210100_halloween_items_and_state.sql','utf8');
  const start = source.indexOf("  select coalesce(jsonb_agg(x),'[]') into v_ranking");
  const end = source.indexOf("  select jsonb_build_object",start);
  assert.ok(start>=0 && end>start);
  // Execute the real ranking queries with isolated edition/day context.
  const queries = source.slice(start,end);
  await db.exec(`create function public.get_current_halloween_state() returns jsonb language plpgsql as $$
    declare v_edition record;v_day date := '2026-10-12';v_ranking jsonb;v_daily jsonb;
    begin select 'halloween-2026'::text as id into v_edition;
    ${queries}
    return jsonb_build_object('ranking',v_ranking,'dailyRanking',v_daily);end $$;`);
  const before = (await db.query('select get_current_halloween_state() as state')).rows[0].state;
  const migration = readFileSync('supabase/migrations/20261012110000_add_halloween_ranking_attempt_counts.sql','utf8');
  await db.exec(migration);
  const after = (await db.query('select get_current_halloween_state() as state')).rows[0].state;
  assert.deepEqual(after.ranking.map(row=>row.attempts),[3,1]);
  assert.deepEqual(after.dailyRanking.map(row=>row.attempts),[2,1]);
  for(const key of ['ranking','dailyRanking']) assert.deepEqual(after[key].map(record=>{ const original={...record}; delete original.attempts; return original; }),before[key]);
  await db.exec(migration);
  assert.deepEqual((await db.query('select get_current_halloween_state() as state')).rows[0].state,after);
  console.log('PASS: validated attempt counts follow period/edition; running attempts excluded; best scores and tie ordering unchanged; migration idempotent.');
} finally { await db.close(); }
