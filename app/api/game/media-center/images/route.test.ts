import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), reserve: vi.fn(), process: vi.fn(), upload: vi.fn(), ready: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    rpc: mocks.reserve,
    storage: { from: () => ({ upload: mocks.upload }) },
    from: () => ({ update: mocks.ready }),
  }),
}));
vi.mock("@/services/chat-image-processing", () => ({ processChatImage: mocks.process }));

import { POST } from "./route";
import { GET } from "./[teamId]/[filename]/route";

const origin = "https://cyclostratege.example";
const teamId = "a7a355f9-0064-4ec8-a1fe-083840c57e2d";
const assetId = "7ff3dac6-045d-441c-ab3c-251c82c70e69";

function uploadRequest(source = origin) {
  const form = new FormData();
  form.set("image", new File(["input"], "capture.webp", { type: "image/webp" }));
  return new Request(`${origin}/api/game/media-center/images`, { method: "POST", headers: { origin: source }, body: form });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "member" } }, error: null });
  mocks.reserve.mockResolvedValue({ data: { id: assetId, team_id: teamId }, error: null });
  mocks.process.mockResolvedValue({ data: Buffer.from("reencoded"), width: 1200, height: 800 });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.ready.mockReturnValue({ eq: () => ({ select: () => ({ single: async () => ({ data: { id: assetId }, error: null }) }) }) });
});

describe("Média Center article illustrations", () => {
  it("blocks cross-origin uploads, missing Media Center access and uploads over quota before decoding", async () => {
    expect((await POST(uploadRequest("https://other.example"))).status).toBe(403);
    expect(mocks.getUser).not.toHaveBeenCalled();

    mocks.reserve.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    expect((await POST(uploadRequest())).status).toBe(403);
    mocks.reserve.mockResolvedValueOnce({ data: null, error: { code: "PT429" } });
    expect((await POST(uploadRequest())).status).toBe(429);
    expect(mocks.process).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("saves only re-encoded bytes at the reserved path, then records the real dimensions", async () => {
    const response = await POST(uploadRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ image: {
      assetId, src: `/api/game/media-center/images/${teamId}/${assetId}.webp`, width: 1200, height: 800,
    } });
    expect(mocks.reserve).toHaveBeenCalledWith("reserve_media_center_article_image", { p_auth_user_id: "member" });
    expect(mocks.upload).toHaveBeenCalledWith(`${teamId}/${assetId}.webp`, Buffer.from("reencoded"), {
      contentType: "image/webp", upsert: false, cacheControl: "31536000",
    });
    expect(mocks.ready).toHaveBeenCalledWith({ width: 1200, height: 800 });
    expect(mocks.ready.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.upload.mock.invocationCallOrder[0]);
  });

  it("serves an immutable storage redirect and rejects invalid paths", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.example");
    try {
      const request = new Request(origin);
      const response = await GET(request, { params: Promise.resolve({ teamId, filename: `${assetId}.webp` }) });
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe(`https://project.supabase.example/storage/v1/object/public/media-center-images/${teamId}/${assetId}.webp`);
      expect(response.headers.get("Cache-Control")).toContain("immutable");
      expect((await GET(request, { params: Promise.resolve({ teamId, filename: "../document.svg" }) })).status).toBe(404);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
