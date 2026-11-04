const parisOffsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Paris",
  timeZoneName: "shortOffset",
});

/** UTC cron schedules have separate Paris daylight/standard-time variants. */
export function isSeasonalCronActive(slot: string, now: Date): boolean {
  const variant = slot.match(/(?:^|-)(summer|winter)(?:-|$)/)?.[1];
  // Legacy slots and unconditional recovery jobs keep their existing behavior.
  if (!variant) return true;

  const offset = parisOffsetFormatter.formatToParts(now)
    .find((part) => part.type === "timeZoneName")?.value;
  const activeVariant = offset === "GMT+2" ? "summer" : "winter";
  return variant === activeVariant;
}
