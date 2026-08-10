import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GameHeaderActionsMenu } from "./game-header-actions-menu";

describe("GameHeaderActionsMenu", () => {
  it("uses a shortcuts grid instead of a second hamburger menu", () => {
    const markup = renderToStaticMarkup(
      <GameHeaderActionsMenu>
        <span>Raccourcis</span>
      </GameHeaderActionsMenu>,
    );

    expect(markup).toContain('aria-label="Ouvrir les raccourcis du jeu"');
    expect(markup.match(/<rect /g)).toHaveLength(4);
    expect(markup).not.toContain('d="M4 5h12M4 10h12M4 15h12"');
  });
});
