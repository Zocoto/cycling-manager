import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  from: vi.fn(),
  upsert: vi.fn(),
  deleteUser: vi.fn(),
  referralInvitation: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("../../../lib/auth/public-site-url", () => ({
  getPublicSiteUrl: () => "https://cyclostratege.fr",
}));
vi.mock("../../../lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { signUp: mocks.signUp } }),
}));
vi.mock("../../../lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: mocks.from,
    rpc: mocks.rpc,
    auth: { admin: { deleteUser: mocks.deleteUser } },
  }),
}));
vi.mock("../../../services/referrals", () => ({
  getPublicReferralInvitation: mocks.referralInvitation,
}));

import { legalConfig } from "../../../lib/legal-config";
import { registerAccount } from "./actions";
import { initialRegistrationState } from "./registration-state";

const pendingUserId = "00000000-0000-4000-8000-000000000001";
const signupEmail = "signup@example.com";

function registrationForm() {
  const form = new FormData();
  form.set("managerName", "Nouveau DS");
  form.set("email", signupEmail);
  form.set("password", "new-account-password");
  form.set("passwordConfirmation", "new-account-password");
  form.set("legalAcceptance", "accepted");
  return form;
}

describe("registration legal acceptance", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.signUp.mockResolvedValue({
      data: {
        user: { id: pendingUserId, identities: [{ provider: "email" }] },
        session: null,
      },
      error: null,
    });
    mocks.from.mockReturnValue({ upsert: mocks.upsert });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the first acceptance when Auth returns the same pending account again", async () => {
    const first = await registerAccount(initialRegistrationState, registrationForm());
    const second = await registerAccount(initialRegistrationState, registrationForm());

    expect(first).toMatchObject({ status: "success", email: signupEmail });
    expect(second).toEqual(first);
    expect(mocks.from.mock.calls).toEqual([
      ["user_legal_acceptances"],
      ["user_legal_acceptances"],
    ]);
    const acceptance = {
      user_id: pendingUserId,
      terms_version: legalConfig.termsVersion,
      privacy_notice_version: legalConfig.privacyNoticeVersion,
    };
    const options = {
      onConflict: "user_id,terms_version,privacy_notice_version",
      ignoreDuplicates: true,
    };
    expect(mocks.upsert.mock.calls).toEqual([[acceptance, options], [acceptance, options]]);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("reports a failed legal write while preserving the Auth account", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.upsert.mockResolvedValue({ error: { code: "57014", message: "Timed out" } });

    await expect(registerAccount(initialRegistrationState, registrationForm()))
      .resolves.toMatchObject({ status: "error" });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("keeps the success response generic and skips writes for an obfuscated Auth user", async () => {
    const fresh = await registerAccount(initialRegistrationState, registrationForm());
    mocks.from.mockClear();
    mocks.upsert.mockClear();
    mocks.signUp.mockResolvedValue({
      data: {
        user: { id: "obfuscated-account-id", identities: [] },
        session: null,
      },
      error: null,
    });

    await expect(registerAccount(initialRegistrationState, registrationForm()))
      .resolves.toEqual(fresh);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("still completes a real referral after recording acceptance", async () => {
    const form = registrationForm();
    form.set("referralCode", "DS-123456789ABC");
    mocks.referralInvitation.mockResolvedValue({ code: "DS-123456789ABC" });

    await expect(registerAccount(initialRegistrationState, form))
      .resolves.toMatchObject({ status: "success" });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
      "finalize_registration_referral",
      { p_auth_user_id: pendingUserId },
    );
  });
});
