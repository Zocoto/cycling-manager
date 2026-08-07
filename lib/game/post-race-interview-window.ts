import { getParisDateKey, getParisHour } from "./cyclogazette";

export function isPostRaceInterviewWindowOpen(
  raceDate: string,
  now: Date = new Date(),
) {
  return raceDate === getParisDateKey(now) && getParisHour(now) < 20;
}
