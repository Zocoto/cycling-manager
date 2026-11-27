import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TeamNationalityBadges } from "./team-nationality-badges";

const language = vi.hoisted(() => ({ locale: "fr" }));
vi.mock("@/components/i18n/locale-provider", () => ({ useLocale: () => language }));
beforeEach(() => { language.locale = "fr"; });

describe("team nationality badges", () => {
  it("uses English country names when the site is in English", () => {
    language.locale = "en";
    const html = renderToStaticMarkup(<TeamNationalityBadges countryCodes={["CO", "AM"]} />);
    expect(html).toContain("Colombia");
    expect(html).toContain("Armenia");
    expect(html).not.toContain("Colombie");
    expect(html).not.toContain("Arménie");
  });
  it("shows both countries as the team identity with links to their federations", () => {
    const html = renderToStaticMarkup(<TeamNationalityBadges countryCodes={["CO", "FR"]} />);
    expect(html).toContain("Nationalités de l’équipe");
    expect(html).toContain("Colombie");
    expect(html).toContain("France");
    expect(html).toContain('href="/jeu/nations/co"');
    expect(html).toContain('href="/jeu/nations/fr"');
    expect(html).toContain('class="fi fi-co');
    expect(html).toContain('class="fi fi-fr');
  });

  it("avoids duplicating the nationality when sponsors share a country", () => {
    const html = renderToStaticMarkup(<TeamNationalityBadges countryCodes={["co", " CO "]} dark />);
    expect(html).toContain("Nationalité de l’équipe");
    expect(html.match(/<a\b/g)).toHaveLength(1);
  });

  it("does not render an empty or malformed identity", () => {
    expect(renderToStaticMarkup(<TeamNationalityBadges countryCodes={["", "INVALID"]} />)).toBe("");
  });
});
