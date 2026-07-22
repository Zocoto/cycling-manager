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
