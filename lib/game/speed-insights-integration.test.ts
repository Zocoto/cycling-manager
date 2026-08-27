import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const rootLayout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");

describe("production performance telemetry", () => {
  it("records real-user Core Web Vitals from the root layout", () => {
    expect(rootLayout).toContain(
      'import { SpeedInsights } from "@vercel/speed-insights/next"',
    );
    expect(rootLayout).toContain("<SpeedInsights />");
  });
});
