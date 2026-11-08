import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { ImageResponse } from "next/og";
import { cloneElement, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import sharp from "sharp";

import { createRiderAvatarArtwork } from "@/components/game/rider-avatar";
import { getSponsorById } from "@/data/sponsors/catalog-utils";
import { DEFAULT_AMATEUR_JERSEY, isAmateurJerseyPattern, normalizeHexColor } from "@/lib/amateur-team";
import { getAbsoluteUrl } from "@/lib/app-config";
import { isChatImageUuid } from "@/lib/game/chat-images";
import { GLOBAL_CHAT_QUIZ_PORTRAIT_BUCKET } from "@/lib/game/global-chat-quiz";
import { createAmateurRiderJersey, createSponsoredRiderJersey, type RiderJerseyAppearance } from "@/lib/rider-jersey";

const PORTRAIT_SIZE = 256;
const MAX_PORTRAIT_BYTES = 30_000;

type QuizRiderTeam = {
  team_id: string;
  team: {
    amateur_jersey_pattern: string | null;
    amateur_jersey_primary_color: string | null;
    amateur_jersey_secondary_color: string | null;
    amateur_jersey_accent_color: string | null;
  };
};

type QuizSponsorContract = {
  selected_jersey_id: string | null;
  sponsor: { catalog_key: string } | null;
};

export type GlobalChatQuizPortraitRound = {
  id: string;
  riderId: string;
  avatarProfileKey: string | null;
  avatarSeed: string | number | null;
  age: number;
};

// ImageResponse serializes native SVG tags directly, including their children.
// Flatten the JSX fragments produced by the shared avatar's drawing helpers.
function svgChildren(node: ReactNode): ReactNode[] {
  if (node == null || typeof node === "boolean") return [];
  if (Array.isArray(node)) return node.flatMap(svgChildren);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [node];
  if (node.type === Fragment) return svgChildren(node.props.children);
  if (typeof node.type !== "string") throw new Error("Quiz portrait artwork must be static SVG.");
  return [staticSvg(node)];
}

function staticSvg(element: ReactElement<{ children?: ReactNode }>) {
  return cloneElement(element, undefined, svgChildren(element.props.children));
}

async function loadQuizRiderJersey(admin: Pick<SupabaseClient, "from">, riderId: string): Promise<RiderJerseyAppearance> {
  const { data: contract, error: contractError } = await admin.from("rider_contracts")
    .select("team_id, team:teams!inner(amateur_jersey_pattern, amateur_jersey_primary_color, amateur_jersey_secondary_color, amateur_jersey_accent_color)")
    .eq("rider_id", riderId)
    .eq("status", "active")
    .abortSignal(AbortSignal.timeout(4_000))
    .maybeSingle<QuizRiderTeam>();
  if (contractError || !contract?.team) throw new Error("The quiz rider's active team is unavailable.");

  const { data: agreement, error: agreementError } = await admin.from("team_sponsor_contracts")
    .select("selected_jersey_id, sponsor:sponsors(catalog_key)")
    .eq("team_id", contract.team_id)
    .eq("role", "principal")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .abortSignal(AbortSignal.timeout(4_000))
    .maybeSingle<QuizSponsorContract>();
  if (agreementError) throw new Error("The quiz rider's sponsor is unavailable.");

  const sponsor = agreement?.sponsor ? getSponsorById(agreement.sponsor.catalog_key) : undefined;
  const selected = sponsor?.jerseys.find(variant => variant.id === agreement?.selected_jersey_id);
  if (sponsor && selected) {
    const jersey = createSponsoredRiderJersey({ colors: sponsor.colors, style: selected.style });
    try {
      const response = await fetch(getAbsoluteUrl(selected.imagePath), {
        redirect: "error",
        signal: AbortSignal.timeout(4_000),
      });
      if (!response.ok) throw new Error("Sponsor artwork unavailable.");
      // SVG rasterization needs self-contained artwork rather than a browser URL.
      const image = await sharp(Buffer.from(await response.arrayBuffer())).png().toBuffer();
      return { ...jersey, imagePath: `data:image/png;base64,${image.toString("base64")}` };
    } catch {
      console.warn("global_chat_quiz_sponsor_artwork_unavailable");
      return jersey;
    }
  }

  const team = contract.team;
  const pattern = team.amateur_jersey_pattern ?? DEFAULT_AMATEUR_JERSEY.pattern;
  return createAmateurRiderJersey({
    pattern: isAmateurJerseyPattern(pattern) ? pattern : DEFAULT_AMATEUR_JERSEY.pattern,
    primaryColor: normalizeHexColor(team.amateur_jersey_primary_color ?? "") ?? DEFAULT_AMATEUR_JERSEY.primaryColor,
    secondaryColor: normalizeHexColor(team.amateur_jersey_secondary_color ?? "") ?? DEFAULT_AMATEUR_JERSEY.secondaryColor,
    accentColor: normalizeHexColor(team.amateur_jersey_accent_color ?? "") ?? DEFAULT_AMATEUR_JERSEY.accentColor,
  });
}

export async function prepareGlobalChatQuizPortrait(
  admin: Pick<SupabaseClient, "storage" | "from">,
  round: GlobalChatQuizPortraitRound,
): Promise<string> {
  if (!isChatImageUuid(round.id) || round.id.toLowerCase() === round.riderId.toLowerCase()) {
    throw new Error("Invalid quiz portrait round identifier.");
  }
  if (typeof round.avatarSeed === "number" && !Number.isSafeInteger(round.avatarSeed)) {
    throw new Error("Invalid quiz portrait seed.");
  }
  const path = `${round.id.toLowerCase()}.webp`;
  const jersey = await loadQuizRiderJersey(admin, round.riderId);
  const artwork = createRiderAvatarArtwork({
    profileKey: round.avatarProfileKey,
    seed: round.avatarSeed,
    riderId: round.riderId,
    age: round.age,
    size: PORTRAIT_SIZE,
    jersey,
  });
  const raster = new ImageResponse(staticSvg(artwork), { width: PORTRAIT_SIZE, height: PORTRAIT_SIZE });
  const opaque = sharp(Buffer.from(await raster.arrayBuffer())).removeAlpha();
  const lossless = await opaque.clone().webp({ lossless: true, effort: 4 }).toBuffer();
  const image = lossless.length <= MAX_PORTRAIT_BYTES
    ? lossless
    : await opaque.webp({ quality: 80, effort: 4 }).toBuffer();
  if (image.length > MAX_PORTRAIT_BYTES) throw new Error("Quiz portrait exceeds its storage size limit.");

  const bucket = admin.storage.from(GLOBAL_CHAT_QUIZ_PORTRAIT_BUCKET);
  const { error } = await bucket.upload(path, image, {
    cacheControl: "86400",
    contentType: "image/webp",
    upsert: false,
  });
  if (error) {
    // A previous attempt may have saved the immutable object before recording
    // completion, including when the upload response itself was lost.
    const existing = await bucket.exists(path);
    if (existing.error || !existing.data) throw new Error("Quiz portrait upload failed.");
  }
  return path;
}
