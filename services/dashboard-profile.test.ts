import { describe, expect, it, vi } from "vitest";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDashboardDirectorProfile } from "./dashboard-profile";

const profile = {
  id: "ds", username: "manager", display_name: "Manager", country_id: "fr",
  avatar_key: "default", avatar_frame_key: null, reputation_points: 75,
  experience_points: 120, is_email_visible: false, created_at: "2026-01-01",
};
const country = { id: "fr", name: "France", iso_alpha2: "FR", is_active: true };

function client(data: unknown, error: { message: string } | null = null) {
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data, error }) };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  const from = vi.fn(() => query);
  return { from, query, db: { from } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>> };
}

describe("dashboard profile bounded identity read", () => {
  it("keeps all profile data and its one country in one authenticated lookup", async () => {
    const mock = client({ ...profile, country });
    const result = await getDashboardDirectorProfile(mock.db, "auth-user");
    expect(result.data).toMatchObject(profile);
    expect(result.country).toEqual(country);
    expect(mock.from).toHaveBeenCalledExactlyOnceWith("sporting_directors");
    expect(mock.query.eq).toHaveBeenCalledExactlyOnceWith("auth_user_id", "auth-user");
    expect(mock.query.select.mock.calls[0][0]).toContain("country:countries!sporting_directors_country_id_fkey");
  });

  it.each([null, [], { ...country, is_active: false }])("preserves a profile with an absent/inactive country (%j)", async country => {
    const result = await getDashboardDirectorProfile(client({ ...profile, country }).db, "auth-user");
    expect(result.data?.id).toBe("ds");
    expect(result.country).toBeNull();
  });

  it("supports relationship array responses without reading the directory", async () => {
    expect((await getDashboardDirectorProfile(client({ ...profile, country: [country] }).db, "auth-user")).country).toEqual(country);
  });

  it("keeps missing profiles and errors explicit", async () => {
    expect(await getDashboardDirectorProfile(client(null).db, "auth-user")).toEqual({ data: null, error: null, country: null });
    expect(await getDashboardDirectorProfile(client(null, { message: "unavailable" }).db, "auth-user")).toEqual({ data: null, error: { message: "unavailable" }, country: null });
  });
});
