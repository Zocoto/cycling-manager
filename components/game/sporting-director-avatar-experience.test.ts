import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("sporting director avatar experience", () => {
  it("keeps every portrait setting, including the trophy frame, inside the editor", () => {
    const editor = readSource(
      "components/game/sporting-director-avatar-editor.tsx",
    );
    const profile = readSource(
      "components/game/sporting-director-profile-form.tsx",
    );

    expect(editor).toContain("Liseré du portrait");
    expect(editor).toContain("hasAlphaTesterTrophy");
    expect(editor).toContain("Valider ce portrait");
    expect(profile.match(/name="alphaTesterFrameEnabled"/g)).toHaveLength(1);
    expect(profile).toContain('type="hidden"');
    expect(profile).not.toContain("Afficher le liseré Alphatesteur");
  });

  it("makes the author portrait larger in public chat messages", () => {
    const chat = readSource("components/game/global-game-chat.tsx");

    expect(chat).toContain('size="chat"');
    expect(chat).toContain("calc(100%_-_4.25rem)");
  });
});
