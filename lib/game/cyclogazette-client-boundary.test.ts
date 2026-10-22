import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sidebar = readFileSync(new URL("../../components/game/cyclogazette-games-sidebar.tsx",import.meta.url),"utf8").replaceAll("\r","");

describe("Cyclogazette presentation and client boundary", () => {
  it("keeps the existing UI implementation and all styles unchanged", () => {
    expect(createHash("sha256").update(sidebar.slice(sidebar.indexOf("type GameTab ="))).digest("hex")).toBe("e2bd3503386a36759e5e4a1a1213f25e18807c3f9d99ab565a57c31a9b52495f");
  });
  it("does not pull the game bank service into the browser", () => {
    expect(sidebar).toContain('import { applyCyclogazettePollVote } from "@/lib/game/cyclogazette-poll-vote"');
    expect(sidebar).not.toMatch(/import\s*\{[^}]*applyCyclogazettePollVote[^}]*\}\s*from\s*"@\/services\/cyclogazette-games"/);
    const helper=readFileSync(new URL("./cyclogazette-poll-vote.ts",import.meta.url),"utf8");
    expect(helper.match(/^import.*$/gm)?.every(line=>line.startsWith("import type "))).toBe(true);
  });
});
