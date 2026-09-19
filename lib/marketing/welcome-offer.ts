export const STANDARD_NEW_DIRECTOR_STARTING_CASH = 10_000;

export type PublicWelcomeOffer = {
  code: string;
  startsAt: string;
  endsAt: string;
  extraStartingCash: number;
  totalStartingCash: number;
  scoutLevel: number;
};

export function normalizeActivePublicWelcomeOffer(
  value: unknown,
  now: Date = new Date(),
): PublicWelcomeOffer | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || typeof candidate !== "object") return null;

  const row = candidate as Record<string, unknown>;
  const code = readString(row.campaign_code);
  const startsAt = readString(row.starts_at);
  const endsAt = readString(row.ends_at);
  const extraStartingCash = readPositiveNumber(row.extra_starting_cash);
  const scoutLevel = readPositiveNumber(row.scout_level);
  const startsAtMs = Date.parse(startsAt);
  const endsAtMs = Date.parse(endsAt);
  const nowMs = now.getTime();

  if (
    !code ||
    !Number.isFinite(startsAtMs) ||
    !Number.isFinite(endsAtMs) ||
    startsAtMs >= endsAtMs ||
    nowMs < startsAtMs ||
    nowMs >= endsAtMs ||
    extraStartingCash === null ||
    scoutLevel === null ||
    !Number.isInteger(scoutLevel) ||
    scoutLevel > 5
  ) {
    return null;
  }

  return {
    code,
    startsAt,
    endsAt,
    extraStartingCash,
    totalStartingCash:
      STANDARD_NEW_DIRECTOR_STARTING_CASH + extraStartingCash,
    scoutLevel,
  };
}

export function buildWelcomeOfferSignupHref(
  offer: Pick<PublicWelcomeOffer, "code">,
  content: string,
) {
  const params = new URLSearchParams({
    utm_source: "cyclostratege",
    utm_medium: "owned_media",
    utm_campaign: offer.code,
    utm_content: content,
  });

  return `/inscription?${params.toString()}`;
}

export function formatWelcomeOfferDeadline(
  endsAt: string,
  locale: "fr" | "en",
) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(endsAt));
}

export function formatWelcomeOfferCash(value: number, locale: "fr" | "en") {
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readPositiveNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
