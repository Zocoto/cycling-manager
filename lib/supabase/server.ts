import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { after } from "next/server";
import { createTimedRpcFetch } from "@/lib/performance/rpc-fetch";
import type { PerformanceSample } from "@/lib/performance/samples";
import { persistPerformanceSamples } from "@/services/performance-monitoring";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Les variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY sont manquantes."
    );
  }

  const samples: PerformanceSample[] = [];
  const sampled = Math.random() < 0.25;
  if (sampled) after(() => persistPerformanceSamples(samples));

  return createServerClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      global: sampled ? {
        fetch: createTimedRpcFetch(fetch, new URL(supabaseUrl).origin, (sample) => {
          if (samples.length < 32) samples.push(sample);
        }),
      } : undefined,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}
