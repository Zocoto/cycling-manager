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
    expect(markup).toContain("vous pouvez créer votre compte sans code");
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
  });
});
