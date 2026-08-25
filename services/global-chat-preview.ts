import "server-only";

import { SPONSORS } from "@/data/sponsors";
import type { GlobalChatPreviewReference } from "@/lib/game/global-chat";
import type {
  RiderJerseyAppearance,
  RiderJerseyPattern,
} from "@/lib/rider-jersey";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type GlobalChatPreviewPalette = {
  teamId: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  jerseyPattern: RiderJerseyPattern;
  jerseyStatus: RiderJerseyAppearance["status"];
};

type TeamRow = {
  amateur_jersey_pattern: string;
  amateur_jersey_primary_color: string;
  amateur_jersey_secondary_color: string;
  amateur_jersey_accent_color: string;
};

type SponsorContractRow = {
  sponsor_id: string;
  selected_jersey_id: string | null;
};

const FREE_AGENT_PALETTE: GlobalChatPreviewPalette = {
  teamId: null,
  primaryColor: "#6B7280",
  secondaryColor: "#D1D5DB",
  accentColor: "#F3F4F6",
  jerseyPattern: "solid",
  jerseyStatus: "free-agent",
};

export async function resolveGlobalChatPreviewPalette(
  reference: GlobalChatPreviewReference,
): Promise<GlobalChatPreviewPalette | null> {
  const supabase = createSupabaseAdminClient();
  const teamId = await resolvePreviewTeamId(supabase, reference);

  if (!teamId) {
    return reference.type === "rider" ? FREE_AGENT_PALETTE : null;
  }

  const [teamResult, sponsorContractResult] = await Promise.all([
    supabase
      .from("teams")
      .select(
        "amateur_jersey_pattern, amateur_jersey_primary_color, amateur_jersey_secondary_color, amateur_jersey_accent_color",
      )
      .eq("id", teamId)
      .maybeSingle<TeamRow>(),
    supabase
      .from("team_sponsor_contracts")
      .select("sponsor_id, selected_jersey_id")
      .eq("team_id", teamId)
      .eq("role", "principal")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<SponsorContractRow>(),
  ]);

  assertQuery(teamResult.error, "les couleurs de l’équipe partagée");
  assertQuery(
    sponsorContractResult.error,
    "le sponsor de l’équipe partagée",
  );

  const contract = sponsorContractResult.data;
  if (contract) {
    const sponsorResult = await supabase
      .from("sponsors")
      .select("catalog_key")
      .eq("id", contract.sponsor_id)
      .maybeSingle<{ catalog_key: string }>();
    assertQuery(sponsorResult.error, "l’identité du sponsor partagé");

    const sponsor = SPONSORS.find(
      (candidate) => candidate.id === sponsorResult.data?.catalog_key,
    );
    const jersey = sponsor?.jerseys.find(
      (candidate) => candidate.id === contract.selected_jersey_id,
    );

    if (sponsor) {
      return {
        teamId,
        primaryColor: sponsor.colors.primary,
        secondaryColor: sponsor.colors.secondary,
        accentColor: sponsor.colors.accent,
        jerseyPattern: mapSponsorJerseyStyle(jersey?.style),
        jerseyStatus: "sponsored",
      };
    }
  }

  const team = teamResult.data;
  if (!team) return null;

  return {
    teamId,
    primaryColor: team.amateur_jersey_primary_color,
    secondaryColor: team.amateur_jersey_secondary_color,
    accentColor: team.amateur_jersey_accent_color,
    jerseyPattern: mapAmateurJerseyPattern(team.amateur_jersey_pattern),
    jerseyStatus: "amateur",
  };
}

async function resolvePreviewTeamId(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  reference: GlobalChatPreviewReference,
) {
  if (reference.type === "team") return reference.entityId;

  if (reference.type === "rider") {
    const contractResult = await supabase
      .from("rider_contracts")
      .select("team_id")
      .eq("rider_id", reference.entityId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle<{ team_id: string }>();
    assertQuery(contractResult.error, "l’équipe du coureur partagé");
    return contractResult.data?.team_id ?? null;
  }

  const directorQuery = supabase
    .from("sporting_directors")
    .select("id")
    .eq("status", "active");
  const directorResult = isUuid(reference.entityId)
    ? await directorQuery.eq("id", reference.entityId).maybeSingle<{ id: string }>()
    : await directorQuery
        .eq("username", reference.entityId)
        .maybeSingle<{ id: string }>();
  assertQuery(directorResult.error, "le Directeur Sportif partagé");

  if (!directorResult.data) return null;

  const assignmentResult = await supabase
    .from("team_manager_assignments")
    .select("team_id")
    .eq("sporting_director_id", directorResult.data.id)
    .eq("role", "general_manager")
    .eq("status", "active")
    .limit(1)
    .maybeSingle<{ team_id: string }>();
  assertQuery(assignmentResult.error, "l’équipe du Directeur Sportif partagé");

  return assignmentResult.data?.team_id ?? null;
}

function mapSponsorJerseyStyle(style: string | undefined): RiderJerseyPattern {
  if (style === "modern") return "diagonal";
  if (style === "bold") return "split";
  return "hoops";
}

function mapAmateurJerseyPattern(value: string): RiderJerseyPattern {
  return value === "classic" ? "center" : isRiderJerseyPattern(value) ? value : "solid";
}

function isRiderJerseyPattern(value: string): value is RiderJerseyPattern {
  return [
    "center",
    "diagonal",
    "hoops",
    "solid",
    "split",
    "vertical",
    "chevron",
    "quarters",
    "cross",
    "shoulders",
    "checkerboard",
    "wave",
    "pinstripes",
  ].includes(value);
}

function assertQuery(
  error: { message: string } | null,
  label: string,
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${label} : ${error.message}`);
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
