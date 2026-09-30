export const PRIVATE_ADMIN_EMAIL = "paul.leblanc22@gmail.com";

export function canAccessPrivateAdmin(email: string | null | undefined) {
  return email?.trim().toLowerCase() === PRIVATE_ADMIN_EMAIL;
}
