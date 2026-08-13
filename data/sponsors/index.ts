import type { Sponsor } from "@/types/sponsor";
import { getSponsorMinimumReputation } from "@/lib/game/sponsor-prestige";

import { AFRICAN_SPONSORS } from "./africa";
import { AUTOMOTIVE_SPONSORS } from "./automotive";
import { BALTIC_SPONSORS } from "./baltics";
import { BANKING_SPONSORS } from "./banking";
import { BELGIAN_SPONSORS } from "./belgium";
import { CONFECTIONERY_SPONSORS } from "./confectionery";
import { CYCLING_PROJECT_SPONSORS } from "./cycling-projects";
import { ENERGY_SPONSORS } from "./energy";
import { FAST_FOOD_SPONSORS } from "./fast-food";
import { FRENCH_SPONSORS } from "./france";
import { GREEK_SPONSORS } from "./greece";
import { ITALIAN_SPONSORS } from "./italy";
import { JAPANESE_SPONSORS } from "./japan";
import { DUTCH_SPONSORS } from "./netherlands";
import { PORTUGUESE_SPONSORS } from "./portugal";
import { POSTAL_SERVICE_SPONSORS } from "./postal-services";
import { SPANISH_SPONSORS } from "./spain";
import { SPIRITS_SPONSORS } from "./spirits";
import { AMERICAN_SPONSORS } from "./united-states";

const RAW_SPONSORS = [
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
  ...CONFECTIONERY_SPONSORS,
  ...ENERGY_SPONSORS,
  ...BANKING_SPONSORS,
  ...FAST_FOOD_SPONSORS,
  ...SPIRITS_SPONSORS,
  ...CYCLING_PROJECT_SPONSORS,
  ...POSTAL_SERVICE_SPONSORS,
  ...AUTOMOTIVE_SPONSORS,
] satisfies readonly Sponsor[];

export const SPONSORS = RAW_SPONSORS.map((sponsor) => ({
  ...sponsor,
  minimumReputation: getSponsorMinimumReputation(sponsor),
})) satisfies readonly Sponsor[];
