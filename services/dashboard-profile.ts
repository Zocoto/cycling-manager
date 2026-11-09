import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";

export type DashboardDirectorProfile = {
  id: string;
  username: string;
  display_name: string;
  country_id: string | null;
  avatar_key: string | null;
  avatar_frame_key: "alpha_tester" | null;
  reputation_points: number;
  experience_points: number;
  is_email_visible: boolean;
  created_at: string;
};

export type DashboardDirectorCountry = {
  id: string;
  name: string;
  iso_alpha2: string;
};

type CountryRelation = DashboardDirectorCountry & { is_active: boolean };
type ProfileRow = DashboardDirectorProfile & {
  country: CountryRelation | CountryRelation[] | null;
  referral_profile: { referral_code: string } | null;
};

/** Read the director, country and private referral code in one bounded lookup. */
export async function getDashboardDirectorProfile(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  authUserId: string,
) {
  const result = await supabase.from("sporting_directors")
    .select(`id, username, display_name, country_id, avatar_key, avatar_frame_key,
      reputation_points, experience_points, is_email_visible, created_at,
      country:countries!sporting_directors_country_id_fkey(id, name, iso_alpha2, is_active),
      referral_profile:referral_profiles!referral_profiles_sporting_director_id_fkey(referral_code)`)
    .eq("auth_user_id", authUserId)
    .maybeSingle<ProfileRow>();
  const embedded = result.data?.country;
  const country = Array.isArray(embedded) ? embedded[0] : embedded;
  return {
    data: result.data,
    error: result.error,
    // Preserve the former directory's is_active=true rule without filtering
    // away the profile when its country is absent or inactive.
    country: country?.is_active ? country : null,
  };
}
