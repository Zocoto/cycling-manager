import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ after: vi.fn(), persist: vi.fn().mockResolvedValue(undefined) }));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/services/performance-monitoring", () => ({ persistPerformanceSamples: mocks.persist }));
import { POST } from "./route";

const url = "https://cyclostratege.fr/api/monitoring/web-vitals";
function request(body: string, origin = "https://cyclostratege.fr") {
  return new Request(url, { method: "POST", headers: { origin }, body });
}
describe("bounded, deferred web vitals endpoint", () => {
  beforeEach(() => vi.clearAllMocks());
  it("responds before persistence, with normalized samples only", async () => {
    const response = await POST(request(JSON.stringify({ metrics: [{ name: "LCP", value: 500, viewportWidth: 390, pathname: "/jeu/federations/jp?secret=1", user: "private" }] })));
    expect(response.status).toBe(204);
    expect(mocks.persist).not.toHaveBeenCalled();
    await mocks.after.mock.calls[0][0]();
    expect(mocks.persist).toHaveBeenCalledWith([{ source: "web", route: "/jeu/federations", metric: "LCP", value: 500, device: "mobile", ok: true }]);
  });
  it("rejects cross-origin, malformed, excessive and invalid payloads without writing", async () => {
    expect((await POST(request("{}", "https://attacker.test"))).status).toBe(403);
    expect((await POST(request("not json"))).status).toBe(400);
    expect((await POST(request("x".repeat(16_001)))).status).toBe(413);
    expect((await POST(request(JSON.stringify({ metrics: Array(11).fill({}) })))).status).toBe(400);
    expect((await POST(request(JSON.stringify({ metrics: [{ name: "LCP", value: -1 }] })))).status).toBe(400);
    expect(mocks.after).not.toHaveBeenCalled();
  });
});
