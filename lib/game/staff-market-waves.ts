export const STAFF_MARKET_WAVES = ["midnight", "noon"] as const;

export type StaffMarketWave = (typeof STAFF_MARKET_WAVES)[number];

const STAFF_MARKET_WAVE_HOURS: Record<StaffMarketWave, number> = {
  midnight: 0,
  noon: 12,
};

export function isStaffMarketWave(value: string): value is StaffMarketWave {
  return STAFF_MARKET_WAVES.includes(value as StaffMarketWave);
}

export function getParisHour(date: Date) {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .find((part) => part.type === "hour")?.value;

  return Number(hour ?? -1);
}

export function isStaffMarketWaveDue(wave: StaffMarketWave, date: Date) {
  return getParisHour(date) === STAFF_MARKET_WAVE_HOURS[wave];
}

export function hasStaffMarketNoonWaveStarted(date: Date) {
  return getParisHour(date) >= STAFF_MARKET_WAVE_HOURS.noon;
}
