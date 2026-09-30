import {
  PRIVATE_ADMIN_EMAIL,
  canAccessPrivateAdmin,
} from "@/lib/game/private-admin-access";

export const PLAYER_TRACKING_ADMIN_EMAIL = PRIVATE_ADMIN_EMAIL;

export function canAccessPlayerTracking(
  email: string | null | undefined,
) {
  return canAccessPrivateAdmin(email);
}
