import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SportingDirectorAvatar } from "@/components/game/sporting-director-avatar";

describe("SportingDirectorAvatar", () => {
  it("renders the subtle Alphatesteur frame only when it is activated", () => {
    const framed = renderToStaticMarkup(
      <SportingDirectorAvatar
        avatarKey="director_m_01"
        frameKey="alpha_tester"
        label="Avatar Alphatesteur"
      />
    );
    const plain = renderToStaticMarkup(
      <SportingDirectorAvatar avatarKey="director_m_01" />
    );

    expect(framed).toContain('data-avatar-frame="alpha_tester"');
    expect(framed).toContain("conic-gradient");
    expect(plain).not.toContain("data-avatar-frame");
    expect(plain).not.toContain("conic-gradient");
  });
});