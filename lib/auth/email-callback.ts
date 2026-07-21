import type { EmailOtpType } from "@supabase/supabase-js";

export type EmailCallbackCredentials =
  | { strategy: "code"; code: string }
  | {
      strategy: "token-hash";
      tokenHash: string;
      type: EmailOtpType;
    };

export function getEmailCallbackCredentials(
  searchParams: URLSearchParams,
  expectedType: EmailOtpType
): EmailCallbackCredentials | null {
  const code = searchParams.get("code")?.trim();

  if (code) {
    return { strategy: "code", code };
  }

  const tokenHash = searchParams.get("token_hash")?.trim();
  const type = searchParams.get("type");

  if (!tokenHash || type !== expectedType) {
    return null;
  }

  return {
    strategy: "token-hash",
    tokenHash,
    type: expectedType,
  };
}
