import { SPONSORS } from "@/data/sponsors";

const libraryByKey = new Map(SPONSORS.map(sponsor => [`library-${sponsor.id}`, sponsor]));

/** Legacy agreements keep their historical identity; new ones reuse the sponsor library. */
export function getSecondarySponsorLibraryBrand(catalogKey: string | null | undefined) {
  return catalogKey ? libraryByKey.get(catalogKey) ?? null : null;
}
