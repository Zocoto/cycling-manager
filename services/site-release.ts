import "server-only";
import { unstable_cache } from "next/cache";
import { APP_VERSION } from "@/lib/app-version";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { SITE_RELEASE_CACHE_TAG, siteReleaseManagementSchema, siteReleaseSnapshotSchema } from "@/lib/game/site-release";

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// One tiny shared read per cache refresh, not one browser request per visitor.
// The fallback is also cached: an unavailable database must not cause a stampede.
export const getActiveSiteVersion = unstable_cache(async (): Promise<string> => {
  try {
    const result = await createSupabaseAdminClient().rpc("get_active_site_release")
      .abortSignal(AbortSignal.timeout(1500));
    if (result.error) throw new Error("Version read unavailable");
    return siteReleaseSnapshotSchema.parse(result.data?.[0]).version;
  } catch {
    console.error("La version publique est temporairement indisponible ; version de secours affichée.");
    return APP_VERSION;
  }
}, ["active-site-release-v1"], { tags: [SITE_RELEASE_CACHE_TAG], revalidate: 300 });

export async function getSiteReleaseManagement(supabase: Client) {
  const result = await supabase.rpc("get_site_release_management")
    .abortSignal(AbortSignal.timeout(3000));
  if (result.error) throw new Error("La gestion de la version n’a pas pu être chargée.");
  return siteReleaseManagementSchema.parse(result.data?.[0]);
}
