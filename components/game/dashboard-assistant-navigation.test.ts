import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "components/game/dashboard-assistant.tsx"),
  "utf8",
);

describe("dashboard assistant journal navigation", () => {
  it("ouvre toujours le message sélectionné dans la messagerie", () => {
    expect(source).toContain(
      "`/jeu/messagerie?message=${encodeURIComponent(item.id)}`",
    );
    expect(source).toContain("href={mailboxHref}");
    expect(source).not.toContain("href={item.href}");
  });
});
