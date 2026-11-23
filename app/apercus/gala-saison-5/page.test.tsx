import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import SeasonFiveGalaPreviewRedirect from "./page";

describe("previous private gala URL", () => {
  it("routes previously shared links to the official authenticated page", () => {
    SeasonFiveGalaPreviewRedirect();
    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/jeu/gala-saison-5");
  });
});
