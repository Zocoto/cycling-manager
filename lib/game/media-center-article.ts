import { CHAT_IMAGE_MAX_EDGE } from "./chat-images";
import { isMediaCenterImageSrc, type MediaCenterImageUpload } from "./media-center-images";

export const MEDIA_CENTER_MIN_BODY_LENGTH = 40;
export const MEDIA_CENTER_MAX_BODY_LENGTH = 6_000;
export const MEDIA_CENTER_MAX_BLOCKS = 20;
export const MEDIA_CENTER_MAX_IMAGES = 4;
export const MEDIA_CENTER_MAX_ALT_LENGTH = 160;
export const MEDIA_CENTER_MAX_CAPTION_LENGTH = 200;

export const MEDIA_CENTER_ARTICLE_FONTS = {
  default: { label: "Gazette", family: "inherit" },
  serif: { label: "Classique", family: 'Georgia, "Times New Roman", serif' },
  sans: { label: "Moderne", family: "var(--font-geist-sans), Arial, sans-serif" },
  mono: { label: "Machine à écrire", family: "var(--font-geist-mono), monospace" },
} as const;

export type MediaCenterArticleFont = keyof typeof MEDIA_CENTER_ARTICLE_FONTS;
export type MediaCenterArticleTextRun = { text: string; bold?: boolean; italic?: boolean };
export type MediaCenterArticleTextBlock = {
  type: "text";
  font: MediaCenterArticleFont;
  content: MediaCenterArticleTextRun[];
};
export type MediaCenterArticleImage = MediaCenterImageUpload;
export type MediaCenterArticleImageBlock = MediaCenterArticleImage & {
  type: "image";
  alt: string;
  caption?: string;
  align: "left" | "center" | "right" | "wide";
};
export type MediaCenterArticleBlock = MediaCenterArticleTextBlock | MediaCenterArticleImageBlock;
export type MediaCenterArticleActionState = { error: string | null };

const ALIGNMENTS = new Set(["left", "center", "right", "wide"]);

export function getMediaCenterArticlePlainText(blocks: readonly MediaCenterArticleBlock[]) {
  return blocks
    .flatMap((block) => block.type === "text" ? [block.content.map(({ text }) => text).join("").trim()] : [])
    .filter(Boolean)
    .join("\n\n");
}

export function parseMediaCenterArticleBlocks(value: unknown): MediaCenterArticleBlock[] | null {
  if (!Array.isArray(value) || value.length > MEDIA_CENTER_MAX_BLOCKS) return null;

  const blocks: MediaCenterArticleBlock[] = [];
  const images = new Set<string>();
  let textLength = 0;
  for (const block of value) {
    if (!isRecord(block)) return null;
    if (block.type === "text") {
      if (typeof block.font !== "string" || !Object.hasOwn(MEDIA_CENTER_ARTICLE_FONTS, block.font)) return null;
      if (!Array.isArray(block.content) || block.content.length > 240) return null;

      const content: MediaCenterArticleTextRun[] = [];
      for (const run of block.content) {
        if (!isRecord(run) || typeof run.text !== "string"
          || (run.bold !== undefined && typeof run.bold !== "boolean")
          || (run.italic !== undefined && typeof run.italic !== "boolean")) return null;

        textLength += run.text.length;
        if (textLength > MEDIA_CENTER_MAX_BODY_LENGTH) return null;
        content.push({ text: run.text, ...(run.bold && { bold: true }), ...(run.italic && { italic: true }) });
      }
      blocks.push({ type: "text", font: block.font as MediaCenterArticleFont, content });
      continue;
    }

    if (block.type !== "image"
      || !isMediaCenterImageSrc(block.src)
      || typeof block.assetId !== "string"
      || !block.src.endsWith("/" + block.assetId + ".webp")
      || typeof block.width !== "number" || !isDimension(block.width)
      || typeof block.height !== "number" || !isDimension(block.height)
      || typeof block.alt !== "string" || block.alt.length > MEDIA_CENTER_MAX_ALT_LENGTH
      || (block.caption !== undefined && (typeof block.caption !== "string" || block.caption.length > MEDIA_CENTER_MAX_CAPTION_LENGTH))
      || typeof block.align !== "string" || !ALIGNMENTS.has(block.align)
      || images.has(block.assetId) || images.size === MEDIA_CENTER_MAX_IMAGES) return null;

    images.add(block.assetId);
    blocks.push({
      type: "image", assetId: block.assetId, src: block.src,
      width: block.width, height: block.height, alt: block.alt,
      ...(block.caption?.trim() && { caption: block.caption.trim() }),
      align: block.align as MediaCenterArticleImageBlock["align"],
    });
  }
  return getMediaCenterArticlePlainText(blocks).length <= MEDIA_CENTER_MAX_BODY_LENGTH ? blocks : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isDimension(value: number) {
  return Number.isInteger(value) && value > 0 && value <= CHAT_IMAGE_MAX_EDGE;
}
