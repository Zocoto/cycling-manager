import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), role: vi.fn(), process: vi.fn(), upload: vi.fn(), admin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getUser: mocks.user } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
vi.mock("@/services/game-staff-access", () => ({ getCurrentGameStaffRole: mocks.role }));
vi.mock("@/services/chat-image-processing", () => ({ processChatImage: mocks.process }));
import { POST } from "./route";
import { GET } from "@/app/images/game-news/[filename]/route";
const origin = "https://cyclostratege.fr";
const form = () => { const value = new FormData(); value.set("image", new File(["webp"], "news.webp", { type: "image/webp" })); return value; };
const request = (body = form(), source = origin) => new Request(`${origin}/api/game/news/images`, { method: "POST", body, headers: { origin: source } });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ data: { user: { id: "editor" } }, error: null });
  mocks.role.mockResolvedValue("game_staff");
  mocks.process.mockResolvedValue({ data: Buffer.from("processed"), width: 1200, height: 600 });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.admin.mockReturnValue({ storage: { from: () => ({ upload: mocks.upload }) } });
});

describe("editor-only news image uploads", () => {
  it("refuses cross-origin requests before authentication", async () => {
    expect((await POST(request(form(), "https://evil.test"))).status).toBe(403);
    expect(mocks.user).not.toHaveBeenCalled();
  });
  it("refuses anonymous users and regular players before reading/decoding/uploading", async () => {
    mocks.user.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect((await POST(request())).status).toBe(401);
    mocks.role.mockResolvedValueOnce(null);
    expect((await POST(request())).status).toBe(403);
    expect(mocks.process).not.toHaveBeenCalled(); expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("uploads server-decoded bytes, never source filenames, with immutable content addresses", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("no-store");
    const { image } = await response.json();
    expect(image.path).toMatch(/^\/images\/game-news\/[a-f0-9]{64}\.webp$/);
    expect(mocks.upload).toHaveBeenCalledWith(image.path.split("/").at(-1), Buffer.from("processed"), { contentType: "image/webp", upsert: false, cacheControl: "31536000" });
    mocks.upload.mockResolvedValueOnce({ error: { statusCode: "409" } });
    expect((await POST(request())).status).toBe(200);
  });
  it("rejects invalid files and duplicate multipart images", async () => {
    const duplicate = form(); duplicate.append("image", new File(["x"], "extra.png", { type: "image/png" }));
    expect((await POST(request(duplicate))).status).toBe(400);
    expect(mocks.process).not.toHaveBeenCalled();
    mocks.process.mockRejectedValueOnce(new Error("invalid"));
    expect((await POST(request())).status).toBe(400); expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("bounds declared and streamed request sizes before decoding", async () => {
    const declared = request(); declared.headers.set("content-length", "9999999");
    expect((await POST(declared)).status).toBe(413); expect(mocks.user).not.toHaveBeenCalled();
    const oversized = new Request(`${origin}/api/game/news/images`, { method: "POST", body: new Uint8Array(2 * 1024 * 1024 + 32769), headers: { origin, "content-type": "multipart/form-data; boundary=x" } });
    expect((await POST(oversized)).status).toBe(413); expect(mocks.process).not.toHaveBeenCalled();
  });
  it("does not confirm storage failures or disclose internal errors", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.upload.mockResolvedValueOnce({ error: { statusCode: "500", message: "secret details" } });
    try {
      const response = await POST(request()); expect(response.status).toBe(503);
      expect(await response.text()).not.toContain("secret details");
    } finally { log.mockRestore(); }
  });
});

describe("public immutable editorial image delivery", () => {
  it("uses the storage CDN without database or authentication calls", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    try {
      const filename = `${"a".repeat(64)}.webp`;
      const response = await GET(new Request(origin), { params: Promise.resolve({ filename }) });
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe(`https://project.supabase.co/storage/v1/object/public/game-news-images/${filename}`);
      expect(response.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
      expect(mocks.user).not.toHaveBeenCalled(); expect(mocks.admin).not.toHaveBeenCalled();
    } finally { vi.unstubAllEnvs(); }
  });
  it("rejects arbitrary paths before accessing storage", async () => {
    expect((await GET(new Request(origin), { params: Promise.resolve({ filename: "../../secret" }) })).status).toBe(404);
  });
});
