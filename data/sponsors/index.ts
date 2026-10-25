import type { Sponsor } from "@/types/sponsor";
import { getSponsorMinimumReputation } from "@/lib/game/sponsor-prestige";

import { AFRICAN_SPONSORS } from "./africa";
import { ACTIVE_FEDERATION_BATCH_01_SPONSORS } from "./active-federation-batch-01";
import { ACTIVE_TEAM_COUNTRY_BATCH_01_SPONSORS } from "./active-team-country-batch-01";
import { ARGENTINA_MAURITIUS_EXPANSION_SPONSORS } from "./argentina-mauritius-expansion";
import { AUSTRIA_NORTH_KOREA_EXPANSION_SPONSORS } from "./austria-north-korea-expansion";
import { AUTOMOTIVE_SPONSORS } from "./automotive";
import { BALTIC_SPONSORS } from "./baltics";
import { BAHAMIAN_SPONSORS } from "./bahamas";
import { BANKING_SPONSORS } from "./banking";
import { BELGIAN_SPONSORS } from "./belgium";
import { BRETON_SPONSORS } from "./brittany";
import { BRITISH_EXPANSION_SPONSORS } from "./britain-expansion";
import { CONFECTIONERY_SPONSORS } from "./confectionery";
import { COUNTRY_EXPANSION_BATCH_01_SPONSORS } from "./country-expansion-batch-01";
import { COUNTRY_EXPANSION_BATCH_02_SPONSORS } from "./country-expansion-batch-02";
import { COUNTRY_EXPANSION_BATCH_03_SPONSORS } from "./country-expansion-batch-03";
import { COUNTRY_EXPANSION_BATCH_04_SPONSORS } from "./country-expansion-batch-04";
import { COUNTRY_EXPANSION_BATCH_05_SPONSORS } from "./country-expansion-batch-05";
import { COUNTRY_EXPANSION_BATCH_06_SPONSORS } from "./country-expansion-batch-06";
import { COUNTRY_EXPANSION_BATCH_07_SPONSORS } from "./country-expansion-batch-07";
import { COUNTRY_EXPANSION_BATCH_08_SPONSORS } from "./country-expansion-batch-08";
import { COUNTRY_EXPANSION_BATCH_09_SPONSORS } from "./country-expansion-batch-09";
import { COUNTRY_EXPANSION_BATCH_10_SPONSORS } from "./country-expansion-batch-10";
import { COUNTRY_EXPANSION_BATCH_11_SPONSORS } from "./country-expansion-batch-11";
import { COUNTRY_EXPANSION_BATCH_12_SPONSORS } from "./country-expansion-batch-12";
import { COUNTRY_EXPANSION_BATCH_13_SPONSORS } from "./country-expansion-batch-13";
import { CYCLING_PROJECT_SPONSORS } from "./cycling-projects";
import { ENERGY_SPONSORS } from "./energy";
import { ENERGY_DRINK_BATCH_01_SPONSORS } from "./energy-drinks-batch-01";
import { FAST_FOOD_SPONSORS } from "./fast-food";
import { FRENCH_SPONSORS } from "./france";
import { GREEK_SPONSORS } from "./greece";
import { ITALIAN_BRANDS_EXPANSION_SPONSORS } from "./italian-brands-expansion";
import { ITALIAN_SPONSORS } from "./italy";
import { JAPANESE_SPONSORS } from "./japan";
import { DUTCH_SPONSORS } from "./netherlands";
import { PORTUGUESE_SPONSORS } from "./portugal";
import { POSTAL_SERVICE_SPONSORS } from "./postal-services";
import { PRIORITY_PARTNERSHIP_BATCH_01_SPONSORS } from "./priority-partnership-batch-01";
import { VIETNAM_PRIORITY_BATCH_01_SPONSORS } from "./vietnam-priority-batch-01";
import { SPANISH_SPONSORS } from "./spain";
import { SPIRITS_SPONSORS } from "./spirits";
import { SPORTING_NATION_PRESTIGE_BATCH_01_SPONSORS } from "./sporting-nation-prestige-batch-01";
import { SPORTSWEAR_BATCH_01_SPONSORS } from "./sportswear-batch-01";
import { AIRLINE_SPONSORS, TOURISM_SPONSORS } from "./tourism-airlines";
import { UNDERCOVERED_COUNTRY_BATCH_02_SPONSORS } from "./undercovered-country-batch-02";
import { UNDERCOVERED_COUNTRY_BATCH_03_SPONSORS } from "./undercovered-country-batch-03";
import { UNDERCOVERED_COUNTRY_BATCH_04_SPONSORS } from "./undercovered-country-batch-04";
import { UNDERCOVERED_COUNTRY_BATCH_05_SPONSORS } from "./undercovered-country-batch-05";
import { UNDERCOVERED_COUNTRY_BATCH_06_SPONSORS } from "./undercovered-country-batch-06";
import { UNDERCOVERED_COUNTRY_BATCH_07_SPONSORS } from "./undercovered-country-batch-07";
import { UNDERCOVERED_COUNTRY_BATCH_08_SPONSORS } from "./undercovered-country-batch-08";
import { UNDERCOVERED_COUNTRY_BATCH_09_SPONSORS } from "./undercovered-country-batch-09";
import { UNDERCOVERED_COUNTRY_BATCH_10_SPONSORS } from "./undercovered-country-batch-10";
import { UNDERCOVERED_VIVID_BATCH_11_SPONSORS } from "./undercovered-vivid-batch-11";
import { UNDERCOVERED_BRAND_BATCH_12_SPONSORS } from "./undercovered-brand-batch-12";
import { UNDERCOVERED_BRAND_BATCH_13_SPONSORS } from "./undercovered-brand-batch-13";
import { BANK_INSURANCE_BATCH_14_SPONSORS } from "./bank-insurance-batch-14";
import { MINING_BATCH_15_SPONSORS } from "./mining-batch-15";
import { CHARITY_BATCH_16_SPONSORS } from "./charity-batch-16";
import { ENERGY_INDUSTRY_BATCH_17_SPONSORS } from "./energy-industry-batch-17";
import { COMMON_INDUSTRIES_BATCH_18_SPONSORS } from "./common-industries-batch-18";
import { FOOD_PRODUCTS_BATCH_19_SPONSORS } from "./food-products-batch-19";
import { AMERICAN_SPONSORS } from "./united-states";
import { AMERICAN_EXPANSION_BATCH_02_SPONSORS } from "./united-states-batch-02";
import { WELLNESS_HYGIENE_SPONSORS } from "./wellness-hygiene";

