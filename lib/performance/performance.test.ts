import { describe, expect, it, vi } from "vitest";
import { normalizePerformanceRoute, parseWebPerformanceSample, type PerformanceSample } from "./samples";
import { createTimedRpcFetch } from "./rpc-fetch";

describe("privacy-preserving performance samples", () => {
  it("groups dynamic routes without retaining names, IDs or queries", () => {
    expect(normalizePerformanceRoute("/jeu/federations/jp?token=secret")).toBe("/jeu/federations");
    expect(normalizePerformanceRoute("/jeu/coureurs/private-id")).toBe("/jeu/autre");
    const sample = parseWebPerformanceSample({ name: "LCP", value: 800, viewportWidth: 390, pathname: "/jeu/chat/123", id: "secret", userAgent: "secret" });
    expect(sample).toEqual({ source: "web", route: "/jeu/chat", metric: "LCP", value: 800, device: "mobile", ok: true });
  });
  it("rejects invalid or excessive numeric values and unknown metrics", () => {
    const valid = { name: "CLS", value: 0.1, viewportWidth: 1200, pathname: "/jeu" };
    for (const override of [{ value: NaN }, { value: Infinity }, { value: -1 }, { value: 11 }, { name: "unknown" }, { pathname: "https://bad" }, { viewportWidth: 0 }]) {
      expect(parseWebPerformanceSample({ ...valid, ...override })).toBeNull();
    }
  });
});

describe("transparent RPC timing", () => {
  const origin = "https://example.supabase.co";
  const url = `${origin}/rest/v1/rpc/get_current_dashboard_core_summary_v2`;
  it("returns the identical response and forwards all arguments", async () => {
    const response = new Response("unchanged");
    const base = vi.fn<typeof fetch>().mockResolvedValue(response);
    const samples: PerformanceSample[] = [];
    const timed = createTimedRpcFetch(base, origin, (sample) => samples.push(sample));
    const init = { method: "POST", body: "private-data" };
    expect(await timed(url, init)).toBe(response);
    expect(base).toHaveBeenCalledWith(url, init);
    expect(samples[0]).toMatchObject({ metric: "get_current_dashboard_core_summary_v2", ok: true });
    expect(JSON.stringify(samples)).not.toContain("private-data");
  });
  it("keeps network errors, HTTP errors and telemetry failures unchanged", async () => {
    const failure = new Error("network");
    const record = vi.fn<(sample: PerformanceSample) => void>(() => { throw new Error("telemetry"); });
    await expect(createTimedRpcFetch(vi.fn<typeof fetch>().mockRejectedValue(failure), origin, record)(url)).rejects.toBe(failure);
    const response = new Response("bad request", { status: 400 });
    expect(await createTimedRpcFetch(vi.fn<typeof fetch>().mockResolvedValue(response), origin, record)(new Request(url))).toBe(response);
    expect(record.mock.calls[0][0]).toMatchObject({ ok: false });
  });
  it("does not instrument authentication, tables, unlisted RPCs or other hosts", async () => {
    const record = vi.fn();
    const base = vi.fn<typeof fetch>().mockResolvedValue(new Response());
    const timed = createTimedRpcFetch(base, origin, record);
    for (const path of [`${origin}/auth/v1/user`, `${origin}/rest/v1/riders`, `${origin}/rest/v1/rpc/other`, url.replace(origin, "https://other.test")]) await timed(path);
    expect(record).not.toHaveBeenCalled();
  });
});
