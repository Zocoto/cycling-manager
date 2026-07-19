import { describe, expect, it } from "vitest";

import {
  ACCOUNT_DELETION_CONFIRMATION,
  isAccountDeletionConfirmed,
} from "./account-deletion";

describe("confirmation de suppression du compte", () => {
  it("accepte uniquement le mot-clé exact", () => {
    expect(
      isAccountDeletionConfirmed(
        ACCOUNT_DELETION_CONFIRMATION
      )
    ).toBe(true);
    expect(
      isAccountDeletionConfirmed("supprimer")
    ).toBe(false);
    expect(
      isAccountDeletionConfirmed(" SUPPRIMER ")
    ).toBe(false);
    expect(isAccountDeletionConfirmed(null)).toBe(
      false
    );
  });
});
