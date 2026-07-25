type PaginatedPage<T, E> = {
  data: T[] | null;
  error: E | null;
};

type CollectPaginatedRowsInput<T, E> = {
  fetchPage: (from: number, to: number) => Promise<PaginatedPage<T, E>>;
  pageSize?: number;
};

export function chunkValues<T>(values: T[], chunkSize = 100): T[][] {
  if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
    throw new Error("La taille de lot doit être un entier strictement positif.");
  }

  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }

  return chunks;
}

/**
 * Combine le découpage en lots (pour les filtres `.in(...)`) et la pagination
 * (pour dépasser la limite `max_rows` de PostgREST, 1 000 lignes par requête).
 * Sans cela, les requêtes portant sur tout le calendrier sont silencieusement
 * tronquées et produisent des startlists ou des classements incomplets.
 */
export async function collectChunkedPaginatedRows<T, E, V>({
  values,
  fetchPage,
  chunkSize = 100,
  pageSize = 1_000,
}: {
  values: V[];
  fetchPage: (
    chunk: V[],
    from: number,
    to: number
  ) => Promise<PaginatedPage<T, E>>;
  chunkSize?: number;
  pageSize?: number;
}): Promise<{ data: T[]; error: E | null }> {
  if (values.length === 0) {
    return { data: [], error: null };
  }

  const batchResults = await Promise.all(
    chunkValues(values, chunkSize).map((chunk) =>
      collectPaginatedRows<T, E>({
        fetchPage: (from, to) => fetchPage(chunk, from, to),
        pageSize,
      })
    )
  );
  const failedBatch = batchResults.find((result) => result.error);

  return failedBatch
    ? { data: [], error: failedBatch.error }
    : {
        data: batchResults.flatMap((result) => result.data),
        error: null,
      };
}

export async function collectPaginatedRows<T, E>({
  fetchPage,
  pageSize = 1_000,
}: CollectPaginatedRowsInput<T, E>): Promise<{
  data: T[];
  error: E | null;
}> {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error("La taille de page doit être un entier strictement positif.");
  }

  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);

    if (page.error) {
      return { data: [], error: page.error };
    }

    const pageRows = page.data ?? [];
    rows.push(...pageRows);

    if (pageRows.length < pageSize) {
      return { data: rows, error: null };
    }
  }
}
