// Calendrier interne issu de la page Wikipédia « Liste de fêtes nationales ».
// Capture fonctionnelle validée le 26 août 2026 : aucune dépendance réseau à l'exécution.

export const NATIONAL_DAY_BONUS_RIDER_COUNT = 5;
export const NATIONAL_DAY_CALENDAR_SOURCE_URL =
  "https://fr.wikipedia.org/wiki/Liste_de_f%C3%AAtes_nationales";

export type NationalDayCalendarEntry = {
  isoAlpha2: string;
  month: number;
  day: number;
};

export const NATIONAL_DAY_CALENDAR = [
  { isoAlpha2: "AD", month: 9, day: 8 },
  { isoAlpha2: "AE", month: 12, day: 2 },
  { isoAlpha2: "AF", month: 8, day: 19 },
  { isoAlpha2: "AG", month: 11, day: 1 },
  { isoAlpha2: "AL", month: 11, day: 28 },
  { isoAlpha2: "AM", month: 9, day: 21 },
  { isoAlpha2: "AO", month: 11, day: 11 },
  { isoAlpha2: "AR", month: 5, day: 25 },
  { isoAlpha2: "AT", month: 10, day: 26 },
  { isoAlpha2: "AU", month: 1, day: 26 },
  { isoAlpha2: "AZ", month: 5, day: 28 },
  { isoAlpha2: "BA", month: 11, day: 21 },
  { isoAlpha2: "BB", month: 11, day: 30 },
  { isoAlpha2: "BD", month: 3, day: 26 },
  { isoAlpha2: "BE", month: 7, day: 21 },
  { isoAlpha2: "BF", month: 12, day: 11 },
  { isoAlpha2: "BG", month: 3, day: 3 },
  { isoAlpha2: "BH", month: 12, day: 16 },
  { isoAlpha2: "BI", month: 7, day: 1 },
  { isoAlpha2: "BJ", month: 8, day: 1 },
  { isoAlpha2: "BN", month: 2, day: 23 },
  { isoAlpha2: "BO", month: 8, day: 6 },
  { isoAlpha2: "BR", month: 9, day: 7 },
  { isoAlpha2: "BS", month: 7, day: 10 },
  { isoAlpha2: "BT", month: 12, day: 17 },
  { isoAlpha2: "BW", month: 9, day: 30 },
  { isoAlpha2: "BY", month: 7, day: 3 },
  { isoAlpha2: "BZ", month: 9, day: 21 },
  { isoAlpha2: "CA", month: 7, day: 1 },
  { isoAlpha2: "CD", month: 6, day: 30 },
  { isoAlpha2: "CF", month: 12, day: 1 },
  { isoAlpha2: "CG", month: 8, day: 15 },
  { isoAlpha2: "CH", month: 8, day: 1 },
  { isoAlpha2: "CI", month: 8, day: 7 },
  { isoAlpha2: "CL", month: 9, day: 18 },
  { isoAlpha2: "CM", month: 5, day: 20 },
  { isoAlpha2: "CN", month: 10, day: 1 },
  { isoAlpha2: "CO", month: 7, day: 20 },
  { isoAlpha2: "CR", month: 9, day: 15 },
  { isoAlpha2: "CU", month: 1, day: 1 },
  { isoAlpha2: "CV", month: 7, day: 5 },
  { isoAlpha2: "CY", month: 10, day: 1 },
  { isoAlpha2: "CZ", month: 10, day: 28 },
  { isoAlpha2: "DE", month: 10, day: 3 },
  { isoAlpha2: "DJ", month: 6, day: 27 },
  { isoAlpha2: "DK", month: 6, day: 5 },
  { isoAlpha2: "DM", month: 11, day: 3 },
  { isoAlpha2: "DO", month: 2, day: 27 },
  { isoAlpha2: "DZ", month: 7, day: 5 },
  { isoAlpha2: "EC", month: 8, day: 10 },
  { isoAlpha2: "EE", month: 2, day: 24 },
  { isoAlpha2: "EG", month: 7, day: 23 },
  { isoAlpha2: "ER", month: 5, day: 24 },
  { isoAlpha2: "ES", month: 10, day: 12 },
  { isoAlpha2: "ET", month: 5, day: 28 },
  { isoAlpha2: "FI", month: 12, day: 6 },
  { isoAlpha2: "FJ", month: 10, day: 10 },
  { isoAlpha2: "FM", month: 11, day: 3 },
  { isoAlpha2: "FR", month: 7, day: 14 },
  { isoAlpha2: "GA", month: 8, day: 17 },
  { isoAlpha2: "GD", month: 2, day: 7 },
  { isoAlpha2: "GE", month: 5, day: 26 },
  { isoAlpha2: "GH", month: 3, day: 6 },
  { isoAlpha2: "GM", month: 2, day: 18 },
  { isoAlpha2: "GN", month: 10, day: 2 },
  { isoAlpha2: "GQ", month: 10, day: 12 },
  { isoAlpha2: "GR", month: 3, day: 25 },
  { isoAlpha2: "GT", month: 9, day: 15 },
  { isoAlpha2: "GW", month: 9, day: 24 },
  { isoAlpha2: "GY", month: 5, day: 26 },
  { isoAlpha2: "HN", month: 9, day: 15 },
  { isoAlpha2: "HR", month: 5, day: 30 },
  { isoAlpha2: "HT", month: 1, day: 1 },
  { isoAlpha2: "HU", month: 8, day: 20 },
  { isoAlpha2: "ID", month: 8, day: 17 },
  { isoAlpha2: "IE", month: 3, day: 17 },
  { isoAlpha2: "IN", month: 1, day: 26 },
  { isoAlpha2: "IQ", month: 10, day: 3 },
  { isoAlpha2: "IR", month: 4, day: 1 },
  { isoAlpha2: "IS", month: 6, day: 17 },
  { isoAlpha2: "IT", month: 6, day: 2 },
  { isoAlpha2: "JM", month: 8, day: 6 },
  { isoAlpha2: "JO", month: 5, day: 25 },
  { isoAlpha2: "JP", month: 2, day: 11 },
  { isoAlpha2: "KE", month: 12, day: 12 },
  { isoAlpha2: "KG", month: 8, day: 31 },
  { isoAlpha2: "KH", month: 11, day: 9 },
  { isoAlpha2: "KI", month: 7, day: 12 },
  { isoAlpha2: "KM", month: 7, day: 6 },
  { isoAlpha2: "KN", month: 9, day: 19 },
  { isoAlpha2: "KP", month: 9, day: 9 },
  { isoAlpha2: "KR", month: 8, day: 15 },
  { isoAlpha2: "KZ", month: 12, day: 16 },
  { isoAlpha2: "LA", month: 12, day: 2 },
  { isoAlpha2: "LB", month: 11, day: 22 },
  { isoAlpha2: "LC", month: 2, day: 22 },
  { isoAlpha2: "LI", month: 8, day: 15 },
  { isoAlpha2: "LK", month: 2, day: 4 },
  { isoAlpha2: "LR", month: 7, day: 26 },
  { isoAlpha2: "LS", month: 10, day: 4 },
  { isoAlpha2: "LT", month: 2, day: 16 },
  { isoAlpha2: "LU", month: 6, day: 23 },
  { isoAlpha2: "LV", month: 11, day: 18 },
  { isoAlpha2: "MA", month: 7, day: 30 },
  { isoAlpha2: "MC", month: 11, day: 19 },
  { isoAlpha2: "MD", month: 8, day: 27 },
  { isoAlpha2: "ME", month: 7, day: 13 },
  { isoAlpha2: "MG", month: 6, day: 26 },
  { isoAlpha2: "MH", month: 5, day: 1 },
  { isoAlpha2: "MK", month: 8, day: 2 },
  { isoAlpha2: "ML", month: 9, day: 22 },
  { isoAlpha2: "MM", month: 1, day: 4 },
  { isoAlpha2: "MN", month: 7, day: 11 },
  { isoAlpha2: "MR", month: 11, day: 28 },
  { isoAlpha2: "MT", month: 9, day: 21 },
  { isoAlpha2: "MU", month: 3, day: 12 },
  { isoAlpha2: "MV", month: 7, day: 26 },
  { isoAlpha2: "MW", month: 7, day: 6 },
  { isoAlpha2: "MX", month: 9, day: 16 },
  { isoAlpha2: "MY", month: 8, day: 31 },
  { isoAlpha2: "MZ", month: 6, day: 25 },
  { isoAlpha2: "NA", month: 3, day: 21 },
  { isoAlpha2: "NE", month: 12, day: 18 },
  { isoAlpha2: "NG", month: 10, day: 1 },
  { isoAlpha2: "NI", month: 9, day: 15 },
  { isoAlpha2: "NL", month: 4, day: 27 },
  { isoAlpha2: "NO", month: 5, day: 17 },
  { isoAlpha2: "NP", month: 9, day: 20 },
  { isoAlpha2: "NR", month: 1, day: 31 },
  { isoAlpha2: "NZ", month: 2, day: 6 },
  { isoAlpha2: "OM", month: 11, day: 18 },
  { isoAlpha2: "PA", month: 11, day: 3 },
  { isoAlpha2: "PE", month: 7, day: 28 },
  { isoAlpha2: "PG", month: 9, day: 16 },
  { isoAlpha2: "PH", month: 6, day: 12 },
  { isoAlpha2: "PK", month: 3, day: 23 },
  { isoAlpha2: "PL", month: 11, day: 11 },
  { isoAlpha2: "PS", month: 11, day: 15 },
  { isoAlpha2: "PT", month: 6, day: 10 },
  { isoAlpha2: "PW", month: 7, day: 9 },
  { isoAlpha2: "PY", month: 5, day: 15 },
  { isoAlpha2: "QA", month: 12, day: 18 },
  { isoAlpha2: "RO", month: 12, day: 1 },
  { isoAlpha2: "RS", month: 2, day: 15 },
  { isoAlpha2: "RU", month: 6, day: 12 },
  { isoAlpha2: "RW", month: 7, day: 4 },
  { isoAlpha2: "SA", month: 9, day: 23 },
  { isoAlpha2: "SB", month: 7, day: 7 },
  { isoAlpha2: "SC", month: 6, day: 29 },
  { isoAlpha2: "SD", month: 1, day: 1 },
  { isoAlpha2: "SE", month: 6, day: 6 },
  { isoAlpha2: "SG", month: 8, day: 9 },
  { isoAlpha2: "SI", month: 6, day: 25 },
  { isoAlpha2: "SK", month: 1, day: 1 },
  { isoAlpha2: "SL", month: 4, day: 27 },
  { isoAlpha2: "SM", month: 9, day: 3 },
  { isoAlpha2: "SN", month: 4, day: 4 },
  { isoAlpha2: "SO", month: 7, day: 1 },
  { isoAlpha2: "SR", month: 11, day: 25 },
  { isoAlpha2: "SS", month: 7, day: 9 },
  { isoAlpha2: "ST", month: 7, day: 12 },
  { isoAlpha2: "SV", month: 9, day: 15 },
  { isoAlpha2: "SY", month: 4, day: 17 },
  { isoAlpha2: "SZ", month: 9, day: 6 },
  { isoAlpha2: "TD", month: 8, day: 11 },
  { isoAlpha2: "TG", month: 4, day: 27 },
  { isoAlpha2: "TH", month: 12, day: 5 },
  { isoAlpha2: "TJ", month: 9, day: 9 },
  { isoAlpha2: "TL", month: 5, day: 20 },
  { isoAlpha2: "TM", month: 10, day: 27 },
  { isoAlpha2: "TN", month: 3, day: 20 },
  { isoAlpha2: "TO", month: 11, day: 4 },
  { isoAlpha2: "TR", month: 10, day: 29 },
  { isoAlpha2: "TT", month: 8, day: 31 },
  { isoAlpha2: "TV", month: 10, day: 1 },
  { isoAlpha2: "TZ", month: 4, day: 26 },
  { isoAlpha2: "UA", month: 8, day: 24 },
  { isoAlpha2: "UG", month: 10, day: 9 },
  { isoAlpha2: "US", month: 7, day: 4 },
  { isoAlpha2: "UY", month: 8, day: 25 },
  { isoAlpha2: "UZ", month: 9, day: 1 },
  { isoAlpha2: "VA", month: 5, day: 18 },
  { isoAlpha2: "VC", month: 10, day: 27 },
  { isoAlpha2: "VE", month: 7, day: 5 },
  { isoAlpha2: "VN", month: 9, day: 2 },
  { isoAlpha2: "VU", month: 7, day: 30 },
  { isoAlpha2: "WS", month: 6, day: 1 },
  { isoAlpha2: "YE", month: 5, day: 22 },
  { isoAlpha2: "ZA", month: 4, day: 27 },
  { isoAlpha2: "ZM", month: 10, day: 24 },
  { isoAlpha2: "ZW", month: 4, day: 18 },
] as const satisfies readonly NationalDayCalendarEntry[];

