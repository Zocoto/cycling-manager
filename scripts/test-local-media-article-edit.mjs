import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = (value) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const articleId = id(1);
const imageId = id(2);
const seasonId = id(3);
const teamId = id(4);
const blocks = (text) => [{ type: "text", font: "serif", content: [{ text, bold: true }] }];
const originalText = "Une tribune suffisamment longue pour vérifier la publication.";
const revisedText = "La version corrigée doit apparaître dans le numéro publié.";
let assertions = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); assertions++; };
const scalar = async (sql) => Object.values((await db.query(sql)).rows[0])[0];
const edit = (article, text, layout = blocks(text)) => db.query(
  "select public.update_current_team_rich_media_article($1,$2,$3::jsonb,false)",
  [article, "Le titre corrigé", JSON.stringify(layout)],
);

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create function public.current_user_manages_team(p_team uuid) returns boolean
    language sql as $$ select p_team::text = current_setting('app.team', true) $$;
    create table public.cyclogazette_editions (
      id uuid primary key, season_id uuid, content jsonb not null
    );
    create table public.media_center_articles (
      id uuid primary key, team_id uuid, sporting_director_id uuid, season_id uuid,
      day_number integer, title text, body text, content_blocks jsonb,
      team_name text, sponsor_name text, building_level integer,
      reputation_awarded numeric default 3, supporters_awarded integer default 25,
      created_at timestamptz default now(),
      status text default 'queued',
      published_edition_id uuid references public.cyclogazette_editions(id)
    );
    create table public.media_center_article_images (
      id uuid primary key, team_id uuid, sporting_director_id uuid,
      article_id uuid references public.media_center_articles(id),
      cleanup_started_at timestamptz, width integer, height integer
    );
    create table public.sponsors (id uuid, name text);
    create table public.team_sponsor_contracts (team_id uuid,sponsor_id uuid,status text);
    insert into public.media_center_articles
      (id,team_id,sporting_director_id,season_id,day_number,title,body,team_name,building_level)
    values ('${articleId}','${teamId}','${id(5)}','${seasonId}',12,
      'Un ancien article','${originalText}','Une équipe',3);
    insert into public.media_center_article_images
      (id,team_id,sporting_director_id,article_id,width,height)
    values ('${imageId}','${teamId}','${id(5)}','${articleId}',1200,800);
    set app.team = '${teamId}';
  `);
  const migration = await readFile(new URL("../supabase/migrations/20261119110000_edit_queued_media_center_articles.sql", import.meta.url), "utf8");
  await db.exec(migration);
  check(await scalar(`select body from media_center_articles where id='${articleId}'`), originalText);
  check(await scalar("select has_function_privilege('anon','public.update_current_team_rich_media_article(uuid,text,jsonb,boolean)','execute')"), false);
  await db.exec("set role authenticated");
  await edit(articleId, revisedText, [...blocks(revisedText), {
    type: "image", assetId: imageId, align: "wide", alt: "La famille du coureur",
  }]);
  await db.exec("reset role");
  const row = (await db.query("select * from media_center_articles")).rows[0];
  check(row.body, revisedText);
  check(row.title, "Le titre corrigé");
  check(row.status, "queued");
  check(Number(row.reputation_awarded), 3);
  check(row.supporters_awarded, 25);
  check(row.day_number, 12);
  check(row.content_blocks[1].src, `/api/game/media-center/images/${teamId}/${imageId}.webp`);
  await db.exec(`set app.team = '${id(99)}'; set role authenticated;`);
  await assert.rejects(edit(articleId, originalText), /ne vous appartient pas/);
  assertions++;
  await db.exec(`reset role; set app.team = '${teamId}';`);
  await assert.rejects(edit(articleId, "trop court"), /longueur/);
  assertions++;
  check(await scalar("select body from media_center_articles"), revisedText);
  await edit(articleId, revisedText);
  check(await scalar("select article_id from media_center_article_images"), null);
  await assert.rejects(edit(articleId, revisedText, [...blocks(revisedText), {
    type: "image", assetId: id(90), align: "wide", alt: "",
  }]), /illustration est indisponible/);
  assertions++;
  check(await scalar("select body from media_center_articles"), revisedText);

  const staleContent = { mediaArticles: [{ id: articleId, title: "Un ancien article", body: originalText }] };
  await db.query("insert into cyclogazette_editions(id,season_id,content) values($1,$2,$3)", [id(10), seasonId, staleContent]);
  const frozen = await scalar("select content from cyclogazette_editions");
  check(frozen.mediaArticles[0].body, revisedText);
  check(frozen.mediaArticles[0].title, "Le titre corrigé");
  check(frozen.mediaArticles[0].blocks, blocks(revisedText));
  check(await scalar("select status from media_center_articles"), "published");
  check(await scalar("select published_edition_id from media_center_articles"), id(10));
  await assert.rejects(edit(articleId, originalText), /déjà été publiée/);
  assertions++;
  await db.query("insert into cyclogazette_editions(id,season_id,content) values($1,$2,$3)", [id(11), seasonId, staleContent]);
  check(await scalar(`select content->'mediaArticles' from cyclogazette_editions where id='${id(11)}'`), []);
  check(await scalar("select published_edition_id from media_center_articles"), id(10));
  check(await scalar(`select content from cyclogazette_editions where id='${id(10)}'`), frozen);
  console.log(JSON.stringify({ assertions, editingAndPublicationVerified: true }));
} finally {
  await db.close();
}
