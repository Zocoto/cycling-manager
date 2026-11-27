import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SecondarySponsorRosterObjective } from "./secondary-sponsor-roster-objective";
const language = vi.hoisted(() => ({ locale: "fr" }));
vi.mock("@/components/i18n/locale-provider", () => ({ useLocale: () => language }));
beforeEach(() => { language.locale = "fr"; });

describe("secondary sponsor roster objective language", () => {
  it("shows the numerical target and nationality in French", () => {
    expect(renderToStaticMarkup(<SecondarySponsorRosterObjective countryCode="AM" requiredCount={3} />)).toContain("3 coureurs (Arménie)");
    const progress = renderToStaticMarkup(<SecondarySponsorRosterObjective countryCode="AM" requiredCount={3} currentCount={1} progress />);
    expect(progress).toContain("1 / 3 coureurs · Arménie");
    expect(progress).toContain("Prime versée dès que le contingent est atteint.");
  });
  it("localizes country, rider count and payment terms in English", () => {
    language.locale = "en";
    expect(renderToStaticMarkup(<SecondarySponsorRosterObjective countryCode="AM" requiredCount={3} />)).toContain("3 riders from Armenia");
    const progress = renderToStaticMarkup(<SecondarySponsorRosterObjective countryCode="AM" requiredCount={3} currentCount={1} progress />);
    expect(progress).toContain("1 / 3 riders · Armenia");
    expect(progress).toContain("Bonus paid as soon as the required number is reached.");
    expect(progress).not.toContain("Arménie");
  });
});
