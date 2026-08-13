export const PLAYER_TRACKING_ADMIN_EMAIL = "paul.leblanc22@gmail.com";

export function canAccessPlayerTracking(
  email: string | null | undefined,
) {
  return (
    email?.trim().toLowerCase() === PLAYER_TRACKING_ADMIN_EMAIL
  );
}
