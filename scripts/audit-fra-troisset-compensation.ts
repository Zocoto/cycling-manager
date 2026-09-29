/** Read-only audit before granting Fra Troisset an incident compensation. */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({
  path:
    process.env.FRA_COMPENSATION_ENV_FILE ??
    "../cycling-manager/.env.local",
  quiet: true,
});

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Configuration Supabase absente.");

const db = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

async function query<T>(
  request: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  label: string,
) {
  const result = await request;
  if (result.error) throw new Error(`${label} : ${result.error.message}`);
  return result.data;
}

async function main() {
  const directors =
    (await query(
      db
        .from("sporting_directors")
        .select("id,username,display_name,status,auth_user_id")
        .or("username.ilike.%Fra Troisset%,display_name.ilike.%Fra Troisset%"),
      "directeur Fra Troisset",
    )) ?? [];

  if (directors.length !== 1) {
    throw new Error(`Nombre de comptes Fra Troisset inattendu : ${directors.length}`);
  }

  const director = directors[0];
  const assignments =
    (await query(
      db
        .from("team_manager_assignments")
        .select("team_id,role,status")
        .eq("sporting_director_id", director.id)
        .eq("status", "active"),
      "affectations actives",
    )) ?? [];
  const activeSeasons =
    (await query(
      db
        .from("seasons")
        .select("id,name,game_year,status,current_day_number")
        .eq("status", "active"),
      "saison active",
    )) ?? [];

  if (activeSeasons.length !== 1) {
    throw new Error(`Nombre de saisons actives inattendu : ${activeSeasons.length}`);
  }

  const season = activeSeasons[0];
  const teamIds = assignments.map((assignment) => assignment.team_id);
  const teamSeasons = teamIds.length
    ? ((await query(
        db
          .from("team_seasons")
          .select("id,team_id,display_name,short_name,season_id")
          .eq("season_id", season.id)
          .in("team_id", teamIds),
        "saisons d’équipe",
      )) ?? [])
    : [];
  const rewards =
    (await query(
      db
        .from("daily_reward_catalog")
        .select("reward_key,name,importance,effect_kind,is_active")
        .eq("is_active", true)
        .gte("importance", 7)
        .order("importance", { ascending: false }),
      "catalogue des compensations",
    )) ?? [];
  const grants =
    (await query(
      db
        .from("race_incident_compensation_grants")
        .select("id,incident_key,reward_key,reason,created_at")
        .eq("sporting_director_id", director.id)
        .eq("incident_key", "ruta-preparation-missing-stage-plan-20260928"),
      "compensation Ruta",
    )) ?? [];
  const grantIds = grants.map((grant) => grant.id);
  const inventory = grantIds.length
    ? ((await query(
        db
          .from("daily_reward_inventory")
          .select(
            "id,reward_key,team_season_id,source_race_incident_compensation_id,status,acquired_at,used_at,usage_payload,expires_after_game_year",
          )
          .in("source_race_incident_compensation_id", grantIds),
        "cadeau Ruta",
      )) ?? [])
    : [];
  const equipmentItemIds = inventory
    .map((item) => item.usage_payload?.equipmentItemId)
    .filter((id): id is string => typeof id === "string");
  const equipmentCatalog = equipmentItemIds.length
    ? ((await query(
        db
          .from("equipment_catalog_items")
          .select("id,name,rarity,slot_type")
          .in("id", equipmentItemIds),
        "équipement de consolation",
      )) ?? [])
    : [];
  const equipmentStock = equipmentItemIds.length
    ? ((await query(
        db
          .from("team_equipment_inventory")
          .select("equipment_item_id,quantity,last_purchase_price,updated_at")
          .eq("team_season_id", teamSeasons[0]?.id ?? "")
          .in("equipment_item_id", equipmentItemIds),
        "stock de consolation",
      )) ?? [])
    : [];
  const messages =
    (await query(
      db
        .from("sporting_director_messages")
        .select("id,subject,preview,action_href,is_important,sent_at,read_at")
        .eq("sporting_director_id", director.id)
        .like("source_reference", "race-incident-compensation:ruta-preparation-missing-stage-plan-20260928:%"),
      "courrier de compensation Ruta",
    )) ?? [];

  console.log(
    JSON.stringify(
      {
        director,
        assignments,
        season,
        teamSeasons,
        rewards,
        grants,
        inventory,
        equipmentCatalog,
        equipmentStock,
        messages,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