const RAW_SPONSORS = [
  ...ACTIVE_FEDERATION_BATCH_01_SPONSORS,
  ...ACTIVE_TEAM_COUNTRY_BATCH_01_SPONSORS,
  ...ARGENTINA_MAURITIUS_EXPANSION_SPONSORS,
  ...AUSTRIA_NORTH_KOREA_EXPANSION_SPONSORS,
  ...BAHAMIAN_SPONSORS,
  ...BRITISH_EXPANSION_SPONSORS,
  ...FRENCH_SPONSORS,
  ...BRETON_SPONSORS,
  ...BELGIAN_SPONSORS,
  ...DUTCH_SPONSORS,
  ...ITALIAN_BRANDS_EXPANSION_SPONSORS,
  ...ITALIAN_SPONSORS,
  ...GREEK_SPONSORS,
  ...AFRICAN_SPONSORS,
  ...BALTIC_SPONSORS,
  ...SPANISH_SPONSORS,
  ...PORTUGUESE_SPONSORS,
  ...AMERICAN_SPONSORS,
  ...AMERICAN_EXPANSION_BATCH_02_SPONSORS,
  ...JAPANESE_SPONSORS,
  ...COUNTRY_EXPANSION_BATCH_01_SPONSORS,
  ...COUNTRY_EXPANSION_BATCH_02_SPONSORS,
  ...COUNTRY_EXPANSION_BATCH_03_SPONSORS,
  ...COUNTRY_EXPANSION_BATCH_04_SPONSORS,
  ...COUNTRY_EXPANSION_BATCH_05_SPONSORS,
  ...COUNTRY_EXPANSION_BATCH_06_SPONSORS,
  ...COUNTRY_EXPANSION_BATCH_07_SPONSORS,
  ...COUNTRY_EXPANSION_BATCH_08_SPONSORS,
  ...COUNTRY_EXPANSION_BATCH_09_SPONSORS,
  ...COUNTRY_EXPANSION_BATCH_10_SPONSORS,
  ...COUNTRY_EXPANSION_BATCH_11_SPONSORS,
  ...COUNTRY_EXPANSION_BATCH_12_SPONSORS,
  ...COUNTRY_EXPANSION_BATCH_13_SPONSORS,
  ...CONFECTIONERY_SPONSORS,
  ...ENERGY_SPONSORS,
  ...ENERGY_DRINK_BATCH_01_SPONSORS,
  ...BANKING_SPONSORS,
  ...FAST_FOOD_SPONSORS,
  ...SPIRITS_SPONSORS,
  ...SPORTING_NATION_PRESTIGE_BATCH_01_SPONSORS,
  ...SPORTSWEAR_BATCH_01_SPONSORS,
  ...CYCLING_PROJECT_SPONSORS,
  ...POSTAL_SERVICE_SPONSORS,
  ...PRIORITY_PARTNERSHIP_BATCH_01_SPONSORS,
  ...VIETNAM_PRIORITY_BATCH_01_SPONSORS,
  ...AUTOMOTIVE_SPONSORS,
  ...WELLNESS_HYGIENE_SPONSORS,
  ...TOURISM_SPONSORS,
  ...AIRLINE_SPONSORS,
  ...UNDERCOVERED_COUNTRY_BATCH_02_SPONSORS,
  ...UNDERCOVERED_COUNTRY_BATCH_03_SPONSORS,
  ...UNDERCOVERED_COUNTRY_BATCH_04_SPONSORS,
  ...UNDERCOVERED_COUNTRY_BATCH_05_SPONSORS,
  ...UNDERCOVERED_COUNTRY_BATCH_06_SPONSORS,
  ...UNDERCOVERED_COUNTRY_BATCH_07_SPONSORS,
  ...UNDERCOVERED_COUNTRY_BATCH_08_SPONSORS,
  ...UNDERCOVERED_COUNTRY_BATCH_09_SPONSORS,
  ...UNDERCOVERED_COUNTRY_BATCH_10_SPONSORS,
  ...UNDERCOVERED_VIVID_BATCH_11_SPONSORS,
  ...UNDERCOVERED_BRAND_BATCH_12_SPONSORS,
  ...UNDERCOVERED_BRAND_BATCH_13_SPONSORS,
  ...BANK_INSURANCE_BATCH_14_SPONSORS,
  ...MINING_BATCH_15_SPONSORS,
  ...CHARITY_BATCH_16_SPONSORS,
  ...ENERGY_INDUSTRY_BATCH_17_SPONSORS,
  ...COMMON_INDUSTRIES_BATCH_18_SPONSORS,
  ...FOOD_PRODUCTS_BATCH_19_SPONSORS,
] satisfies readonly Sponsor[];

export const SPONSORS = RAW_SPONSORS.map((sponsor) => ({
  ...sponsor,
  minimumReputation: getSponsorMinimumReputation(sponsor),
})) satisfies readonly Sponsor[];
