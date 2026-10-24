import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FederationSponsorsPopover } from "./federation-sponsors-popover";

describe("FederationSponsorsPopover", () => {
  it("conserve un compteur compact sans monter la liste ni charger les logos avant ouverture", () => {
    const markup = renderToStaticMarkup(
      <FederationSponsorsPopover
        countryName="Belgique"
        counterLabel="2 / 7"
        sponsors={[{
          id: "sponsor-test", name: "Sponsor de test", sector: "Secteur de test",
          logoPath: "/images/sponsors/test/logo.webp",
          colors: { primary: "#183F37", background: "#FFFFFF", text: "#183F37" },
        }]}
      />,
    );
    expect(markup).toContain("2 / 7");
    expect(markup).toContain("Voir les sponsors nationaux · Belgique");
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).not.toContain('role="dialog"');
    expect(markup).not.toContain("Sponsor de test");
    expect(markup).not.toContain("Secteur de test");
    expect(markup).not.toContain("<img");
    expect(markup).not.toContain("logo.webp");
  });

  it("permet de consulter un catalogue vide", () => {
    const markup = renderToStaticMarkup(
      <FederationSponsorsPopover countryName="Pays de test" counterLabel="0 / 0" sponsors={[]} />,
    );
    expect(markup).toContain("0 / 0");
    expect(markup).not.toContain("disabled");
  });

  it("reste un composant local sans catalogue complet, fetch ou abonnement distant", () => {
    const source = readFileSync(new URL("./federation-sponsors-popover.tsx", import.meta.url), "utf8");
    expect(source).not.toMatch(/(?:from|import\()\s*["']@\/(?:data\/sponsors|lib\/supabase)/);
    expect(source).not.toMatch(/\bfetch\s*\(|\.subscribe\s*\(|setInterval\s*\(/);
    expect(source).toContain('open && typeof document !== "undefined"');
    expect(source).toContain('event.pointerType === "mouse"');
    expect(source).toContain('event.key !== "Escape"');
  });
});
