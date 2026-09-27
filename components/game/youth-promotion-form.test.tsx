import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { YouthPromotionForm } from "./youth-promotion-form";

describe("YouthPromotionForm", () => {
  it("présente une signature locale prête à afficher son état d’attente", () => {
    const markup = renderToStaticMarkup(
      <YouthPromotionForm
        academyRiderId="4d317908-d942-4e1a-8d75-4f464ef7c49b"
        nextGameYear={4}
      />,
    );

    expect(markup).toContain('name="academyRiderId"');
    expect(markup).toContain("Recruter pour la saison 4");
    expect(markup).toContain('type="submit"');
  });
});
