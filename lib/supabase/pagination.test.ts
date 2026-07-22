import { describe, expect, it, vi } from "vitest";

import { chunkValues, collectPaginatedRows } from "./pagination";

describe("chunkValues", () => {
  it("limite la taille des filtres transmis à Supabase", () => {
    expect(chunkValues([1, 2, 3, 4, 5], 2)).toEqual([
      [1, 2],
      [3, 4],
      [5],
    ]);
  });
});

describe("collectPaginatedRows", () => {
  it("charge toutes les pages au-delà de la limite Supabase de 1 000 lignes", async () => {
    const source = Array.from({ length: 2_405 }, (_, index) => index + 1);
    const fetchPage = vi.fn(async (from: number, to: number) => ({
      data: source.slice(from, to + 1),
      error: null,
    }));

    const result = await collectPaginatedRows({ fetchPage });

    expect(result).toEqual({ data: source, error: null });
    expect(fetchPage.mock.calls).toEqual([
      [0, 999],
      [1_000, 1_999],
      [2_000, 2_999],
    ]);
  });

  it("ne renvoie jamais un résultat partiel lorsqu’une page échoue", async () => {
    const error = { message: "indisponible" };
    const result = await collectPaginatedRows<number, typeof error>({
      pageSize: 2,
      fetchPage: async (from) =>
        from === 0
          ? { data: [1, 2], error: null }
          : { data: null, error },
    });

    expect(result).toEqual({ data: [], error });
  });

  it("refuse une taille de page invalide", async () => {
    await expect(
      collectPaginatedRows({
        pageSize: 0,
        fetchPage: async () => ({ data: [], error: null }),
      })
    ).rejects.toThrow("strictement positif");
  });
});
