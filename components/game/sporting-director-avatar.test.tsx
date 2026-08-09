import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SportingDirectorAvatar } from "@/components/game/sporting-director-avatar";
import {
  ASSIDU_AVATAR_GLASSES_KEY,
  DEFAULT_SPORTING_DIRECTOR_AVATAR,
  encodeSportingDirectorAvatar,
} from "@/lib/sporting-director-avatar";

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

  it("renders the Premier de la classe glasses unlocked by Assidu", () => {
    const avatarKey = encodeSportingDirectorAvatar({
      ...DEFAULT_SPORTING_DIRECTOR_AVATAR,
      glasses: ASSIDU_AVATAR_GLASSES_KEY,
    });
    const markup = renderToStaticMarkup(
      <SportingDirectorAvatar avatarKey={avatarKey} label="Avatar Assidu" />,
    );

    expect(markup).toContain('data-avatar-accessory="assidu-glasses"');
    expect(markup).toContain("#D7A928");
  });
});