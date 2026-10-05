import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), provider: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("./chat-translation-batch-provider", () => ({ translateChatTextBatch: mocks.provider }));
import { getOrCreateGlobalChatTranslations } from "./global-chat-translation";
const sources = ["one", "two"].map((messageId) => ({ messageId, sourceMessage: "Bonjour", sourceEditedAt: null }));
const input = { sources, targetLocale: "en" as const, requesterDirectorId: "director" };
beforeEach(() => vi.resetAllMocks());
describe("shared bounded translation service", () => {
  it("serves shared cache hits without a provider call or cache write", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ messageId: "one", status: "cached", translatedText: "Hello", detectedSourceLocale: "fr" }], error: null });
    expect(await getOrCreateGlobalChatTranslations(input)).toMatchObject([{ status: "loaded", translation: { cached: true } }]);
    expect(mocks.provider).not.toHaveBeenCalled(); expect(mocks.rpc).toHaveBeenCalledOnce();
  });
  it("uses one provider request and one atomic completion for all newly claimed messages", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: sources.map((s) => ({ messageId: s.messageId, status: "claimed", ticket: "ticket" })), error: null }).mockResolvedValue({ error: null });
    mocks.provider.mockResolvedValue(sources.map(() => ({ translatedText: "Hello", detectedSourceLocale: "fr", provider: "vercel-ai-gateway" })));
    expect(await getOrCreateGlobalChatTranslations(input)).toHaveLength(2); expect(mocks.provider).toHaveBeenCalledOnce(); expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc.mock.calls[0][1].p_items[0].source_fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });
  it.each(["busy", "quota", "budget", "unavailable"])("never calls the provider on %s", async (status) => {
    mocks.rpc.mockResolvedValue({ data: [{ messageId: "one", status }], error: null });
    await getOrCreateGlobalChatTranslations(input); expect(mocks.provider).not.toHaveBeenCalled();
  });
  it("fails closed on a database error, and opens the circuit breaker on provider failure", async () => {
    mocks.rpc.mockResolvedValueOnce({ error: { message: "missing schema" } });
    await expect(getOrCreateGlobalChatTranslations(input)).rejects.toThrow(); expect(mocks.provider).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValueOnce({ data: [{ messageId: "one", status: "claimed", ticket: "ticket" }], error: null }).mockResolvedValue({ error: null });
    mocks.provider.mockRejectedValue(new Error("offline"));
    expect(await getOrCreateGlobalChatTranslations(input)).toMatchObject([{ status: "unavailable" }]);
    expect(mocks.rpc).toHaveBeenLastCalledWith("complete_global_chat_translation_batch", { p_ticket: "ticket", p_success: false, p_results: [] });
  });
});
