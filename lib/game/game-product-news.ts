import { z } from "zod";
import type { AppLocale } from "@/lib/i18n/config";

export type GameStaffRole = "owner" | "game_staff" | null;
export const GAME_NEWS_CACHE_TAG = "game-product-news";
export const GAME_STAFF_CACHE_TAG = "game-staff-directory";

export function isSafeNewsLink(value: string): boolean {
  if (!value || /[\u0000-\u0020\u007f\\]/u.test(value)) return false;
  if (value.startsWith("/") && !value.startsWith("//") && !/^\/(%2f|%5c)/iu.test(value)) return true;
  try { return /^https:\/\/[A-Za-z0-9]/u.test(value) && new URL(value).protocol === "https:"; } catch { return false; }
}

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");
export const gameNewsDocumentSchema = z.object({
  title: z.string().trim().min(5).max(160),
  category: z.string().trim().min(2).max(60),
  summary: z.string().trim().min(10).max(500),
  body: z.string().trim().min(10).max(30_000),
  title_en: optionalText(160).refine((value) => !value || value.length >= 5), category_en: optionalText(60).refine((value) => !value || value.length >= 2),
  summary_en: optionalText(500).refine((value) => !value || value.length >= 10), body_en: optionalText(30_000).refine((value) => !value || value.length >= 10),
  image_path: optionalText(250).refine((value) => !value || /^\/images\/[A-Za-z0-9/_\-.]+$/u.test(value) && !value.includes("..") && !value.includes("//")),
  image_alt: optionalText(180),
  link_url: optionalText(500).refine((value) => !value || isSafeNewsLink(value)),
  link_label: optionalText(80),
}).strict();
export type GameNewsDocument = z.infer<typeof gameNewsDocumentSchema>;
export const gameNewsDraftDocumentSchema = gameNewsDocumentSchema.extend({
  title: z.string().trim().max(160), category: z.string().trim().max(60),
  summary: z.string().trim().max(500), body: z.string().trim().max(30_000),
  title_en: optionalText(160), category_en: optionalText(60), summary_en: optionalText(500), body_en: optionalText(30_000),
});
export type PublishedGameNews = {
  id: string; document: GameNewsDocument; publishedAt: string; updatedAt: string; revision: number;
};
export type GameNewsEditorArticle = {
  id: string; draft: GameNewsDocument; published: GameNewsDocument | null;
  publishedAt: string | null; updatedAt: string; revision: number; hasUnpublishedChanges: boolean;
};
export type GameNewsEditorState = {
  status: "idle" | "success" | "error" | "conflict";
  message: string | null;
  article?: GameNewsEditorArticle;
};
export type GameStaffMember = { userId: string; directorId: string; displayName: string; role: Exclude<GameStaffRole, null> };
export type GameStaffCandidate = { userId: string; directorId: string; displayName: string; username: string };
export type GameStaffActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
  candidates?: GameStaffCandidate[];
  members?: GameStaffMember[];
};

export const EMPTY_GAME_NEWS_DOCUMENT: GameNewsDocument = {
  title: "", category: "Nouveauté", summary: "", body: "", title_en: "", category_en: "",
  summary_en: "", body_en: "", image_path: "", image_alt: "", link_url: "", link_label: "",
};
export const GAME_NEWS_IMAGES = [
  { path: "/images/gala/gala-s4-announcement.svg", label: "Le Grand Gala · Saison 4" },
  { path: "/images/peloton-header.webp", label: "Le peloton" },
  { path: "/images/infrastructure/training-center.webp", label: "Les infrastructures" },
  { path: "/images/game-workspace-escape.webp", label: "La route" },
] as const;

export const GAME_NEWS_EMOJIS = [
  { code: "loudspeaker", emoji: "📣", label: "Annonce" },
  { code: "tada", emoji: "🎉", label: "Nouveauté" },
  { code: "warning", emoji: "⚠️", label: "Attention" },
  { code: "white_check_mark", emoji: "✅", label: "Correction" },
  { code: "tools", emoji: "🛠️", label: "Maintenance" },
  { code: "rocket", emoji: "🚀", label: "Lancement" },
  { code: "bulb", emoji: "💡", label: "Astuce" },
  { code: "calendar", emoji: "📅", label: "Calendrier" },
  { code: "bicyclist", emoji: "🚴", label: "Cyclisme" },
  { code: "trophy", emoji: "🏆", label: "Compétition" },
  { code: "gift", emoji: "🎁", label: "Cadeau" },
  { code: "pumpkin", emoji: "🎃", label: "Halloween" },
] as const;

export function replaceNewsEmojiShortcodes(text: string): string {
  const emojis = new Map<string, string>(GAME_NEWS_EMOJIS.map((item) => [item.code, item.emoji]));
  return text.replace(/:([a-z_]+):/giu, (match, code: string) => emojis.get(code.toLowerCase()) ?? match);
}

export function localizeGameNews(document: GameNewsDocument, locale: AppLocale) {
  return {
    title: locale === "en" && document.title_en ? document.title_en : document.title,
    category: locale === "en" && document.category_en ? document.category_en : document.category,
    summary: locale === "en" && document.summary_en ? document.summary_en : document.summary,
    body: locale === "en" && document.body_en ? document.body_en : document.body,
  };
}
