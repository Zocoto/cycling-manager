import { describe, expect, it } from "vitest";

import {
  REFERRAL_SHARE_TEXT,
  buildReferralShareHref,
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
});
