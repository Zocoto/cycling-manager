import type { Sponsor } from "@/types/sponsor";

import { AFRICAN_SPONSORS } from "./africa";
import { BALTIC_SPONSORS } from "./baltics";
import { BELGIAN_SPONSORS } from "./belgium";
import { FRENCH_SPONSORS } from "./france";
import { GREEK_SPONSORS } from "./greece";
import { ITALIAN_SPONSORS } from "./italy";
import { JAPANESE_SPONSORS } from "./japan";
import { DUTCH_SPONSORS } from "./netherlands";
import { PORTUGUESE_SPONSORS } from "./portugal";
import { SPANISH_SPONSORS } from "./spain";
import { AMERICAN_SPONSORS } from "./united-states";

export const SPONSORS = [
  ...FRENCH_SPONSORS,
  ...BELGIAN_SPONSORS,
  ...DUTCH_SPONSORS,
  ...ITALIAN_SPONSORS,
  ...GREEK_SPONSORS,
  ...AFRICAN_SPONSORS,
  ...BALTIC_SPONSORS,
  ...SPANISH_SPONSORS,
  ...PORTUGUESE_SPONSORS,
  ...AMERICAN_SPONSORS,
  ...JAPANESE_SPONSORS,
] satisfies readonly Sponsor[];
