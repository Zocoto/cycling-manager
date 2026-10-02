import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("real user performance monitoring", () => {
  it("reports sampled web vitals from a narrow client boundary", () => {
    const layout = readFileSync(join(root, "app", "layout.tsx"), "utf8");
    const reporter = readFileSync(
      join(root, "components", "monitoring", "web-vitals-reporter.tsx"),
      "utf8",
    );

    expect(layout).toContain("<WebVitalsReporter />");
    expect(reporter).toContain("useReportWebVitals(bufferWebVital)");
    expect(reporter).toContain("SAMPLE_RATE = 0.25");
    expect(reporter).toContain("navigator.sendBeacon");
  });

  it("keeps persistence bounded and outside the response path", () => {
    const route = readFileSync(
      join(root, "app", "api", "monitoring", "web-vitals", "route.ts"),
      "utf8",
    );

    expect(route).toContain("rawBody.length > 16_000");
    expect(route).toContain("rawMetrics.length > 10");
    expect(route).toContain("after(() => persistPerformanceSamples(samples))");
    expect(route).toContain('request.headers.get("origin")');
    expect(route).not.toContain("user-agent");
    expect(route).not.toContain("createSupabaseAdminClient");
  });
});
