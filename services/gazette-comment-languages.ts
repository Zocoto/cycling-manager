import "server-only";
import { createHash } from "node:crypto";
import { detectAll } from "tinyld";
import { splitChatMessageForTranslation } from "@/lib/game/chat-translation";
import { getGazetteCommentSources, type GazetteCommentLanguageHints } from "@/lib/game/gazette-comment-translation";
import type { CyclogazetteContent } from "@/lib/game/cyclogazette";
const hintCache = new Map<string, GazetteCommentLanguageHints>();

export function detectGazetteCommentLanguage(text: string): string | null {
  const plain = splitChatMessageForTranslation(text).filter(part => part.translate).map(part => part.text).join(" ").trim();
  const greeting = plain.toLowerCase().replace(/[^\p{L}\s']/gu, "").trim();
  if (/^(bonjour|bonsoir|salut|merci|allez)$/u.test(greeting)) return "fr";
  if (/^(hello|hi|thanks|thank you|well done|good luck)$/u.test(greeting)) return "en";
  // These expressions are identical in both interfaces and need no provider.
  if (/^(bravo|ok|super)$/u.test(greeting)) return "und";
  const [best, next] = detectAll(plain);
  return best && best.accuracy >= 0.45 && best.accuracy - (next?.accuracy ?? 0) >= 0.2
    ? best.lang : null;
}

export function getGazetteCommentLanguageHints(content: CyclogazetteContent): GazetteCommentLanguageHints {
  const sources = getGazetteCommentSources(content);
  const fingerprint = createHash("sha256").update(JSON.stringify(sources)).digest("hex");
  const cached = hintCache.get(fingerprint);
  if (cached) return cached;
  const hints = Object.fromEntries(sources.map(source => [
    source.messageId, detectGazetteCommentLanguage(source.sourceMessage),
  ]));
  if (hintCache.size >= 32) hintCache.delete(hintCache.keys().next().value!);
  hintCache.set(fingerprint, hints);
  return hints;
}
