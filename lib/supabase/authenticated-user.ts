import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type AuthenticatedUser = {
  id: string;
  email: string | null;
};

export async function getAuthenticatedUser(
  supabase: SupabaseServerClient,
): Promise<{
  data: { user: AuthenticatedUser | null };
  error: Error | null;
}> {
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const subject = claims?.sub;

  if (error || typeof subject !== "string" || subject.length === 0) {
    return {
      data: { user: null },
      error: error ?? new Error("Session utilisateur invalide."),
    };
  }

  return {
    data: {
      user: {
        id: subject,
        email:
          typeof claims?.email === "string"
            ? claims.email
            : null,
      },
    },
    error: null,
  };
}
