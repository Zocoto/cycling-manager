import type { RiderRatingKey } from "@/lib/game/rider-profile";
import type { ScoutedNumericValue } from "@/lib/game/transfer-scouting";

export type RiderQuickPreview = {
  id: string;
  name: string;
  age: number | null;
  country: {
    name: string;
    code: string;
  };
  team: {
    id: string;
    name: string;
  } | null;
  ratings: Record<RiderRatingKey, ScoutedNumericValue> | null;
  ratingVisibility: "exact" | "scouted" | "unavailable";
};

export function getRiderIdFromProfileHref(href: string): string | null {
  const pathname = href.split(/[?#]/, 1)[0].replace(/\/+$/, "");
  const match = pathname.match(/^\/jeu\/coureurs\/([^/]+)$/);

  if (!match) return null;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}
