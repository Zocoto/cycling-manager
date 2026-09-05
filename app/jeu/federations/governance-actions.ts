"use server";

import { refresh, revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FederationGovernanceActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const countryCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/);
const manifestoSchema = z.string().trim().min(40).max(800);
const candidateIdSchema = z.string().uuid();
const hostingEventTypeSchema = z.enum([
  "world_championship_pro",
  "continental_championship_pro",
  "nations_cup_pro",
  "world_championship_junior",
  "continental_championship_junior",
  "nations_cup_junior",
]);
const raceNameSchema = z.string().trim().min(4).max(80);
const raceShortNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(12)
  .regex(/^[\p{L}\p{N} -]+$/u);

const raceSegmentSchema = z
  .object({
    distanceKm: z.number().min(2).max(250),
    terrainType: z.enum(["flat", "climb", "descent"]),
    surfaceType: z.enum(["asphalt", "cobbles"]),
    averageGradientPct: z.number().min(-30).max(30),
  })
  .superRefine((segment, context) => {
    const validGradient =
      (segment.terrainType === "flat" && segment.averageGradientPct === 0) ||
      (segment.terrainType === "climb" && segment.averageGradientPct > 0) ||
      (segment.terrainType === "descent" && segment.averageGradientPct < 0);
    if (!validGradient) {
      context.addIssue({
        code: "custom",
        path: ["averageGradientPct"],
        message: "La pente doit correspondre au relief choisi.",
      });
    }
  });

const raceStageSchema = z
  .object({
    name: z.string().trim().min(3).max(80),
    stageType: z.enum([
      "road",
      "individual_time_trial",
      "team_time_trial",
      "prologue",
    ]),
    profileType: z.enum([
      "flat",
      "sprint",
      "hilly",
      "mountain",
      "cobbles",
      "time_trial",
      "mixed",
    ]),
    segments: z.array(raceSegmentSchema).min(1).max(12),
  })
  .superRefine((stage, context) => {
    const distance = stage.segments.reduce(
      (total, segment) => total + segment.distanceKm,
      0,
    );
    if (distance < 5 || distance > 350) {
      context.addIssue({
        code: "custom",
        path: ["segments"],
        message: "Une étape doit mesurer entre 5 et 350 km.",
      });
    }
    const isTimed =
      stage.stageType === "individual_time_trial" ||
      stage.stageType === "team_time_trial" ||
      stage.stageType === "prologue";
    if (isTimed !== (stage.profileType === "time_trial")) {
      context.addIssue({
        code: "custom",
        path: ["profileType"],
        message: "Une épreuve chronométrée doit utiliser le profil chrono.",
      });
    }
    if (stage.stageType === "prologue" && distance > 30) {
      context.addIssue({
        code: "custom",
        path: ["segments"],
        message: "Un prologue ne peut pas dépasser 30 km.",
      });
    }
  });

const raceBlueprintSchema = z
  .object({
    raceFormat: z.enum(["one_day", "stage_race"]),
    categoryCode: z.enum(["continental", "national", "regional"]),
    startDay: z.number().int().min(1).max(28),
    startSlot: z.enum(["early", "late"]),
    stages: z.array(raceStageSchema).min(1).max(8),
  })
  .superRefine((blueprint, context) => {
    if (blueprint.raceFormat === "one_day" && blueprint.stages.length !== 1) {
      context.addIssue({
        code: "custom",
        path: ["stages"],
        message: "Une classique doit comporter une seule étape.",
      });
    }
    if (blueprint.raceFormat === "stage_race" && blueprint.stages.length < 2) {
      context.addIssue({
        code: "custom",
        path: ["stages"],
        message: "Un tour doit comporter au moins deux étapes.",
      });
    }
    const firstSlot =
      (blueprint.startDay - 1) * 2 + (blueprint.startSlot === "late" ? 1 : 0);
    if (firstSlot + blueprint.stages.length - 1 > 55) {
      context.addIssue({
        code: "custom",
        path: ["startDay"],
        message: "Le parcours dépasse la J28.",
      });
    }
  });

