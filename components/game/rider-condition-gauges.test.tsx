import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RiderConditionGauges } from "./rider-condition-gauges";

describe("RiderConditionGauges", () => {
  it("rend le detail de forme ouvrable au toucher", () => {
    const markup = renderToStaticMarkup(
      <RiderConditionGauges
        form={72}
        dayNumber={8}
        events={[
          {
            label: "Course",
            delta: -10,
            occurredAt: "2026-08-02T08:00:00.000Z",
          },
        ]}
      />,
    );

    expect(markup).toContain('data-form-history-tooltip="touchable"');
    expect(markup).toContain("<summary");
    expect(markup).toContain("group-open/form-tooltip:visible");
    expect(markup).toContain("overflow-y-auto");
    expect(markup).toContain("Course");
    expect(markup).toContain("Total sur 48 h");
  });
});
