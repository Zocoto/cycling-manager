import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LocaleProvider } from "@/components/i18n/locale-provider";
import { RiderStatsRadar } from "./rider-stats-radar";

const ratings = {
  mountain: 70,
  hills: 70,
  flat: 70,
  timeTrial: 70,
  cobbles: 70,
  sprint: 70,
  acceleration: 70,
  downhill: 70,
  endurance: 70,
  resistance: 70,
  recovery: 70,
  breakaway: 70,
  prologue: 70,
};

describe("RiderStatsRadar", () => {
  it("marks six primary ratings and seven secondary ratings", () => {
    const markup = renderToStaticMarkup(
      <RiderStatsRadar
        equipmentBonuses={{ timeTrial: 4 }}
        ratings={ratings}
      />,
    );

    expect(markup.match(/data-rating-importance="primary"/g)).toHaveLength(6);
    expect(markup.match(/data-rating-importance="secondary"/g)).toHaveLength(7);
    expect(markup).toContain("bg-[#3F8F5A]");
    expect(markup).toContain("bg-[#DDEDE1]");
    expect(markup).toContain("Bonus équipement : +4");
    expect(markup).toContain('data-radar-layer="base"');
    expect(markup).toContain('data-radar-layer="equipment"');
    expect(markup).toContain('data-equipment-boost="timeTrial"');
    expect(markup).toContain('data-equipment-bonus="4"');
    expect(markup).toContain("avec les bonus d’équipement en bleu");
    expect(markup).toContain("Stats naturelles");
    expect(markup).toContain("Avec équipement");
  });

  it("does not render the equipment layer without a positive equipment bonus", () => {
    const markup = renderToStaticMarkup(
      <RiderStatsRadar
        ratings={ratings}
      />,
    );

    expect(markup).toContain('data-radar-layer="base"');
    expect(markup).not.toContain('data-radar-layer="equipment"');
    expect(markup).not.toContain("data-equipment-boost");
    expect(markup).not.toContain("Avec équipement");
  });

  it("uses the PCM abbreviations for the active language", () => {
    const frenchMarkup = renderToStaticMarkup(
      <LocaleProvider initialLocale="fr">
        <RiderStatsRadar ratings={ratings} />
      </LocaleProvider>,
    );
    const englishMarkup = renderToStaticMarkup(
      <LocaleProvider initialLocale="en">
        <RiderStatsRadar ratings={ratings} />
      </LocaleProvider>,
    );

    expect(frenchMarkup).toContain(">VAL<");
    expect(frenchMarkup).toContain(">CLM<");
    expect(frenchMarkup).not.toContain(">HIL<");
    expect(englishMarkup).toContain(">HIL<");
    expect(englishMarkup).toContain(">TT<");
    expect(englishMarkup).not.toContain(">VAL<");
  });
});
