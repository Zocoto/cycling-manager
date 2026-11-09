import "server-only";

import { z } from "zod";
import {
  isNationalChampionshipRoadPreset,
  NATIONAL_CHAMPIONSHIP_ROAD_PRESETS,
  type NationalChampionshipRouteChoice,
} from "@/lib/game/national-championship-road-route";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

const presetKey = z.custom<NationalChampionshipRouteChoice["currentPreset"]>(isNationalChampionshipRoadPreset);
const routeSegment = z.tuple([
  z.number().positive(),
  z.enum(["flat", "climb", "descent"]),
  z.enum(["asphalt", "cobbles"]),
  z.number(),
]);
const routeChoiceSchema = z.object({
  countryCode: z.string().regex(/^[a-z]{2}$/),
  targetGameYear: z.number().int().min(2),
  currentPreset: presetKey,
  nextPreset: presetKey.nullable(),
  opensOn: z.iso.date(),
  closesOn: z.iso.date(),
  window: z.enum(["upcoming", "open", "closed"]),
  viewerIsPresident: z.boolean(),
  presets: z.record(z.string(), z.array(routeSegment).min(1)),
});

export async function getNationalChampionshipRouteChoice(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  countryCode: string,
): Promise<NationalChampionshipRouteChoice | null> {
  const result = await supabase.rpc("get_national_championship_road_choice", {
    p_country_code: countryCode,
  });
  if (result.error) {
    console.warn("National championship route choice unavailable:", result.error.message);
    return null;
  }
  const parsed = routeChoiceSchema.safeParse(result.data);
  if (!parsed.success) return null;

  const keys = Object.keys(NATIONAL_CHAMPIONSHIP_ROAD_PRESETS);
  if (keys.some((key) => !parsed.data.presets[key])) return null;
  const presets = Object.fromEntries(keys.map((key) => [
    key,
    parsed.data.presets[key].map(([distanceKm, terrain, surface, averageGradientPct], index) => ({
      segmentNumber: index + 1,
      distanceKm,
      terrain,
      surface,
      averageGradientPct,
      prime: null,
    })),
  ])) as NationalChampionshipRouteChoice["presets"];

  return { ...parsed.data, presets };
}
