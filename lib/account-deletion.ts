export const ACCOUNT_DELETION_CONFIRMATION =
  "SUPPRIMER" as const;

export function isAccountDeletionConfirmed(
  value: unknown
) {
  return value === ACCOUNT_DELETION_CONFIRMATION;
}
