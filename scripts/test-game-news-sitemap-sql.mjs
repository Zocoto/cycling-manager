// Disposable PostgreSQL/WASM only. No network, credentials or live database.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.argv[2];
if (!isAbsolute(modulePath ?? "") || !modulePath.replaceAll("\\", "/").endsWith("/@electric-sql/pglite/dist/index.js")) {
  throw new Error("Pass the absolute path to an installed local PGlite module.");
}
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const rows = async (sql, values = []) => (await db.query(sql, values)).rows;
const scalar = async (sql, values = []) => Object.values((await rows(sql, values))[0])[0];
let checks = 0;
const check = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const getPage = (after = null, limit = 250) => rows("select * from public.get_published_game_news_sitemap($1,$2)", [after, limit]);
const asRole = async (role, run) => {
  await db.exec(`set role ${role}`);
  try { return await run(); } finally { await db.exec("reset role"); }
};

try {
  await db.exec(`
    create schema private;
    create role anon; create role authenticated; create role service_role bypassrls;
    create table private.game_product_news (
      id uuid primary key, draft jsonb not null, published jsonb,
      published_at timestamptz, published_updated_at timestamptz,
      updated_at timestamptz not null
    );
    alter table private.game_product_news enable row level security;
    revoke all on private.game_product_news from public, anon, authenticated, service_role;
    insert into private.game_product_news
    select ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
      '{"title":"PRIVATE DRAFT"}'::jsonb,
      case when n = 2 then null else '{"title":"Published snapshot"}'::jsonb end,
      case when n = 2 then null else '2026-10-22T08:00:00Z'::timestamptz end,
      case when n = 2 then null else '2026-11-20T09:00:00Z'::timestamptz end,
      '2026-11-21T10:00:00Z'::timestamptz
    from generate_series(1,602) n;
  `);
  const before = await rows("select * from private.game_product_news order by id");
  await db.exec(await readFile(new URL("../supabase/migrations/20261121183000_add_published_news_sitemap_projection.sql", import.meta.url), "utf8"));

  const first = await asRole("service_role", () => getPage(null, 250));
  check(first.length, 250, "bounded first page");
  check(Object.keys(first[0]), ["id", "published_at", "updated_at"], "only publication identifiers and dates leave the private table");
  check(first[0].updated_at.toISOString(), "2026-11-20T09:00:00.000Z", "editorial draft saves never change public lastmod");
  const second = await asRole("service_role", () => getPage(first.at(-1).id, 250));
  const third = await asRole("service_role", () => getPage(second.at(-1).id, 250));
  const inventory = [...first, ...second, ...third];
  check(inventory.length, 601, "pagination covers publications beyond fifty");
  check(new Set(inventory.map((row) => row.id)).size, 601, "page boundaries have no duplicates");
  check(inventory.some((row) => row.id === id(2)), false, "unpublished drafts never enter the sitemap");
  check(await asRole("service_role", () => getPage(id(602), 250)), [], "terminal cursor returns no rows");
  check((await getPage(null, 99_999)).length, 500, "SQL clamps oversized page requests");
  check((await getPage(null, 0)).length, 1, "SQL clamps a zero limit");
  check((await getPage(null, null)).length, 250, "SQL handles null limits");
  for (const role of ["anon", "authenticated"]) {
    await assert.rejects(() => asRole(role, () => getPage()), /permission denied/u); checks++;
  }
  await assert.rejects(() => asRole("service_role", () => rows("select draft from private.game_product_news")), /permission denied/u); checks++;
  check(await scalar("select provolatile::text || ':' || prosecdef::text from pg_proc where oid='public.get_published_game_news_sitemap(uuid,integer)'::regprocedure"), "s:true", "projection is stable and security definer");
  check(await rows("select * from private.game_product_news order by id"), before, "sitemap reads leave all editorial and publication rows unchanged");
  console.log(JSON.stringify({ status: "passed", checks, database: "isolated PGlite", publications: inventory.length }));
} finally {
  await db.close();
}
