import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HalloweenAvatarChoices } from "./halloween-avatar-choices";

describe("catégories de la collection d'avatar", () => {
  const props = { owned: ["lord-vlad", "halloween-background", "devil-trident", "pumpkin-cap", "pocket-bat", "spectral-wheel", "cobweb-frame", "ghost-scarf"] as const,
    selected: ["devil-trident", "pocket-bat"] as const, baseKey: "director_m_01", onToggle: vi.fn() };
  it("sépare fonds, chapeaux et tenues des accessoires cumulables", () => {
    for (const [category, name] of [["background", "Fond Halloween"], ["hat", "Casquette citrouille"], ["outfit", "Tenue Lord Vlad"]] as const) {
      const html = renderToStaticMarkup(<HalloweenAvatarChoices {...props} category={category} />);
      expect(html).toContain(name);
      expect(html).not.toContain("Trident du supporter");
      expect(html.match(/<button/g)).toHaveLength(1);
    }
    const html = renderToStaticMarkup(<HalloweenAvatarChoices {...props} category="accessories" />);
    expect(html.match(/<button/g)).toHaveLength(5);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(2);
    expect(html).toContain("Cumulez les accessoires compatibles");
    expect(html).not.toContain("Casquette citrouille");
  });
  it("n'offre pas d'élément non acquis et explique les malédictions", () => {
    const empty = renderToStaticMarkup(<HalloweenAvatarChoices {...props} owned={[]} category="hat" />);
    expect(empty).not.toContain("<button");
    expect(empty).toContain("Vos achats et cadeaux");
    const cursed = renderToStaticMarkup(<HalloweenAvatarChoices {...props} category="outfit" curse="vampire" />);
    expect(cursed).toContain("Votre tenue réapparaîtra à la fin de la malédiction");
  });
});
