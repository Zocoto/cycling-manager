import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/app/jeu/naturalization-alert-actions", () => ({ ignoreNaturalizationAlertAction: vi.fn() }));
import { DashboardNaturalizationIgnore } from "./dashboard-naturalization-ignore";
describe("naturalization ignore control", () => {
  it("offers a compact preference action without automatically naturalizing the rider", () => {
    const html = renderToStaticMarkup(<DashboardNaturalizationIgnore target={{ subjectType: "youth", subjectId: "junior", targetCountryId: "be" }} />);
    expect(html).toContain("Ignorer");
    expect(html).toContain("sans empêcher une naturalisation manuelle");
    expect(html).toContain('type="submit"');
    expect(html).not.toContain("Naturaliser pour");
  });
});
