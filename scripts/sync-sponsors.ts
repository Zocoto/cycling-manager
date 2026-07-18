import process from "node:process";

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import { SPONSORS } from "../data/sponsors";

config({
  path: ".env.local",
});

const BATCH_SIZE = 250;

type CountryRow = {
  id: string;
  iso_alpha2: string;
};

type SponsorRegistryRow = {
  catalog_key: string;
  country_id: string;
  name: string;
  short_name: string;
  industry: string;
  status: "active";
};

function getRequiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `La variable d’environnement ${name} est absente ou vide.`
    );
  }

  return value;
}

function validateSponsorCatalog(): void {
  const encounteredSponsorIds = new Set<string>();

  for (const sponsor of SPONSORS) {
    const normalizedSponsorId = sponsor.id
      .trim()
      .toLowerCase();

    if (sponsor.id !== normalizedSponsorId) {
      throw new Error(
        `La clé du sponsor "${sponsor.name}" doit être normalisée en minuscules : ${sponsor.id}.`
      );
    }

    if (encounteredSponsorIds.has(normalizedSponsorId)) {
      throw new Error(
        `La clé sponsor "${normalizedSponsorId}" est présente plusieurs fois dans le catalogue.`
      );
    }

    encounteredSponsorIds.add(normalizedSponsorId);
  }
}

function splitIntoBatches<T>(
  values: readonly T[],
  batchSize: number
): T[][] {
  const batches: T[][] = [];

  for (
    let startIndex = 0;
    startIndex < values.length;
    startIndex += batchSize
  ) {
    batches.push(
      values.slice(startIndex, startIndex + batchSize)
    );
  }

  return batches;
}

async function synchronizeSponsors(): Promise<void> {
  validateSponsorCatalog();

  const supabaseUrl = getRequiredEnvironmentVariable(
    "NEXT_PUBLIC_SUPABASE_URL"
  );

  const supabaseSecretKey = getRequiredEnvironmentVariable(
    "SUPABASE_SECRET_KEY"
  );

  const supabase = createClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );

  const requiredCountryCodes = [
    ...new Set(
      SPONSORS.map((sponsor) =>
        sponsor.countryCode.trim().toUpperCase()
      )
    ),
  ];

  const {
    data: countries,
    error: countriesError,
  } = await supabase
    .from("countries")
    .select("id, iso_alpha2")
    .in("iso_alpha2", requiredCountryCodes)
    .eq("is_active", true)
    .returns<CountryRow[]>();

  if (countriesError) {
    throw new Error(
      `Impossible de récupérer les pays : ${countriesError.message}`
    );
  }

  const countryIdByCode = new Map(
    (countries ?? []).map((country) => [
      country.iso_alpha2.trim().toUpperCase(),
      country.id,
    ])
  );

  const missingCountryCodes = requiredCountryCodes.filter(
    (countryCode) => !countryIdByCode.has(countryCode)
  );

  if (missingCountryCodes.length > 0) {
    throw new Error(
      `Pays absents ou inactifs dans Supabase : ${missingCountryCodes.join(
        ", "
      )}.`
    );
  }

  const sponsorRows: SponsorRegistryRow[] = SPONSORS.map(
    (sponsor) => {
      const countryCode = sponsor.countryCode
        .trim()
        .toUpperCase();

      const countryId = countryIdByCode.get(countryCode);

      if (!countryId) {
        throw new Error(
          `Aucun identifiant Supabase trouvé pour le pays ${countryCode}.`
        );
      }

      return {
        catalog_key: sponsor.id,
        country_id: countryId,
        name: sponsor.name,
        short_name: sponsor.shortName,
        industry: sponsor.sector,
        status: "active",
      };
    }
  );

  const batches = splitIntoBatches(
    sponsorRows,
    BATCH_SIZE
  );

  let synchronizedSponsorCount = 0;

  for (const [batchIndex, batch] of batches.entries()) {
    const { error: upsertError } = await supabase
      .from("sponsors")
      .upsert(batch, {
        onConflict: "catalog_key",
      });

    if (upsertError) {
      throw new Error(
        `Échec du lot ${batchIndex + 1}/${batches.length} : ${upsertError.message}`
      );
    }

    synchronizedSponsorCount += batch.length;

    console.log(
      `Lot ${batchIndex + 1}/${batches.length} synchronisé : ${batch.length} sponsor(s).`
    );
  }

  console.log("");
  console.log("Synchronisation des sponsors terminée.");
  console.log(
    `${synchronizedSponsorCount} sponsor(s) créé(s) ou mis à jour.`
  );
  console.log(
    "Les sponsors absents du catalogue n’ont pas été supprimés afin de préserver l’historique des offres et contrats."
  );
}

async function main(): Promise<void> {
  try {
    await synchronizeSponsors();
  } catch (error) {
    console.error("");
    console.error(
      "Échec de la synchronisation des sponsors."
    );

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }

    process.exitCode = 1;
  }
}

void main();