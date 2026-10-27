export type ChatGifAttachment = {
  provider: "klipy";
  kind: "gif" | "meme";
  id: string;
  slug: string;
  title: string;
  url: string;
  previewUrl: string;
  width: number;
  height: number;
};

const MEDIA_HOSTS = new Set(["static.klipy.com", "static1.klipy.com", "static2.klipy.com"]);

export function isKlipyMediaUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048 || /[\s<>\u0000-\u001f]/u.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && MEDIA_HOSTS.has(url.hostname) && !url.username && !url.password && !url.port && !url.hash;
  } catch { return false; }
}

export function readChatGifAttachment(value: unknown): ChatGifAttachment | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.provider !== "klipy" || (row.kind !== "gif" && row.kind !== "meme") ||
    typeof row.id !== "string" || !/^[\w-]{1,80}$/.test(row.id) ||
    typeof row.slug !== "string" || !/^[\w-]{1,180}$/.test(row.slug) ||
    typeof row.title !== "string" || !row.title.trim() || row.title.length > 200 ||
    !isKlipyMediaUrl(row.url) || !isKlipyMediaUrl(row.previewUrl) ||
    typeof row.width !== "number" || typeof row.height !== "number" ||
    !Number.isInteger(row.width) || !Number.isInteger(row.height) ||
    row.width < 1 || row.height < 1 || row.width > 2048 || row.height > 2048) return null;
  return { provider: "klipy", kind: row.kind, id: row.id, slug: row.slug, title: row.title,
    url: row.url, previewUrl: row.previewUrl, width: row.width, height: row.height };
}

export function isChatGifOnlyMessage(message: { gif?: ChatGifAttachment | null; message: string }) {
  return Boolean(message.gif && message.message === "GIF joint");
}

/** Preserve provider order, including an unavailable cell for an invalid item. */
export function readKlipyPage(value: unknown, kind: "gif" | "meme") {
  const payload = value as { result?: boolean; data?: { data?: unknown[]; has_next?: boolean } } | null;
  if (payload?.result !== true || !Array.isArray(payload.data?.data)) throw new Error("Les GIF sont momentanément indisponibles.");
  const items = payload.data.data.map((value, index) => {
    const item = value as Record<string, unknown>;
    const file = item?.file as Record<string, Record<string, unknown>> | undefined;
    const formats = kind === "meme" ? ["jpg", "webp", "gif"] : ["gif", "webp"];
    let media: Record<string, unknown> | undefined;
    for (const size of ["md", "sm", "hd", "xs"]) {
      for (const format of formats) {
        const candidate = file?.[size]?.[format] as Record<string, unknown> | undefined;
        if (candidate && isKlipyMediaUrl(candidate.url)) { media = candidate; break; }
      }
      if (media) break;
    }
    const preview = (file?.xs?.jpg ?? file?.sm?.jpg ?? file?.md?.jpg ?? media) as Record<string, unknown> | undefined;
    return { key: `${String(item?.id ?? "unavailable")}-${index}`, media: readChatGifAttachment({
      provider: "klipy", kind, id: String(item?.id ?? ""), slug: item?.slug,
      title: String(item?.title || "GIF").slice(0, 200), url: media?.url, previewUrl: preview?.url,
      width: media?.width, height: media?.height,
    }) };
  });
  return { items, hasNext: payload.data.has_next === true };
}

export function buildKlipySearchUrl(appKey: string, query: string, kind: "gif" | "meme", page: number, customerId: string) {
  const collection = kind === "meme" ? "static-memes" : "gifs";
  const url = new URL(`https://api.klipy.com/api/v1/${encodeURIComponent(appKey)}/${collection}/${query ? "search" : "trending"}`);
  url.search = new URLSearchParams({ page: String(page), per_page: "16", customer_id: customerId,
    locale: "fr", content_filter: "high", format_filter: "gif,webp,jpg", ...(query ? { q: query } : {}) }).toString();
  return url.href;
}

export async function registerKlipyShare(appKey: string, media: ChatGifAttachment, customerId: string) {
  const collection = media.kind === "meme" ? "static-memes" : "gifs";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    await fetch(`https://api.klipy.com/api/v1/${encodeURIComponent(appKey)}/${collection}/share/${encodeURIComponent(media.slug)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer_id: customerId }),
      signal: controller.signal,
    });
  } catch { /* Provider analytics must never prevent sending a chat message. */ }
  finally { clearTimeout(timeout); }
}
