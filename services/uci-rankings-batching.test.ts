import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "services/uci-rankings.ts"),
  "utf8",
);

describe("UCI ranking query batching", () => {
  it("never sends the complete ranked rider list through one PostgREST URL", () => {
    expect(source).not.toContain('.in("id", riderIds)');
    expect(source).not.toContain('.in("rider_id", riderIds)');

    const batchedRiderQueries = source.match(
      /collectChunkedPaginatedRows<(?:RiderRow|ContractRow|RiderAgeRow),/g,
    );
    expect(batchedRiderQueries).toHaveLength(3);
  });
});
