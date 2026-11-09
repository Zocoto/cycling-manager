import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../app/(public)/inscription/actions", () => ({
  registerAccount: vi.fn(),
}));
vi.mock("./email-verification-resend-form", () => ({
  EmailVerificationResendForm: () => null,
}));
vi.mock("@/components/ui/app-link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock("../../lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("../../services/referrals", () => ({
  getPublicReferralInvitation: vi.fn(),
}));

import RegistrationPage from "../../app/(public)/inscription/page";
import { RegistrationForm } from "./registration-form";

function input(markup: string, name: string) {
  const tag = markup.match(new RegExp(`<input\\b[^>]*name="${name}"[^>]*>`))?.[0];
  expect(tag).toBeDefined();
  return tag!;
}

describe("registration form constraints", () => {
  it("allows an empty referral code while keeping account fields mandatory", () => {
    const markup = renderToStaticMarkup(<RegistrationForm />);
    expect(input(markup, "referralCode")).not.toMatch(/\brequired(?:=|\s|>)/);
    expect(markup).toContain("<details>");
    expect(markup).toContain("J’ai un code parrain");
    expect(markup.indexOf('name="managerName"')).toBeLessThan(markup.indexOf('name="referralCode"'));
    for (const name of ["managerName", "email", "password", "passwordConfirmation", "legalAcceptance"]) {
      expect(input(markup, name)).toMatch(/\brequired(?:=|\s|>)/);
    }
  });

  it("preserves the code supplied by an invitation link", () => {
    const markup = renderToStaticMarkup(
      <RegistrationForm referralCode="DS-ABCDEF123456" referrerName="Mon parrain" />,
    );
    expect(input(markup, "referralCode")).toContain('type="hidden"');
    expect(input(markup, "referralCode")).toContain('value="DS-ABCDEF123456"');
    expect(markup).toContain("Invitation de Mon parrain");
    expect(markup).toContain("Retirer le parrainage");
  });
});

describe("signup welcome offer", () => {
  it.each([
    ["2026-11-04T12:44:34.115+01:00", false],
    ["2026-11-14T12:44:34.115+01:00", true],
    ["2026-11-14T12:44:34.116+01:00", false],
  ])("honors the Paris campaign window at %s", async (time, offerVisible) => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse(time));
    try {
      const markup = renderToStaticMarkup(
        await RegistrationPage({
          searchParams: Promise.resolve({ utm_campaign: "s5_relance_story_nov26" }),
        }),
      );
      const offer = "Un membre du staff offert à la création de votre équipe";
      expect(markup.includes(offer)).toBe(offerVisible);
      expect(input(markup, "utm_campaign")).toContain('value="s5_relance_story_nov26"');
      if (offerVisible) {
        expect(markup.indexOf(offer)).toBeLessThan(markup.indexOf("Créer mon compte gratuit"));
      }
    } finally {
      clock.mockRestore();
    }
  });
});
