import type { Sponsor } from "@/types/sponsor";

import { AFRICAN_SPONSORS } from "./africa";
import { BELGIAN_SPONSORS } from "./belgium";
import { FRENCH_SPONSORS } from "./france";
import { GREEK_SPONSORS } from "./greece";
import { ITALIAN_SPONSORS } from "./italy";
import { DUTCH_SPONSORS } from "./netherlands";
import { SPANISH_SPONSORS } from "./spain";

export const SPONSORS = [
  ...FRENCH_SPONSORS,
  ...BELGIAN_SPONSORS,
  ...DUTCH_SPONSORS,
  ...ITALIAN_SPONSORS,
  ...GREEK_SPONSORS,
  ...AFRICAN_SPONSORS,
  ...SPANISH_SPONSORS,
] satisfies readonly Sponsor[];
