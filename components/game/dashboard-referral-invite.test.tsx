import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DashboardReferralInvite } from "./dashboard-referral-invite";

describe("DashboardReferralInvite", () => {
  it("relance la campagne ambassadeurs depuis le bureau", () => {
    const markup = renderToStaticMarkup(<DashboardReferralInvite />);

    expect(markup).toContain("Saison 2 · Appel aux ambassadeurs");
    expect(markup).toContain("Le peloton a besoin de renfort");
    expect(markup).toContain('href="/jeu/parrainage"');
    expect(markup).toContain("Partager mon lien");
  });
});
