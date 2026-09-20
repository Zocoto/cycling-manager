const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isMarketingUnsubscribeToken(value: string) {
  return UUID_PATTERN.test(value);
}

export function buildMarketingUnsubscribeUrl({
  siteUrl,
  token,
  locale = "fr",
}: {
  siteUrl: string;
  token: string;
  locale?: "fr" | "en";
}) {
  const url = new URL("/emails/desinscription", siteUrl);
  url.searchParams.set("token", token);
  url.searchParams.set("lang", locale);
  return url.toString();
}

export function buildOneClickMarketingUnsubscribeUrl({
  siteUrl,
  token,
}: {
  siteUrl: string;
  token: string;
}) {
  const url = new URL("/api/emails/desinscription", siteUrl);
  url.searchParams.set("token", token);
  return url.toString();
}
