import { canAccessPrivateAdmin } from "@/lib/game/private-admin-access";

export function canAccessPcmExport(email: string | null | undefined) {
  return canAccessPrivateAdmin(email);
}
