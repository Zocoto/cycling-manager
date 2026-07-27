import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const config = readFileSync(
  join(process.cwd(), "supabase/config.toml"),
  "utf8",
);
const confirmationTemplate = readFileSync(
  join(
    process.cwd(),
    "supabase/templates/confirmation.html",
  ),
  "utf8",
);
const emailSection =
  config.match(/\[auth\.email\]([\s\S]*?)(?=\n\[)/)?.[1] ?? "";
const rateLimitSection =
  config.match(/\[auth\.rate_limit\]([\s\S]*?)(?=\n\[)/)?.[1] ??
  "";

describe("email verification configuration", () => {
  it("requires email confirmation and keeps a deliberate send limit", () => {
    expect(emailSection).toContain(
      "enable_confirmations = true",
    );
    expect(emailSection).toContain('max_frequency = "60s"');
    expect(rateLimitSection).toContain("email_sent = 30");
  });

  it("allows every deployed confirmation landing page", () => {
    expect(config).toContain(
      '"https://cyclostratege.fr/inscription/confirmer"',
    );
    expect(config).toContain(
      '"https://cyclostratege.vercel.app/inscription/confirmer"',
    );
    expect(config).toContain(
      '"http://localhost:3000/inscription/confirmer"',
    );
  });

  it("uses the app redirect with a hashed token", () => {
    expect(confirmationTemplate).toContain(
      'href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=email"',
    );
    expect(confirmationTemplate).not.toContain(
      'href="{{ .ConfirmationURL }}"',
    );
  });
});
