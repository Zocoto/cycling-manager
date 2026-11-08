import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { ImageResponse } from "next/og";
import { cloneElement, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import sharp from "sharp";

import { createNeutralRiderAvatarArtwork } from "@/components/game/rider-avatar";
import { isChatImageUuid } from "@/lib/game/chat-images";
import { GLOBAL_CHAT_QUIZ_PORTRAIT_BUCKET } from "@/lib/game/global-chat-quiz";

const PORTRAIT_SIZE = 256;
const MAX_PORTRAIT_BYTES = 30_000;

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

export async function prepareGlobalChatQuizPortrait(
  admin: Pick<SupabaseClient, "storage">,
  round: GlobalChatQuizPortraitRound,
): Promise<string> {
  if (!isChatImageUuid(round.id) || round.id.toLowerCase() === round.riderId.toLowerCase()) {
    throw new Error("Invalid quiz portrait round identifier.");
  }
  if (typeof round.avatarSeed === "number" && !Number.isSafeInteger(round.avatarSeed)) {
    throw new Error("Invalid quiz portrait seed.");
  }
  const path = `${round.id.toLowerCase()}.webp`;
  const artwork = createNeutralRiderAvatarArtwork({
    profileKey: round.avatarProfileKey,
    seed: round.avatarSeed,
    riderId: round.riderId,
    age: round.age,
    size: PORTRAIT_SIZE,
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
