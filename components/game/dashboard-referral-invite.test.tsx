import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DashboardReferralInvite } from "./dashboard-referral-invite";

describe("DashboardReferralInvite", () => {
  it("présente les boosters et permet de copier le lien depuis le bureau", () => {
    const markup = renderToStaticMarkup(
      <DashboardReferralInvite
        inviteUrl="https://cyclostratege.fr/inscription?parrain=DS-ABCDEF012345"
        showBoosters
      />,
    );

    expect(markup).toContain("Invitez un ami dans le peloton");
    expect(markup).toContain("2 boosters Cyclo-Stickers par filleul confirmé");
    expect(markup).toContain("Copier mon lien");
    expect(markup).toContain('aria-label="Masquer la proposition de parrainage"');
  });

  it("conserve le lien de parrainage si le code manque et retire l’annonce hors saison", () => {
    const markup = renderToStaticMarkup(
      <DashboardReferralInvite inviteUrl={null} showBoosters={false} />,
    );

    expect(markup).not.toContain("boosters");
    expect(markup).toContain('href="/jeu/parrainage"');
    expect(markup).toContain("Voir mon lien");
  });
});
