import { SPONSORS } from "@/data/sponsors";
import type { Sponsor } from "@/types/sponsor";

const libraryByKey = new Map<string, Sponsor>(SPONSORS.map(sponsor => [`library-${sponsor.id}`, sponsor]));

/** Legacy agreements keep their historical identity; new ones reuse the sponsor library. */
export function getSecondarySponsorLibraryBrand(catalogKey: string | null | undefined): Sponsor | null {
  return catalogKey ? libraryByKey.get(catalogKey) ?? null : null;
}
