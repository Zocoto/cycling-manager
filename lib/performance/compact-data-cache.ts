import "server-only";

import { promisify } from "node:util";
import { constants, gzip, gunzip } from "node:zlib";
import { unstable_cache } from "next/cache";

const zip = promisify(gzip);
const unzip = promisify(gunzip);
const UNIT_BYTES = 8 * 1024;
const MAX_JSON_BYTES = 8 * 1024 * 1024;
const PACKED_KEY = "__cyclostratege_cache_gzip_v1";

type PackedValue = { [PACKED_KEY]: string };
type CacheOptions = { revalidate?: number | false; tags?: string[] };

/**
 * Shared JSON data only: use exactly where unstable_cache was already safe.
 * Keep Next's expiry, invalidation, request context and argument isolation.
 * Compact a large result only when its stored JSON uses fewer 8 KiB units.
 * Small values remain unchanged; compression runs off the JS event loop.
 */
export function compactDataCache<Args extends unknown[], Value>(
  load: (...args: Args) => Promise<Value>,
  keyParts: string[],
  options: CacheOptions = {},
): (...args: Args) => Promise<Value> {
  const cached = unstable_cache(
    async (...args: Args): Promise<Value | PackedValue> => {
      const value = await load(...args);
      const json = JSON.stringify(value);
      if (json === undefined) return value;
      const originalBytes = Buffer.byteLength(json);
      if (originalBytes <= UNIT_BYTES || originalBytes > MAX_JSON_BYTES) {
        return value;
      }

      const compressed = await zip(json, { level: constants.Z_BEST_SPEED });
      const packed = { [PACKED_KEY]: compressed.toString("base64") };
      const packedBytes = Buffer.byteLength(JSON.stringify(packed));
      return Math.ceil(packedBytes / UNIT_BYTES) < Math.ceil(originalBytes / UNIT_BYTES)
        ? packed
        : value;
    },
    // The wrapper has a common source, so retain the original loader's identity.
    // A new namespace prevents old, uncompressed entries from shadowing savings.
    ["compact-json-v1", load.toString(), ...keyParts],
    options,
  );

  return async (...args: Args): Promise<Value> => {
    const stored = await cached(...args);
    if (!isPackedValue(stored)) return stored as Value;
    const json = await unzip(Buffer.from(stored[PACKED_KEY], "base64"), {
      maxOutputLength: MAX_JSON_BYTES,
    });
    return JSON.parse(json.toString("utf8")) as Value;
  };
}

function isPackedValue(value: unknown): value is PackedValue {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === 1
    && typeof (value as Record<string, unknown>)[PACKED_KEY] === "string";
}
