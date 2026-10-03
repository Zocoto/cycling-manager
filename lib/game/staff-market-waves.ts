export const STAFF_MARKET_REFRESH_ROUTE = "refresh";
export const STAFF_MARKET_WAVE_SIZE = 5;
export const STAFF_MARKET_WAVE_INTERVAL_HOURS = 2;
export const STAFF_MARKET_DAILY_WAVE_COUNT =
  24 / STAFF_MARKET_WAVE_INTERVAL_HOURS;
export const STAFF_MARKET_DAILY_COUNT =
  STAFF_MARKET_WAVE_SIZE * STAFF_MARKET_DAILY_WAVE_COUNT;

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

export function isStaffMarketRefreshRoute(value: string) {
  return value === STAFF_MARKET_REFRESH_ROUTE;
}

export function isStaffMarketRefreshHour(date: Date) {
  const hour = getParisHour(date);
  return hour >= 0 && hour % STAFF_MARKET_WAVE_INTERVAL_HOURS === 0;
}

export function getCurrentStaffMarketWaveIndex(date: Date) {
  const hour = getParisHour(date);
  if (hour < 0) return -1;
  return Math.min(
    STAFF_MARKET_DAILY_WAVE_COUNT - 1,
    Math.floor(hour / STAFF_MARKET_WAVE_INTERVAL_HOURS),
  );
}

export function getDueStaffMarketWaveIndexes(date: Date) {
  const currentWaveIndex = getCurrentStaffMarketWaveIndex(date);
  return currentWaveIndex < 0
    ? []
    : Array.from({ length: currentWaveIndex + 1 }, (_, index) => index);
}
