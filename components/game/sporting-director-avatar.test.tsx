import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SportingDirectorAvatar } from "@/components/game/sporting-director-avatar";
import {
  AMBULANCIER_AVATAR_OUTFIT_KEY,
  ASSIDU_AVATAR_GLASSES_KEY,
  DEFAULT_SPORTING_DIRECTOR_AVATAR,
  EMERGENCY_DOCTOR_AVATAR_OUTFIT_KEY,
  encodeSportingDirectorAvatar,
  HIDDEN_SWITCHBACK_AVATAR_GLASSES_KEY,
  SPONSOR_AMBASSADOR_AVATAR_OUTFIT_KEY,
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

  it("renders the spy glasses unlocked by the hidden switchback", () => {
    const avatarKey = encodeSportingDirectorAvatar({
      ...DEFAULT_SPORTING_DIRECTOR_AVATAR,
      glasses: HIDDEN_SWITCHBACK_AVATAR_GLASSES_KEY,
    });
    const markup = renderToStaticMarkup(
      <SportingDirectorAvatar avatarKey={avatarKey} label="Avatar espion" />,
    );

    expect(markup).toContain('data-avatar-accessory="spy-glasses"');
    expect(markup).toContain("#8057B5");
  });

  it("renders the Maillot d’Or unlocked by a perfect sponsor season", () => {
    const avatarKey = encodeSportingDirectorAvatar({
      ...DEFAULT_SPORTING_DIRECTOR_AVATAR,
      outfit: SPONSOR_AMBASSADOR_AVATAR_OUTFIT_KEY,
    });
    const markup = renderToStaticMarkup(
      <SportingDirectorAvatar avatarKey={avatarKey} label="Avatar ambassadeur" />,
    );

    expect(markup).toContain('data-avatar-outfit="sponsor-ambassador"');
    expect(markup).toContain("#D6AE3B");
  });

  it("renders the nurse cap unlocked by the Ambulancier trophy", () => {
    const avatarKey = encodeSportingDirectorAvatar({
      ...DEFAULT_SPORTING_DIRECTOR_AVATAR,
      outfit: AMBULANCIER_AVATAR_OUTFIT_KEY,
    });
    const markup = renderToStaticMarkup(
      <SportingDirectorAvatar avatarKey={avatarKey} label="Avatar ambulancier" />,
    );

    expect(markup).toContain('data-avatar-headwear="nurse-cap"');
    expect(markup).toContain('data-avatar-outfit="medical-nurse"');
  });

  it("renders the doctor coat and stethoscope unlocked by the emergency trophy", () => {
    const avatarKey = encodeSportingDirectorAvatar({
      ...DEFAULT_SPORTING_DIRECTOR_AVATAR,
      outfit: EMERGENCY_DOCTOR_AVATAR_OUTFIT_KEY,
    });
    const markup = renderToStaticMarkup(
      <SportingDirectorAvatar avatarKey={avatarKey} label="Avatar urgentiste" />,
    );

    expect(markup).toContain('data-avatar-outfit="emergency-doctor"');
    expect(markup).toContain("#B62F46");
  });
});
