import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { SponsorObjectiveName } from "./sponsor-objective-name";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { createSponsorProjectFixture } from "@/test/sponsor-project-fixture";

it("translates the signed race target without translating a race's proper name", () => {
  const { objective } = createSponsorProjectFixture();
  const html = renderToStaticMarkup(<LocaleProvider initialLocale="en"><SponsorObjectiveName objective={objective} /></LocaleProvider>);
  expect(html).toContain('Top 10 at <span data-i18n-skip="true">Pavés du Nord</span>');
  expect(objective.name).toBe("Top 10 sur les Pavés du Nord");
});

it("uses the same national quota target in French and English", () => {
  const { quota } = createSponsorProjectFixture();
  expect(renderToStaticMarkup(<SponsorObjectiveName objective={quota} />)).toContain(quota.name);
  expect(renderToStaticMarkup(<LocaleProvider initialLocale="en"><SponsorObjectiveName objective={quota} /></LocaleProvider>)).toBe("Roster from FR: at least 75%");
});
