import { describe, expect, it } from "vitest";

import {
  REFERRAL_SHARE_TEXT,
  buildReferralShareHref,
  buildReferralShareText,
} from "./referral-share-controls";

const inviteUrl =
  "https://cyclostratege.fr/inscription?parrain=DS-ABC123&utm_source=player_referral";

describe("referral share controls", () => {
  it("construit un partage WhatsApp avec le message et le lien personnels", () => {
    const href = buildReferralShareHref("whatsapp", inviteUrl);

    expect(href).toContain("https://wa.me/?text=");
    expect(decodeURIComponent(href)).toContain(REFERRAL_SHARE_TEXT);
    expect(decodeURIComponent(href)).toContain(inviteUrl);
  });

  it("construit le partage Facebook autour du lien personnel", () => {
    expect(buildReferralShareHref("facebook", inviteUrl)).toBe(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteUrl)}`,
    );
  });

  it("prépare un e-mail complet", () => {
    const href = buildReferralShareHref("email", inviteUrl);

    expect(href).toContain("mailto:?subject=");
    expect(decodeURIComponent(href)).toContain("Rejoins-moi sur Cyclo Stratège");
    expect(decodeURIComponent(href)).toContain(inviteUrl);
  });

  it("met le cadeau limité dans le message des ambassadeurs", () => {
    const message = buildReferralShareText({
      code: "welcome_week_2026_09",
      startsAt: "2026-09-19T08:00:00.000Z",
      endsAt: "2026-09-26T08:00:00.000Z",
      extraStartingCash: 5000,
      totalStartingCash: 15000,
      scoutLevel: 3,
    });

    expect(message).toContain("15 000 €");
    expect(message).toContain("scout niveau 3");
    expect(
      decodeURIComponent(buildReferralShareHref("whatsapp", inviteUrl, message)),
    ).toContain(message);
  });
});