export async function submitFederationCandidacyAction(
  _previousState: FederationGovernanceActionState,
  formData: FormData,
): Promise<FederationGovernanceActionState> {
  const countryCode = countryCodeSchema.safeParse(formData.get("countryCode"));
  const manifesto = manifestoSchema.safeParse(formData.get("manifesto"));
  if (!countryCode.success || !manifesto.success) {
    return {
      status: "error",
      message: "La profession de foi doit contenir entre 40 et 800 caractères.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();
  if (authenticationError || !user) {
    return { status: "error", message: "Votre session a expiré." };
  }

  const result = await supabase.rpc(
    "submit_national_federation_candidacy",
    {
      p_country_code: countryCode.data,
      p_manifesto: manifesto.data.replace(/\s+/g, " "),
    },
  );
  if (result.error) {
    console.error("Échec de candidature fédérale :", {
      code: result.error.code,
      message: result.error.message,
    });
    return {
      status: "error",
      message: result.error.message || "La candidature n’a pas été enregistrée.",
    };
  }

  revalidatePath(`/jeu/federations/${countryCode.data.toLowerCase()}`);
  refresh();
  return {
    status: "success",
    message:
      "Votre candidature est déposée et visible par tous les membres de la fédération.",
  };
}

export async function voteFederationPresidentAction(
  _previousState: FederationGovernanceActionState,
  formData: FormData,
): Promise<FederationGovernanceActionState> {
  const countryCode = countryCodeSchema.safeParse(formData.get("countryCode"));
  const candidateId = candidateIdSchema.safeParse(formData.get("candidateId"));
  if (!countryCode.success || !candidateId.success) {
    return { status: "error", message: "Sélectionnez une candidature valide." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();
  if (authenticationError || !user) {
    return { status: "error", message: "Votre session a expiré." };
  }

  const result = await supabase.rpc("vote_national_federation_president", {
    p_country_code: countryCode.data,
    p_candidate_id: candidateId.data,
  });
  if (result.error) {
    console.error("Échec de vote fédéral :", {
      code: result.error.code,
      message: result.error.message,
    });
    return {
      status: "error",
      message: result.error.message || "Votre vote n’a pas été enregistré.",
    };
  }

  revalidatePath(`/jeu/federations/${countryCode.data.toLowerCase()}`);
  return {
    status: "success",
    message: "Votre voix est enregistrée. Vous pouvez la modifier jusqu’à J28.",
  };
}

export async function createFederationRaceAction(
  _previousState: FederationGovernanceActionState,
  formData: FormData,
): Promise<FederationGovernanceActionState> {
  const countryCode = countryCodeSchema.safeParse(formData.get("countryCode"));
  const name = raceNameSchema.safeParse(formData.get("name"));
  const shortName = raceShortNameSchema.safeParse(formData.get("shortName"));
  const rawBlueprint = formData.get("blueprint");
  let decodedBlueprint: unknown = null;
  try {
    decodedBlueprint =
      typeof rawBlueprint === "string" && rawBlueprint.length <= 40_000
        ? JSON.parse(rawBlueprint)
        : null;
  } catch {
    decodedBlueprint = null;
  }
  const blueprint = raceBlueprintSchema.safeParse(decodedBlueprint);
  if (
    !countryCode.success ||
    !name.success ||
    !shortName.success ||
    !blueprint.success
  ) {
    return {
      status: "error",
      message:
        blueprint.error?.issues[0]?.message ??
        "Le dossier de course est incomplet ou contient une valeur invalide.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();
  if (authenticationError || !user) {
    return { status: "error", message: "Votre session a expiré." };
  }

  const result = await supabase.rpc("create_national_federation_race", {
    p_country_code: countryCode.data,
    p_name: name.data.replace(/\s+/g, " "),
    p_short_name: shortName.data.replace(/\s+/g, " ").toUpperCase(),
    p_race_format: blueprint.data.raceFormat,
    p_category_code: blueprint.data.categoryCode,
    p_start_day_number: blueprint.data.startDay,
    p_start_day_slot: blueprint.data.startSlot,
    p_stage_blueprint: blueprint.data.stages,
  });
  if (result.error) {
    console.error("Échec de création de course fédérale :", {
      code: result.error.code,
      message: result.error.message,
    });
    return {
      status: "error",
      message:
        result.error.message || "Le dossier de course n’a pas été enregistré.",
    };
  }

  revalidatePath(`/jeu/federations/${countryCode.data.toLowerCase()}`);
  revalidatePath("/jeu/calendrier");
  refresh();
  return {
    status: "success",
    message:
      "La course est homologuée et programmée au calendrier de la saison suivante.",
  };
}

export async function submitFederationHostingCandidacyAction(
  _previousState: FederationGovernanceActionState,
  formData: FormData,
): Promise<FederationGovernanceActionState> {
  const countryCode = countryCodeSchema.safeParse(formData.get("countryCode"));
  const eventType = hostingEventTypeSchema.safeParse(formData.get("eventType"));
  if (!countryCode.success || !eventType.success) {
    return { status: "error", message: "Cette candidature d’accueil est invalide." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();
  if (authenticationError || !user) {
    return { status: "error", message: "Votre session a expiré." };
  }

  const result = await supabase.rpc(
    "submit_national_federation_hosting_candidacy",
    {
      p_country_code: countryCode.data,
      p_event_type: eventType.data,
    },
  );
  if (result.error) {
    console.error("Échec de la candidature d’accueil fédérale :", {
      code: result.error.code,
      message: result.error.message,
    });
    return {
      status: "error",
      message: result.error.message || "La candidature d’accueil n’a pas été enregistrée.",
    };
  }

  revalidatePath(`/jeu/federations/${countryCode.data.toLowerCase()}`);
  refresh();
  return {
    status: "success",
    message:
      "La candidature est publique. Le coût ne sera débité que si le pays est retenu.",
  };
}
