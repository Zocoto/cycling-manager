import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Configuration Supabase absente.");
}

const readOnlyFetch = async (input, init) => {
  const method = (
    init?.method ?? (input instanceof Request ? input.method : "GET")
  ).toUpperCase();

  if (method !== "GET" && method !== "HEAD") {
    throw new Error(`Écriture interdite pendant l’audit : ${method}`);
  }

  return fetch(input, init);
};

const db = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: { fetch: readOnlyFetch },
});

async function rows(request, label) {
  const result = await request;
  if (result.error) throw new Error(`${label} : ${result.error.message}`);
  return result.data ?? [];
}

async function loadProcessedSelections() {
  const processed = new Map();

  const roots = [
    path.resolve("assets/pcm/teams"),
    path.resolve(
      process.env.PCM_PACKAGE_ROOT ??
        "C:/Dev/pcm26-bridge-lab/Cyclostratege-PCMAssets-Mod",
      "SourceAssets/Teams",
    ),
  ];

  for (const root of roots) {
    let entries;
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const manifestPath = path.join(root, entry.name, "manifest.json");
      try {
        const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
        const teamId = manifest.team?.permanentTeamId;
        const jerseyId = manifest.selection?.jerseyId;
        const pcmAssetCode =
          manifest.team?.activeCompatibilitySlot ??
          manifest.team?.pcmCompatibilitySlot ??
          manifest.team?.pcmAssetCode;
        if (teamId && jerseyId) {
          processed.set(teamId, {
            jerseyId,
            pcmAssetCode:
              typeof pcmAssetCode === "string"
                ? pcmAssetCode.toLowerCase()
                : null,
          });
        }
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
  }

  return processed;
}

const [season4] = await rows(
  db.from("seasons").select("id,name,game_year,status").eq("game_year", 4),
  "saison 4",
);

if (!season4) throw new Error("Saison 4 introuvable.");

const assignments = await rows(
  db
    .from("team_manager_assignments")
    .select("team_id,sporting_director_id")
    .eq("status", "active")
    .eq("role", "general_manager"),
  "affectations actives",
);

const teamIds = [...new Set(assignments.map((row) => row.team_id))];
const directorIds = [
  ...new Set(assignments.map((row) => row.sporting_director_id)),
];

const [teams, directors, contracts] = await Promise.all([
  rows(
    db
      .from("teams")
      .select("id,internal_name,status,pcm_asset_code")
      .in("id", teamIds),
    "équipes",
  ),
  rows(
    db
      .from("sporting_directors")
      .select(
        "id,display_name,status,onboarding_completed,reputation_points,auth_user_id",
      )
      .in("id", directorIds),
    "directeurs sportifs",
  ),
  rows(
    db
      .from("team_sponsor_contracts")
      .select(
        "id,team_id,sponsor_id,start_season_id,selected_jersey_id,pending_jersey_id,pending_jersey_season_id,status",
      )
      .eq("role", "principal")
      .in("status", ["planned", "active"]),
    "contrats principaux actifs ou planifiés",
  ),
]);

const sponsorIds = [...new Set(contracts.map((row) => row.sponsor_id))];
const sponsors = sponsorIds.length
  ? await rows(
      db.from("sponsors").select("id,name,catalog_key").in("id", sponsorIds),
      "sponsors",
    )
  : [];

const teamById = new Map(teams.map((row) => [row.id, row]));
const directorById = new Map(directors.map((row) => [row.id, row]));
const sponsorById = new Map(sponsors.map((row) => [row.id, row]));
const assignmentByTeamId = new Map(assignments.map((row) => [row.team_id, row]));
const processed = await loadProcessedSelections();

const eligibleTeamIds = new Set(
  assignments
    .filter((assignment) => {
      const team = teamById.get(assignment.team_id);
      const director = directorById.get(assignment.sporting_director_id);
      return (
        team?.status === "active" &&
        director?.status === "active" &&
        director?.onboarding_completed === true &&
        Boolean(director?.auth_user_id) &&
        Number(director?.reputation_points ?? 0) >= 30
      );
    })
    .map((assignment) => assignment.team_id),
);

const selectedEligibleContracts = contracts
  .map((contract) => ({
    ...contract,
    season4JerseyId:
      contract.pending_jersey_season_id === season4.id
        ? contract.pending_jersey_id
        : contract.start_season_id === season4.id
          ? contract.selected_jersey_id
          : null,
  }))
  .filter(
    (contract) =>
      eligibleTeamIds.has(contract.team_id) && Boolean(contract.season4JerseyId),
  );

const unprocessed = selectedEligibleContracts
  .filter(
    (contract) => {
      const team = teamById.get(contract.team_id);
      const processedSelection = processed.get(contract.team_id);
      return (
        processedSelection?.jerseyId !== contract.season4JerseyId ||
        processedSelection?.pcmAssetCode !==
          String(team?.pcm_asset_code ?? "").toLowerCase()
      );
    },
  )
  .map((contract) => {
    const team = teamById.get(contract.team_id);
    const assignment = assignmentByTeamId.get(contract.team_id);
    const director = directorById.get(assignment?.sporting_director_id);
    const sponsor = sponsorById.get(contract.sponsor_id);
    return {
      teamId: contract.team_id,
      team: team?.internal_name ?? null,
      manager: director?.display_name ?? null,
      sponsor: sponsor?.name ?? null,
      sponsorCatalogKey: sponsor?.catalog_key ?? null,
      jerseyId: contract.season4JerseyId,
      currentPcmAssetCode: team?.pcm_asset_code ?? null,
    };
  })
  .sort((left, right) =>
    String(left.manager).localeCompare(String(right.manager), "fr"),
  );

console.log(
  JSON.stringify(
    {
      season: season4,
      sponsorEligibleTeams: eligibleTeamIds.size,
      sponsorEligibleTeamsWithSelectedS4Jersey: selectedEligibleContracts.length,
      processedSelectedS4Jerseys: selectedEligibleContracts.length - unprocessed.length,
      unprocessedSelectedS4Jerseys: unprocessed,
    },
    null,
    2,
  ),
);
