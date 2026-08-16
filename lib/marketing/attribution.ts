export const MARKETING_FIELD_NAMES = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export type MarketingFieldName = (typeof MARKETING_FIELD_NAMES)[number];

export type MarketingAttribution = Partial<
  Record<MarketingFieldName, string>
>;

export type MarketingSearchParams = Record<
  string,
  string | string[] | undefined
>;

const maximumMarketingValueLength = 100;

export function readMarketingAttribution(
  values: MarketingSearchParams,
): MarketingAttribution {
  const attribution: MarketingAttribution = {};

  for (const field of MARKETING_FIELD_NAMES) {
    const rawValue = values[field];
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    const sanitizedValue = sanitizeMarketingValue(value);

    if (sanitizedValue) {
      attribution[field] = sanitizedValue;
    }
  }

  return attribution;
}

export function readMarketingAttributionFromFormData(
  formData: FormData,
): MarketingAttribution {
  const values = Object.fromEntries(
    MARKETING_FIELD_NAMES.map((field) => [
      field,
      formData.get(field)?.toString(),
    ]),
  );

  return readMarketingAttribution(values);
}

export function buildMarketingHref(
  pathname: string,
  attribution: MarketingAttribution,
): string {
  const searchParams = new URLSearchParams();

  for (const field of MARKETING_FIELD_NAMES) {
    const value = attribution[field];

    if (value) {
      searchParams.set(field, value);
    }
  }

  const query = searchParams.toString();

  return query ? `${pathname}?${query}` : pathname;
}

function sanitizeMarketingValue(
  value: string | undefined,
): string | undefined {
  const sanitizedValue = value
    ?.replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maximumMarketingValueLength);

  return sanitizedValue || undefined;
}