export const UNASSIGNED_NATIONAL_DAY_COUNTRIES = [
  {
    isoAlpha2: "GB",
    reason:
      "Le Royaume-Uni n’a pas de fête nationale officielle ; la date officieuse est mobile.",
  },
  {
    isoAlpha2: "IL",
    reason:
      "Yom Ha’atzmaout suit le calendrier hébraïque et change de date grégorienne.",
  },
  {
    isoAlpha2: "KW",
    reason: "Le Koweït est absent du tableau source.",
  },
  {
    isoAlpha2: "LY",
    reason: "La source ne reconnaît actuellement aucune fête nationale officielle.",
  },
] as const;

const MARKET_DATE_OVERRIDES = new Map<string, string>([
  ["2026-08-26", "UY"],
]);

export type FeaturedNationalDay = {
  isoAlpha2: string;
  isExceptionalOverride: boolean;
};

export function getFeaturedNationalDaysForMarketDate(
  marketDate: string,
): FeaturedNationalDay[] {
  const parsed = parseMarketDate(marketDate);
  if (!parsed) return [];

  const override = MARKET_DATE_OVERRIDES.get(marketDate);
  if (override) {
    return [{ isoAlpha2: override, isExceptionalOverride: true }];
  }

  return NATIONAL_DAY_CALENDAR.filter(
    (entry) => entry.month === parsed.month && entry.day === parsed.day,
  )
    .sort((left, right) => left.isoAlpha2.localeCompare(right.isoAlpha2))
    .map((entry) => ({
      isoAlpha2: entry.isoAlpha2,
      isExceptionalOverride: false,
    }));
}

export function getNationalDayCandidates(month: number, day: number) {
  return NATIONAL_DAY_CALENDAR.filter(
    (entry) => entry.month === month && entry.day === day,
  ).map((entry) => entry.isoAlpha2);
}

function parseMarketDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}
