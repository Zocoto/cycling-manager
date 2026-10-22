// Isolated PostgreSQL/WASM only; no network or production configuration.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const modulePath = process.env.COMMUNITY_SQL_TEST_MODULE;
assert.ok(modulePath, 'Provide the local PGlite module path');
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
try {
  await db.exec('create schema storage; create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);');
  const sql = readFileSync('supabase/migrations/20261022130000_add_game_news_image_storage.sql', 'utf8');
  await db.exec(sql);
  await db.exec(sql);
  const { rows } = await db.query("select id, public, file_size_limit, allowed_mime_types from storage.buckets");
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], { id: 'game-news-images', public: true, file_size_limit: 786432, allowed_mime_types: ['image/webp'] });
  assert.equal((await db.query("select count(*)::int n from pg_policies where schemaname='storage'")).rows[0].n, 0);
  await db.exec("update storage.buckets set public=false where id='game-news-images'");
  await assert.rejects(() => db.exec(sql), /Unexpected/);
  await db.exec('rollback');
  console.log('News image storage: isolated creation, idempotency, no client policies and drift protection passed.');
} finally { await db.close(); }
