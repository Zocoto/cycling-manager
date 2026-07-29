import { config } from "dotenv";
import { createClient, type User } from "@supabase/supabase-js";

import {
  ALPHA_BOT_PROFILES,
  type AlphaBotProfile,
} from "../lib/game/alpha-bots";
import { generateInitialRiderIdentities } from "../lib/rider-names/generate-rider-identities";

config({ path: ".env.local" });
config();

const supabaseUrl = readEnvironment("NEXT_PUBLIC_SUPABASE_URL");
const publishableKey = readEnvironment(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
);
const serviceKey = readEnvironment("SUPABASE_SECRET_KEY");

const admin = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
});

async function main() {
  const results = [];
  for (const profile of ALPHA_BOT_PROFILES) {
    results.push(await provisionProfile(profile));
  }
  console.table(results);
}

async function provisionProfile(profile: AlphaBotProfile) {
  const user = await findOrCreateBotUser(profile);
  const client = await createAuthenticatedClient(user);

  const countryResult = await client
    .from("countries")
    .select("id")
    .eq("iso_alpha2", profile.countryCode)
    .eq("is_active", true)
    .maybeSingle<{ id: string }>();
  assertQuery(countryResult.error, `pays ${profile.countryCode}`);
  if (!countryResult.data) {
    throw new Error(`Pays ${profile.countryCode} introuvable.`);
  }

  const profileUpdate = await client
    .from("sporting_directors")
    .update({
      display_name: profile.managerName,
      country_id: countryResult.data.id,
      avatar_key: profile.avatarKey,
      is_email_visible: false,
    })
    .eq("auth_user_id", user.id)
    .eq("status", "active");
  assertQuery(profileUpdate.error, `profil ${profile.managerName}`);

  const generationProfile = await client
    .rpc("get_rider_generation_profile_for_country", {
      p_country_id: countryResult.data.id,
    })
    .maybeSingle<{
      name_profile_code: string;
      avatar_profile_key: string;
    }>();
  assertQuery(
    generationProfile.error,
    `profil de génération ${profile.countryCode}`,
  );
  if (!generationProfile.data) {
    throw new Error(
      `Profil de génération absent pour ${profile.countryCode}.`,
    );
  }

  const careerResult = await client.rpc(
    "initialize_sporting_director_career_v2",
    {
      p_rider_identities: generateInitialRiderIdentities(
        generationProfile.data.name_profile_code,
      ),
      p_team_name: profile.teamName,
      p_team_country_id: countryResult.data.id,
      p_jersey_pattern: profile.jersey.pattern,
      p_jersey_primary_color: profile.jersey.primary,
      p_jersey_secondary_color: profile.jersey.secondary,
      p_jersey_accent_color: profile.jersey.accent,
    },
  );
  assertQuery(careerResult.error, `carrière ${profile.teamName}`);

  const directorResult = await admin
    .from("sporting_directors")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("status", "active")
    .maybeSingle<{ id: string }>();
  assertQuery(directorResult.error, `directeur ${profile.managerName}`);
  if (!directorResult.data) {
    throw new Error(`Directeur ${profile.managerName} introuvable.`);
  }

  const assignmentResult = await admin
    .from("team_manager_assignments")
    .select("team_id")
    .eq("sporting_director_id", directorResult.data.id)
    .eq("role", "general_manager")
    .eq("status", "active")
    .maybeSingle<{ team_id: string }>();
  assertQuery(assignmentResult.error, `équipe ${profile.teamName}`);
  if (!assignmentResult.data) {
    throw new Error(`Équipe ${profile.teamName} introuvable.`);
  }

  const registryResult = await admin.from("alpha_bot_managers").upsert(
    {
      bot_key: profile.key,
      auth_user_id: user.id,
      sporting_director_id: directorResult.data.id,
      team_id: assignmentResult.data.team_id,
      display_name: profile.managerName,
      strategy: profile.strategy,
      enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "bot_key" },
  );
  assertQuery(registryResult.error, `registre ${profile.managerName}`);

  return {
    manager: profile.managerName,
    team: profile.teamName,
    country: profile.countryCode,
    strategy: profile.strategy,
    userId: user.id,
  };
}

async function findOrCreateBotUser(profile: AlphaBotProfile) {
  const existing = await findUserByEmail(profile.email);
  if (existing) {
    if (existing.app_metadata.alpha_bot !== true) {
      throw new Error(
        `Le compte ${profile.email} existe sans marqueur interne alpha_bot.`,
      );
    }
    const update = await admin.auth.admin.updateUserById(existing.id, {
      app_metadata: {
        ...existing.app_metadata,
        alpha_bot: true,
        alpha_bot_key: profile.key,
      },
      user_metadata: {
        ...existing.user_metadata,
        manager_name: profile.managerName,
      },
    });
    if (update.error) throw update.error;
    return update.data.user;
  }

  const created = await admin.auth.admin.createUser({
    email: profile.email,
    email_confirm: true,
    app_metadata: {
      alpha_bot: true,
      alpha_bot_key: profile.key,
    },
    user_metadata: {
      manager_name: profile.managerName,
    },
  });
  if (created.error || !created.data.user) {
    throw new Error(
      `Création de ${profile.managerName} impossible : ${created.error?.message ?? "utilisateur absent"}`,
    );
  }
  return created.data.user;
}

async function findUserByEmail(email: string) {
  for (let page = 1; page <= 20; page += 1) {
    const result = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (result.error) throw result.error;
    const user = result.data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase(),
    );
    if (user) return user;
    if (result.data.users.length < 1000) return null;
  }
  throw new Error("La recherche des comptes alpha a dépassé 20 pages.");
}

async function createAuthenticatedClient(user: User) {
  if (!user.email) throw new Error(`Adresse absente pour ${user.id}.`);
  const linkResult = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });
  const tokenHash = linkResult.data.properties?.hashed_token;
  if (linkResult.error || !tokenHash) {
    throw new Error(
      `Session impossible pour ${user.email} : ${linkResult.error?.message ?? "jeton absent"}`,
    );
  }

  const client = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const verification = await client.auth.verifyOtp({
    type: "email",
    token_hash: tokenHash,
  });
  if (verification.error || verification.data.user?.id !== user.id) {
    throw new Error(
      `Authentification impossible pour ${user.email} : ${verification.error?.message ?? "identité incohérente"}`,
    );
  }
  return client;
}

function assertQuery(
  error: { message: string } | null,
  operation: string,
) {
  if (error) {
    throw new Error(`Échec de ${operation} : ${error.message}`);
  }
}

function readEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variable ${name} absente.`);
  return value;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
