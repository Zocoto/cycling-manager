import "server-only";
import sharp from "sharp";
import { CHAT_IMAGE_MAX_EDGE, CHAT_IMAGE_MAX_PIXELS, CHAT_IMAGE_STORED_MAX_BYTES, CHAT_IMAGE_UPLOAD_MAX_BYTES, validateChatImage } from "@/lib/game/chat-images";

export async function processChatImage(file: File) {
  const invalid = validateChatImage(file, CHAT_IMAGE_UPLOAD_MAX_BYTES);
  if (invalid) throw new Error(invalid);
  const input = Buffer.from(await file.arrayBuffer());
  const png = input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = input[0] === 255 && input[1] === 216 && input[2] === 255;
  const webp = input.toString("ascii", 0, 4) === "RIFF" && input.toString("ascii", 8, 12) === "WEBP";
  if (!png && !jpeg && !webp) throw new Error("Le contenu du fichier n’est pas une image PNG, JPEG ou WebP.");
  const decoder = sharp(input, { limitInputPixels: CHAT_IMAGE_MAX_PIXELS, failOn: "warning" }).timeout({ seconds: 5 });
  const metadata = await decoder.metadata();
  if (!["png", "jpeg", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) throw new Error("Seules les images fixes PNG, JPEG et WebP sont acceptées.");
  // Decode real bytes, strip EXIF/GPS, apply orientation and bound both file and display size.
  const { data, info } = await decoder.rotate().resize({ width: CHAT_IMAGE_MAX_EDGE, height: CHAT_IMAGE_MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 84, effort: 3 }).toBuffer({ resolveWithObject: true });
  if (data.length > CHAT_IMAGE_STORED_MAX_BYTES) throw new Error("L’image reste trop volumineuse. Essayez une capture plus petite.");
  return { data, width: info.width, height: info.height };
}
