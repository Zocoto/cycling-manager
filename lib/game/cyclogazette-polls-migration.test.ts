import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260831113000_add_cyclogazette_daily_polls.sql",
  ),
  "utf8",
);
const sidebar = readFileSync(
  join(process.cwd(), "components/game/cyclogazette-games-sidebar.tsx"),
  "utf8",
);

describe("sondages quotidiens de La Cyclogazette", () => {
  it("stocke un sondage par édition et un vote immuable par DS", () => {
    expect(migration).toContain("create table public.cyclogazette_polls");
    expect(migration).toContain("cyclogazette_polls_one_per_edition");
    expect(migration).toContain("create table public.cyclogazette_poll_votes");
    expect(migration).toContain("cyclogazette_poll_votes_once");
    expect(migration).toContain("on conflict (poll_id, sporting_director_id) do nothing");
  });

  it("crée les sondages à la publication et équipe la dernière Gazette", () => {
    expect(migration).toContain("cyclogazette_editions_create_daily_poll");
    expect(migration).toContain("private.ensure_cyclogazette_poll(new.id)");
    expect(migration).toContain("perform private.ensure_cyclogazette_poll(v_latest_edition_id)");
    expect(migration).toContain("mod(v_edition.issue_number, 5)");
  });

  it("regroupe jeux et sondage dans une seule lecture compacte", () => {
    expect(migration).toContain("create or replace function public.get_cyclogazette_game_summary");
    expect(migration).toContain("'poll', v_poll");
    expect(migration).toContain("create or replace function public.vote_cyclogazette_poll");
    expect(sidebar).toContain("Le sondage du jour");
    expect(sidebar).toContain("En direct");
    expect(sidebar).not.toContain("setInterval");
    expect(sidebar).not.toContain("channel(");
  });
});
