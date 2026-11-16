import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { parseRiderPersonalityKey, RIDER_PERSONALITIES } from "./rider-personalities";

describe("catalogue de caractères", () => {
  it("attribue les mêmes 25 caractères dans la génération et les trois tables", () => {
    const migration = readFileSync(
      "supabase/migrations/20261117090000_add_rider_personalities.sql",
      "utf8",
    );
    const keys = Object.keys(RIDER_PERSONALITIES);
    expect(keys).toHaveLength(25);
    const assigned = migration.match(/select\s*\(array\[([\s\S]*?)\]\)/)?.[1];
    const readKeys = (value: string) => [...value.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
    expect(readKeys(assigned ?? "")).toEqual(keys);
    expect(migration).toMatch(/%\s*25\)/);

    const constraints = [...migration.matchAll(/constraint \w+_personality_allowed check \(personality_key in \(([\s\S]*?)\)\)/g)];
    expect(constraints).toHaveLength(3);
    for (const constraint of constraints) {
      expect(readKeys(constraint[1])).toEqual(keys);
    }
  });

  it("restitue chaque caractère connu tout en tolérant les anciennes simulations", () => {
    for (const key of Object.keys(RIDER_PERSONALITIES)) {
      expect(parseRiderPersonalityKey(key)).toBe(key);
    }
    expect(parseRiderPersonalityKey(undefined)).toBeNull();
    expect(parseRiderPersonalityKey("obsolete")).toBeNull();
  });
});
