import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GameStaffBadge } from "./game-staff-badge";
import { RookieBadge } from "./rookie-badge";

describe("game staff visual badge", () => {
  it("identifies the game team without adding an action or authorization", () => {
    const html = renderToStaticMarkup(<GameStaffBadge />);
    expect(html).toContain("Équipe du jeu");
    expect(html).toContain('aria-label="Équipe du jeu"');
    expect(html).toContain('data-game-staff-badge="true"');
    expect(html).toContain("border-[#278B70]/25");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<a");
    expect(html).not.toContain("admin");
    expect(html).not.toContain("moderator");
  });

  it("remains subtle and readable on a dark background alongside rookie", () => {
    const html = renderToStaticMarkup(<><GameStaffBadge inverse className="mt-2" /><RookieBadge inverse /></>);
    expect(html).toContain("text-[#B9EBD2]");
    expect(html).toContain("bg-[#9BE0BC]/8");
    expect(html).toContain("mt-2");
    expect(html).toContain("Rookie");
    expect(html).toContain("Équipe du jeu");
  });
});
