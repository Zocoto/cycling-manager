// Keep the historical hills slot/URLs: selections and confirmed rider IDs survive.
export const OLYMPIC_ROAD_SLOT = "nc-hills";
export const OLYMPIC_ROAD_LABEL = "Jeux quadriennaux · Course en ligne";
const PROFESSIONAL_CUP_SLOTS = new Set([
  "nc-mountain", "nc-hills", "nc-sprint", "nc-cobbles", "nc-time-trial",
]);

export function isOlympicSeason(gameYear: number) {
  return gameYear >= 4 && gameYear % 4 === 0;
}

export function isFederationSelectionSlotAvailable(slotKey: string, gameYear: number) {
  return !isOlympicSeason(gameYear) || !PROFESSIONAL_CUP_SLOTS.has(slotKey)
    || slotKey === OLYMPIC_ROAD_SLOT;
}

export function getProfessionalNationsEventCount(gameYear: number) {
  return isOlympicSeason(gameYear) ? 1 : 5;
}
