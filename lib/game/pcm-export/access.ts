import { canAccessPrivateAdmin } from "@/lib/game/private-admin-access";

export function canAccessPcmExport(email: string | null | undefined) {
  return canAccessPrivateAdmin(email);
}

// Gouille's verified playing account. This delegates PCM downloads only;
// neither the homonymous unused profile nor a staff/admin role is included.
export function canAccessDelegatedPcmExport(userId: string | null | undefined) {
  return userId === "ee244935-5722-4626-a28f-dc3cf63aa6f4";
}
