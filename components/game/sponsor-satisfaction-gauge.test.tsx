import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SponsorSatisfactionGauge } from "./sponsor-satisfaction-gauge";

describe("sponsor satisfaction gauge", () => {
  it.each([
    [0, 0],
    [50, 40],
    [100, 140],
  ])("uses semantic colors at %i/100 independently of the sponsor", (score, hue) => {
    const markup = renderToStaticMarkup(<SponsorSatisfactionGauge score={score} />);

    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-label="Satisfaction sponsor"');
    expect(markup).toContain('aria-valuemin="0"');
    expect(markup).toContain('aria-valuemax="100"');
    expect(markup).toContain(`aria-valuenow="${score}"`);
    expect(markup).toContain(`width:${score}%`);
    expect(markup).toContain(`background-color:hsl(${hue} 65% 32%)`);
  });

  it.each([
    [-10, 0],
    [150, 100],
    [43.7, 44],
    [Number.NaN, 0],
  ])("keeps score %s within the displayed scale", (score, expected) => {
    const markup = renderToStaticMarkup(<SponsorSatisfactionGauge score={score} />);

    expect(markup).toContain(`aria-valuenow="${expected}"`);
    expect(markup).toContain(`width:${expected}%`);
  });

  it("uses brighter colors on the dark dashboard tile", () => {
    const markup = renderToStaticMarkup(<SponsorSatisfactionGauge score={75} variant="dashboard" />);

    expect(markup).toContain("background-color:hsl(90 65% 62%)");
    expect(markup).toContain('aria-valuenow="75"');
  });
});
