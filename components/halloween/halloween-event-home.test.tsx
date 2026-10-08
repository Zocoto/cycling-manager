import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HalloweenEventHome } from "./halloween-event-home";

describe("accueil Halloween illustré", () => {
  it("rend les trois activités et leurs illustrations sans compte fictif", () => {
    const html = renderToStaticMarkup(createElement(HalloweenEventHome, { onSelect: () => undefined }));
    for (const activity of ["runner", "candy", "shop"]) expect(html).toContain(`data-halloween-activity="${activity}"`);
    expect(html.match(/class="halloween-event-card-art/g)).toHaveLength(3);
    expect(html.match(/<svg/g)!.length).toBeGreaterThanOrEqual(5);
    expect(html).toContain("Jouer la poursuite");
    expect(html).toContain("Choisir un bonbon");
    expect(html).toContain("Explorer la boutique");
    expect(html).not.toMatch(/fictif|démonstration|\/apercus\/|24 roues/);
  });
  it("conserve le header natif même si l’événement est momentanément indisponible", () => {
    const page = readFileSync(resolve("app/jeu/halloween/page.tsx"), "utf8");
    expect(page).toContain("getGameHeaderData(supabase, user.id)");
    expect(page.indexOf("<GameHeader")).toBeLessThan(page.indexOf("{error || !data ?"));
    expect(page).not.toMatch(/\.insert\(|\.update\(|\.delete\(/);
  });
  it("réemploie l’art approuvé dans la page réelle, sans activer les styles du pilote", () => {
    const event = readFileSync(resolve("components/halloween/halloween-event.tsx"), "utf8");
    expect(event).toContain("<HalloweenNightRide />");
    expect(event).toContain("<HalloweenEventHome onSelect={setTab} />");
    expect(event).not.toContain('data-halloween-preview="pilot"');
    const preview = readFileSync(resolve("app/apercus/halloween-recette/page.tsx"), "utf8");
    expect(preview).toContain('process.env.NODE_ENV === "production"');
    expect(preview).toContain("<GameHeader");
  });
});
