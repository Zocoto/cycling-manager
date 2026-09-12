import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(
  join(process.cwd(), "app/jeu/chat/federation/route.ts"),
  "utf8",
);
const panel = readFileSync(
  join(process.cwd(), "components/game/federation-messaging-panel.tsx"),
  "utf8",
);

describe("federation chat hub route", () => {
  it("requires authentication and returns private uncached data", () => {
    expect(route).toContain("getAuthenticatedUser");
    expect(route).toContain("status: 401");
    expect(route).toContain('"Cache-Control": "private, no-store"');
  });

  it("is fetched only when the federation tab is activated", () => {
    expect(panel).toContain("if (!active || payload || !loading) return");
    expect(panel).toContain('fetch("/jeu/chat/federation"');
    expect(panel).toContain("<FederationLounge");
    expect(panel).toContain("embedded");
  });
});
