const parisClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  hourCycle: "h23",
  hour: "2-digit",
  minute: "2-digit",
});

export function isDashboardNationsCupVisible(seasonDay: number | null, now: Date): boolean {
  if (seasonDay === 22) return parisClock.format(now) >= "14:10";
  return seasonDay === 23 || seasonDay === 24 || seasonDay === 25;
}
