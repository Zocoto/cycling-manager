export const RACE_SIMULATOR_ALLOWED_EMAIL = "paul.leblanc22@gmail.com";

export function canAccessRaceSimulator(email: string | null | undefined) {
  return email?.trim().toLowerCase() === RACE_SIMULATOR_ALLOWED_EMAIL;
}
