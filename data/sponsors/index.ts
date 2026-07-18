import type { Sponsor } from "@/types/sponsor";

import { BELGIAN_SPONSORS } from "./belgium";
import { FRENCH_SPONSORS } from "./france";
import { SPANISH_SPONSORS } from "./spain";

export const SPONSORS = [
  ...FRENCH_SPONSORS,
  ...BELGIAN_SPONSORS,
  ...SPANISH_SPONSORS,
] satisfies readonly Sponsor[];