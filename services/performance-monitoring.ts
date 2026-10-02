import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PerformanceSample } from "@/lib/performance/samples";

/** Called after the response; failure never propagates to the gameplay request. */
export async function persistPerformanceSamples(samples: PerformanceSample[]) {
  if (!samples.length) return;
  try {
    const result = await createSupabaseAdminClient().rpc("record_performance_samples", {
      p_samples: samples.slice(0, 32),
      p_deployment: (process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 100),
    }).abortSignal(AbortSignal.timeout(3_000));
    if (result.error) console.warn("performance_monitoring_unavailable", result.error.code);
  } catch { console.warn("performance_monitoring_unavailable"); }
}
