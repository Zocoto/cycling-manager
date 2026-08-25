import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260825125000_enrich_global_chat_share_cards.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

const actionSource = readFileSync(
  join(process.cwd(), "app/jeu/chat/actions.ts"),
  "utf8",
).replace(/\r\n/g, "\n");

const cardSource = readFileSync(
  join(process.cwd(), "components/game/global-chat-share-preview.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("global chat enriched share cards", () => {
  it("persists the visual snapshot once instead of loading one API per card", () => {
    expect(migration).toContain("preview_avatar_profile_key text");
    expect(migration).toContain("preview_country_code text");
    expect(migration).toContain("preview_team_primary_color text");
    expect(migration).toContain(
      "create or replace function public.post_global_chat_message_v4",
    );
    expect(actionSource).toContain('"post_global_chat_message_v4"');
    expect(actionSource).toContain("resolveGlobalChatPreviewPalette");
  });

  it("backfills rider and team cards and accepts public DS profiles", () => {
    expect(migration).toContain(
      "update public.global_chat_messages as message",
    );
    expect(migration).toContain("preview_type in ('team', 'rider', 'director')");
    expect(migration).toContain("directeurs-sportifs/");
    expect(migration).toContain("preview_type = 'director'");
  });

  it("renders identity, country, age, team palette and hover-only statistics", () => {
    expect(cardSource).toContain("<RiderAvatar");
    expect(cardSource).toContain("<SportingDirectorAvatar");
    expect(cardSource).toContain("preview.country.name");
    expect(cardSource).toContain("{preview.age} ans");
    expect(cardSource).toContain("Stats au survol");
    expect(cardSource).toContain("preview.palette.primaryColor");
    expect(cardSource).toContain('prefetch={false}');
  });
});
