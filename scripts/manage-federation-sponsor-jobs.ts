import process from "node:process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({
  path: process.env.SPONSOR_JOBS_ENV_FILE?.trim() || ".env.local",
});

type SponsorCreationJobRow = {
  id: string;
  country_id: string;
  requested_game_year: number;
  status: "pending" | "in_progress" | "completed" | "failed";
  sponsor_catalog_key: string | null;
  sponsor_name: string | null;
  failure_reason: string | null;
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
};

type CountryRow = {
  id: string;
  iso_alpha2: string;
  name: string;
};

function getRequiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`La variable d’environnement ${name} est absente ou vide.`);
  }
  return value;
}

function createAdminClient(): SupabaseClient {
  return createClient(
    getRequiredEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnvironmentVariable("SUPABASE_SECRET_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}

async function listJobs(supabase: SupabaseClient, includeCompleted: boolean) {
  let query = supabase
    .from("national_federation_sponsor_creation_jobs")
    .select(
      "id, country_id, requested_game_year, status, sponsor_catalog_key, sponsor_name, failure_reason, requested_at, started_at, completed_at",
    )
    .order("requested_at", { ascending: true });
  if (!includeCompleted) {
    query = query.in("status", ["pending", "in_progress", "failed"]);
  }

  const jobsResult = await query.returns<SponsorCreationJobRow[]>();
  if (jobsResult.error) {
    throw new Error(`Impossible de charger la file : ${jobsResult.error.message}`);
  }

  const jobs = jobsResult.data ?? [];
  const countryIds = [...new Set(jobs.map((job) => job.country_id))];
  const countriesResult = countryIds.length
    ? await supabase
        .from("countries")
        .select("id, iso_alpha2, name")
        .in("id", countryIds)
        .returns<CountryRow[]>()
    : { data: [] as CountryRow[], error: null };
  if (countriesResult.error) {
    throw new Error(
      `Impossible d’identifier les pays de la file : ${countriesResult.error.message}`,
    );
  }

  const countryById = new Map(
    (countriesResult.data ?? []).map((country) => [country.id, country]),
  );
  const output = jobs.map((job) => ({
    jobId: job.id,
    countryCode: countryById.get(job.country_id)?.iso_alpha2 ?? null,
    countryName: countryById.get(job.country_id)?.name ?? null,
    gameYear: job.requested_game_year,
    status: job.status,
    sponsorCatalogKey: job.sponsor_catalog_key,
    sponsorName: job.sponsor_name,
    failureReason: job.failure_reason,
    requestedAt: job.requested_at,
    startedAt: job.started_at,
    completedAt: job.completed_at,
  }));

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

async function claimJob(supabase: SupabaseClient, jobId: string | undefined) {
  const result = await supabase.rpc(
    "claim_national_federation_sponsor_creation_job",
    { p_job_id: jobId ?? null },
  );
  if (result.error) {
    throw new Error(`Impossible de prendre le job : ${result.error.message}`);
  }
  process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
}

async function completeJob(
  supabase: SupabaseClient,
  jobId: string | undefined,
  sponsorCatalogKey: string | undefined,
) {
  if (!jobId || !sponsorCatalogKey) {
    throw new Error(
      "Usage : npm run sponsors:jobs -- complete <job-id> <catalog-key>",
    );
  }
  const result = await supabase.rpc(
    "complete_national_federation_sponsor_creation_job",
    {
      p_job_id: jobId,
      p_sponsor_catalog_key: sponsorCatalogKey,
    },
  );
  if (result.error) {
    throw new Error(`Impossible de publier le job : ${result.error.message}`);
  }
  process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
}

async function failJob(
  supabase: SupabaseClient,
  jobId: string | undefined,
  reasonParts: string[],
) {
  const reason = reasonParts.join(" ").trim();
  if (!jobId || !reason) {
    throw new Error(
      "Usage : npm run sponsors:jobs -- fail <job-id> <motif>",
    );
  }
  const result = await supabase.rpc(
    "fail_national_federation_sponsor_creation_job",
    {
      p_job_id: jobId,
      p_failure_reason: reason,
    },
  );
  if (result.error) {
    throw new Error(`Impossible de signaler l’échec : ${result.error.message}`);
  }
  process.stdout.write(`${JSON.stringify({ jobId, status: "failed" }, null, 2)}\n`);
}

async function main(): Promise<void> {
  const [command = "list", firstArgument, secondArgument, ...remaining] =
    process.argv.slice(2);
  const supabase = createAdminClient();

  if (command === "list") {
    await listJobs(supabase, firstArgument === "--all");
    return;
  }
  if (command === "claim") {
    await claimJob(supabase, firstArgument);
    return;
  }
  if (command === "complete") {
    await completeJob(supabase, firstArgument, secondArgument);
    return;
  }
  if (command === "fail") {
    await failJob(
      supabase,
      firstArgument,
      [secondArgument, ...remaining].filter(
        (value): value is string => typeof value === "string",
      ),
    );
    return;
  }

  throw new Error(
    "Commande inconnue. Utilisez list [--all], claim [job-id], complete <job-id> <catalog-key> ou fail <job-id> <motif>.",
  );
}

void main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "La gestion des jobs sponsor a échoué.",
  );
  process.exitCode = 1;
});
