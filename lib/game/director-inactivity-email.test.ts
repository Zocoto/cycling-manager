import { describe, expect, it } from "vitest";

import { buildDirectorInactivityWarning } from "@/lib/game/director-inactivity-email";

describe("buildDirectorInactivityWarning", () => {
  it("annonce la date de suppression et le lien de reconnexion", () => {
    const warning = buildDirectorInactivityWarning({
      displayName: "T-point",
      teamName: "Équipe des Cimes",
      lastActivityAt: new Date("2026-07-01T12:00:00Z"),
      deletionAt: new Date("2026-08-14T12:00:00Z"),
      siteUrl: "https://cyclostratege.fr",
    });

    expect(warning.subject).toContain("14 jours");
    expect(warning.textContent).toContain("1 juillet 2026");
    expect(warning.textContent).toContain("14 août 2026");
    expect(warning.textContent).toContain(
      "https://cyclostratege.fr/connexion",
    );
    expect(warning.textContent).toContain("Une simple connexion");
    expect(warning.textContent).toContain("agents libres");
  });

  it("neutralise le HTML fourni par les profils", () => {
    const warning = buildDirectorInactivityWarning({
      displayName: '<script>alert("ds")</script>',
      teamName: "A&B <Team>",
      lastActivityAt: new Date("2026-07-01T12:00:00Z"),
      deletionAt: new Date("2026-08-14T12:00:00Z"),
      siteUrl: "https://cyclostratege.fr",
    });

    expect(warning.htmlContent).not.toContain("<script>");
    expect(warning.htmlContent).toContain("&lt;script&gt;");
    expect(warning.htmlContent).toContain("A&amp;B &lt;Team&gt;");
  });
});
