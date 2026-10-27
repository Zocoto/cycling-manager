import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "components/game/dashboard-assistant.tsx"),
  "utf8",
);

describe("dashboard assistant journal navigation", () => {
  it("ouvre le profil staff signalé et conserve la messagerie pour les autres actualités", () => {
    expect(source).toContain(
      "`/jeu/messagerie?message=${encodeURIComponent(item.id)}`",
    );
    expect(source).toContain("href={getStaffRecruitmentTargetHref(item.href) ?? mailboxHref}");
    expect(source).toContain("messageToMarkReadId={item.read ? null : item.id}");
    expect(source).not.toContain("href={item.href}");
  });
});
