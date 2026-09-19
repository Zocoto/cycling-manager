import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CommunityRecruitment } from "./community-recruitment";

describe("community recruitment", () => {
  it("rend visibles le Discord et les quatre façons de contribuer", () => {
    const markup = renderToStaticMarkup(<CommunityRecruitment locale="fr" />);

    expect(markup).toContain("Rejoindre le Discord");
    expect(markup).toContain("https://discord.gg/Zq9ecPYEF");
    expect(markup).toContain("Joueur");
    expect(markup).toContain("Bêta-testeur");
    expect(markup).toContain("Testeur de bugs");
    expect(markup).toContain("Modérateur");
    expect(markup).toContain("Trello du projet");
  });
});
