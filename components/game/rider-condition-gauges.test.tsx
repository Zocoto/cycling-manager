import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RiderConditionGauges } from "./rider-condition-gauges";

describe("RiderConditionGauges", () => {
  it("rend le detail de forme ouvrable au toucher", () => {
    const markup = renderToStaticMarkup(
      <RiderConditionGauges
        form={72}
        morale={68}
        dayNumber={8}
        events={[
          {
            label: "Course",
            delta: -10,
            occurredAt: "2026-08-02T08:00:00.000Z",
          },
        ]}
        moraleEvents={[
          {
            label: "Confiance affichée en zone mixte",
            delta: 3,
            occurredAt: "2026-08-02T09:00:00.000Z",
          },
        ]}
      />,
    );

    expect(markup).toContain('data-form-history-tooltip="touchable"');
    expect(markup).toContain("Santé du coureur");
    expect(markup).toContain("<summary");
    expect(markup).toContain("group-open/form-tooltip:visible");
    expect(markup).toContain("overflow-y-auto");
    expect(markup).toContain("Course");
    expect(markup).toContain("Total des variations affichées");
    expect(markup).toContain("Moral");
    expect(markup).toContain("bg-[#3B82F6]");
    expect(markup).toContain("Confiance affichée en zone mixte");
  });
});
