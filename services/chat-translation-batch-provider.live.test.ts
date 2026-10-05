// Explicit opt-in, provider only: no Supabase connection or gameplay mutation.
// Two bounded calls. Never log credentials, input messages or translated text.
import { expect, it } from "vitest";
import { translateChatTextBatch } from "./chat-translation-batch-provider";

const liveTest = process.env.CHAT_PROVIDER_LIVE_VERIFY === "1" ? it : it.skip;
const inspectedFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  const payload = await response.clone().json();
  const choice = payload.choices?.[0];
  const content = choice?.message?.content;
  let parsed: { translations?: unknown; detectedSourceLocales?: unknown } | null = null;
  try { parsed = typeof content === "string" ? JSON.parse(content) : null; } catch { /* Metadata only. */ }
  console.info("Provider verification metadata", {
    httpStatus: response.status,
    finishReason: ["stop", "length", "content_filter"].includes(choice?.finish_reason) ? choice.finish_reason : "other",
    outputTokens: payload.usage?.completion_tokens,
    validJson: parsed !== null,
    translationCount: Array.isArray(parsed?.translations) ? parsed.translations.length : null,
    detectedCount: Array.isArray(parsed?.detectedSourceLocales) ? parsed.detectedSourceLocales.length : null,
  });
  return response;
};

liveTest("real provider: short visible-message batch", async () => {
  const result = await translateChatTextBatch({ messages: ["Bonne course", "Ah ça va être pour Tiana", "Aie je fais 32eme"], targetLocale: "en", fetcher: inspectedFetch });
  expect(result).toHaveLength(3);
  expect(result.every((item) => item.translatedText.trim().length > 0)).toBe(true);
}, 15_000);

liveTest("real provider: preserve messages already in the target language", async () => {
  const result = await translateChatTextBatch({ messages: ["Bonjour", "Bonne course !"], targetLocale: "fr", fetcher: inspectedFetch });
  expect(result).toHaveLength(2);
  expect(result[0].detectedSourceLocale).toBe("fr");
  expect(result[0].translatedText).toBe("Bonjour");
}, 15_000);
