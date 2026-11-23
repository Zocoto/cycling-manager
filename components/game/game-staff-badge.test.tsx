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
    expect(html).toContain("bg-[#FFF0B0]");
    expect(html).toContain("text-[#4A340A]");
    expect(html).toContain("whitespace-nowrap");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<a");
    expect(html).not.toContain("admin");
    expect(html).not.toContain("moderator");
  });

  it("stays compact and clearly readable on a dark background alongside rookie", () => {
    const html = renderToStaticMarkup(<><GameStaffBadge inverse className="mt-2" /><RookieBadge inverse /></>);
    expect(html).toContain("text-[#35280D]");
    expect(html).toContain("bg-[#F2D477]");
    expect(html).toContain("text-[9px]");
    expect(html).toContain("mt-2");
    expect(html).toContain("Rookie");
    expect(html).toContain("Équipe du jeu");
  });
});
