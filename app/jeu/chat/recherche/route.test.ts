import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const route = readFileSync(
  join(process.cwd(), "app/jeu/chat/recherche/route.ts"),
  "utf8",
);

describe("global chat search route", () => {
  it("requires authentication and keeps responses private", () => {
    expect(route).toContain("getAuthenticatedUser");
    expect(route).toContain("status: 401");
    expect(route).toContain('"Cache-Control": "private, no-store"');
  });

  it("validates the query before executing the secured search", () => {
    expect(route).toContain("GLOBAL_CHAT_SEARCH_MIN_LENGTH");
    expect(route).toContain("normalizeGlobalChatSearchQuery");
    expect(route).toContain("searchGlobalChatMessages");
    expect(route).toContain("status: 400");
  });
});
