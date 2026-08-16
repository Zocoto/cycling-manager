import { describe, expect, it } from "vitest";

import {
  getMissingEnglishTutorialStepKeys,
  localizeTutorialDefinition,
} from "@/lib/i18n/tutorials-en";
import { listTutorialDefinitions } from "@/lib/tutorial/catalog";

describe("English tutorials", () => {
  it("covers every tutorial and every step", () => {
    expect(getMissingEnglishTutorialStepKeys(listTutorialDefinitions())).toEqual([]);
  });

  it("localizes copy without changing stable keys or routes", () => {
    const french = listTutorialDefinitions()[0];
    const english = localizeTutorialDefinition(french, "en");

    expect(english.key).toBe(french.key);
    expect(english.steps.map((step) => step.key)).toEqual(
      french.steps.map((step) => step.key),
    );
    expect(english.steps.map((step) => step.route)).toEqual(
      french.steps.map((step) => step.route),
    );
    expect(english.title).toBe("Getting started with Cyclo Stratège");
    expect(english.steps.find((step) => step.key === "primary-ratings")?.content)
      .toContain("MO, HIL, FL, COB, SP and TT");
  });
});
