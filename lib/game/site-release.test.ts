import { describe, expect, it } from "vitest";
import { siteReleaseUpdateSchema, siteReleaseVersionSchema } from "./site-release";

describe("site version labels", () => {
  it.each(["0.9.1", "1.0.0", "12.34.56", "1.0.0-beta.2", "999999.1.0"])("accepts %s", version => {
    expect(siteReleaseVersionSchema.parse(version)).toBe(version);
  });
  it.each(["", "1", "1.2", "01.2.3", "v1.2.3", "1.2.3<script>", "1.2.3/4", "1000000.1.1", "1.2.3-", "1.2.3-" + "a".repeat(40)])("rejects %s", version => {
    expect(siteReleaseVersionSchema.safeParse(version).success).toBe(false);
  });
  it("trims editable text and rejects invalid revisions and long notes", () => {
    expect(siteReleaseUpdateSchema.parse({ version: " 1.2.3 ", note: "  Un correctif  ", revision: 1 })).toEqual({ version: "1.2.3", note: "Un correctif", revision: 1 });
    for (const revision of [0, -1, 1.5, NaN, 2147483647]) expect(siteReleaseUpdateSchema.safeParse({ version: "1.2.3", note: "", revision }).success).toBe(false);
    expect(siteReleaseUpdateSchema.safeParse({ version: "1.2.3", note: "a".repeat(181), revision: 1 }).success).toBe(false);
  });
});
