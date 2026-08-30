import "server-only";

import {
  RIDER_INJURY_DIAGNOSES,
  type RiderInjuryDiagnosisCode,
} from "@/lib/game/health-center";
import {
  getParisDateKey,
  type CyclogazetteFeatureStory,
} from "@/lib/game/cyclogazette";
import { calculateNationRiderOverall } from "@/lib/game/nation-rider-ranking";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type EditorialContext = {
  seasonId: string;
  dayNumber: number;
  calendarDate: string;
};

type PreviewStageRow = {
  id: string;
  race_edition_id: string;
  stage_number: number;
  name: string;
};

type PreviewEditionRow = {
  id: string;
  race_category_id: string;
  display_name: string;
  races: { slug: string } | null;
};

type PreviewRegistrationRow = {
  id: string;
  race_edition_id: string;
  team_season_id: string | null;
  historical_team_name: string | null;
};

type PreviewRosterRow = {
  race_registration_id: string;
  rider_id: string;
};

type PreviewTeamSeasonRow = { id: string; display_name: string };
type PreviewRiderRow = { id: string; first_name: string; last_name: string };
type PreviewCategoryRow = { id: string; prestige_rank: number };

type PreviewRatingRow = {
  rider_id: string;
  mountain: number;
  hills: number;
  flat: number;
  time_trial: number;
  cobbles: number;
  sprint: number;
  acceleration: number;
  downhill: number;
  endurance: number;
  resistance: number;
  recovery: number;
  breakaway: number;
  prologue: number;
};

type DevelopmentEditionRow = {
  id: string;
  name: string;
  slug: string;
  end_day_number: number;
};

type DevelopmentResultRow = {
  race_edition_id: string;
  academy_rider_id: string | null;
  development_team_id: string | null;
  rider_name: string;
  team_name: string;
  rank: number;
  points: number;
};

type TransferRumorRow = {
  id: string;
  rider_id: string;
  buyer_team_id: string;
  seller_team_id: string;
  created_at: string;
};

type RumorRiderRow = { id: string; first_name: string; last_name: string };
type RumorTeamRow = { team_id: string; display_name: string };

type InjuryRow = {
  id: string;
  rider_id: string;
  diagnosis_code: string;
  source_stage_id: string | null;
  started_at: string;
  expected_recovery_at: string;
};

type InjuryRiderRow = { id: string; first_name: string; last_name: string };
type InjuryContractRow = { rider_id: string; team_id: string };
type InjuryTeamRow = { team_id: string; display_name: string };
type InjuryStageRow = {
  id: string;
  name: string;
  race_editions: { display_name: string } | null;
};

export async function loadCyclogazetteFeatureStories(
  admin: AdminClient,
  context: EditorialContext,
): Promise<CyclogazetteFeatureStory[]> {
  const results = await Promise.allSettled([
    loadStartlistPreviews(admin, context),
    loadDevelopmentStories(admin, context),
    loadTransferRumors(admin, context),
    loadInjuryChronicle(admin, context),
  ]);

  const storyGroups = results.map((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
  const stories: CyclogazetteFeatureStory[] = [];

  for (let index = 0; stories.length < 6; index += 1) {
    const nextStories = storyGroups.flatMap((group) => group[index] ?? []);
    if (nextStories.length === 0) break;
    stories.push(...nextStories.slice(0, 6 - stories.length));
  }

  return stories;
}

async function loadStartlistPreviews(
  admin: AdminClient,
  context: EditorialContext,
): Promise<CyclogazetteFeatureStory[]> {
  const nextDayResult = await admin
    .from("season_days")
    .select("id, day_number")
    .eq("season_id", context.seasonId)
    .eq("day_number", context.dayNumber + 1)
    .maybeSingle<{ id: string; day_number: number }>();
  if (nextDayResult.error || !nextDayResult.data) return [];

  const stagesResult = await admin
    .from("stages")
    .select("id, race_edition_id, stage_number, name")
    .eq("season_day_id", nextDayResult.data.id)
    .returns<PreviewStageRow[]>();
  const stages = stagesResult.data ?? [];
  const editionIds = unique(stages.map((stage) => stage.race_edition_id));
  if (stagesResult.error || editionIds.length === 0) return [];

  const [editionsResult, registrationsResult, categoriesResult] =
    await Promise.all([
      admin
        .from("race_editions")
        .select("id, race_category_id, display_name, races(slug)")
        .in("id", editionIds)
        .returns<PreviewEditionRow[]>(),
      admin
        .from("race_registrations")
        .select(
          "id, race_edition_id, team_season_id, historical_team_name",
        )
        .in("race_edition_id", editionIds)
        .eq("status", "accepted")
        .returns<PreviewRegistrationRow[]>(),
      admin
        .from("race_categories")
        .select("id, prestige_rank")
        .returns<PreviewCategoryRow[]>(),
    ]);
  if (editionsResult.error || registrationsResult.error) return [];

  const registrations = (registrationsResult.data ?? []).filter(
    (registration) => registration.team_season_id,
  );
  if (registrations.length === 0) return [];

  const [rostersResult, teamSeasonsResult] = await Promise.all([
    admin
      .from("race_rosters")
      .select("race_registration_id, rider_id")
      .in(
        "race_registration_id",
        registrations.map((registration) => registration.id),
      )
      .in("status", ["selected", "confirmed"])
      .returns<PreviewRosterRow[]>(),
    admin
      .from("team_seasons")
      .select("id, display_name")
      .in(
        "id",
        unique(
          registrations.flatMap((registration) =>
            registration.team_season_id
              ? [registration.team_season_id]
              : [],
          ),
        ),
      )
      .returns<PreviewTeamSeasonRow[]>(),
  ]);
  const rosters = rostersResult.data ?? [];
  const riderIds = unique(rosters.map((roster) => roster.rider_id));
  if (rostersResult.error || riderIds.length === 0) return [];

  const [ridersResult, ratingsResult] = await Promise.all([
    admin
      .from("riders")
      .select("id, first_name, last_name")
      .in("id", riderIds)
      .returns<PreviewRiderRow[]>(),
    admin
      .from("rider_season_ratings")
      .select(
        "rider_id, mountain, hills, flat, time_trial, cobbles, sprint, acceleration, downhill, endurance, resistance, recovery, breakaway, prologue",
      )
      .eq("season_id", context.seasonId)
      .in("rider_id", riderIds)
      .returns<PreviewRatingRow[]>(),
  ]);
  if (ridersResult.error || ratingsResult.error) return [];

  const riderById = toMap(ridersResult.data ?? []);
  const ratingByRiderId = new Map(
    (ratingsResult.data ?? []).map((rating) => [
      rating.rider_id,
      calculateNationRiderOverall({
        mountain: Number(rating.mountain),
        hills: Number(rating.hills),
        flat: Number(rating.flat),
        timeTrial: Number(rating.time_trial),
        cobbles: Number(rating.cobbles),
        sprint: Number(rating.sprint),
        acceleration: Number(rating.acceleration),
        downhill: Number(rating.downhill),
        endurance: Number(rating.endurance),
        resistance: Number(rating.resistance),
        recovery: Number(rating.recovery),
        breakaway: Number(rating.breakaway),
        prologue: Number(rating.prologue),
      }),
    ]),
  );
  const registrationById = toMap(registrations);
  const teamSeasonById = toMap(teamSeasonsResult.data ?? []);
  const categoryById = toMap(categoriesResult.data ?? []);
  const editions = [...(editionsResult.data ?? [])].sort(
    (left, right) =>
      (categoryById.get(left.race_category_id)?.prestige_rank ?? 99) -
        (categoryById.get(right.race_category_id)?.prestige_rank ?? 99) ||
      left.display_name.localeCompare(right.display_name, "fr"),
  );

  return editions.flatMap((edition): CyclogazetteFeatureStory[] => {
    const contenders = rosters
      .flatMap((roster) => {
        const registration = registrationById.get(
          roster.race_registration_id,
        );
        if (registration?.race_edition_id !== edition.id) return [];
        const rider = riderById.get(roster.rider_id);
        const overall = ratingByRiderId.get(roster.rider_id);
        const team = registration.team_season_id
          ? teamSeasonById.get(registration.team_season_id)
          : null;
        if (!rider || overall === undefined || !team) return [];
        return [
          {
            riderName: `${rider.first_name} ${rider.last_name}`,
            teamName: team.display_name,
            overall,
          },
        ];
      })
      .sort((left, right) => right.overall - left.overall)
      .slice(0, 3);
    const favorite = contenders[0];
    if (!favorite || favorite.overall < 65) return [];

    const supportingNames = contenders
      .slice(1)
      .map((contender) => `${contender.riderName} (${contender.teamName})`);
    const frenchOpposition = supportingNames.length
      ? ` Derrière, ${formatList(supportingNames)} forment l’opposition la plus sérieuse.`
      : " Son nom domine nettement les débats avant même le départ.";
    const englishOpposition = supportingNames.length
      ? ` Behind, ${formatEnglishList(supportingNames)} lead the most serious opposition.`
      : " The name already stands clearly above the field before the start.";

    return [
      {
        id: `startlist:${edition.id}:${context.dayNumber + 1}`,
        kind: "startlist",
        kicker: `Start-list · J${context.dayNumber + 1}`,
        kickerEn: `Start list · Day ${context.dayNumber + 1}`,
        title: `${favorite.teamName} sort l’artillerie lourde sur ${edition.display_name}`,
        titleEn: `${favorite.teamName} brings the heavy artillery to ${edition.display_name}`,
        body: `${favorite.riderName}, l’un des coureurs les plus complets du plateau, sera la tête d’affiche de la sélection.${frenchOpposition}`,
        bodyEn: `${favorite.riderName}, one of the strongest all-round riders in the field, headlines the selection.${englishOpposition}`,
        href: edition.races?.slug
          ? `/jeu/courses/${edition.races.slug}`
          : "/jeu/calendrier",
      },
    ];
  }).slice(0, 2);
}

async function loadDevelopmentStories(
  admin: AdminClient,
  context: EditorialContext,
): Promise<CyclogazetteFeatureStory[]> {
  const editionsResult = await admin
    .from("development_race_editions")
    .select("id, name, slug, end_day_number")
    .eq("season_id", context.seasonId)
    .eq("status", "completed")
    .order("end_day_number", { ascending: false })
    .returns<DevelopmentEditionRow[]>();
  const editions = editionsResult.data ?? [];
  if (editionsResult.error || editions.length === 0) return [];

  const resultsResult = await admin
    .from("development_race_results")
    .select(
      "race_edition_id, academy_rider_id, development_team_id, rider_name, team_name, rank, points",
    )
    .in(
      "race_edition_id",
      editions.map((edition) => edition.id),
    )
    .eq("result_scope", "general")
    .order("rank", { ascending: true })
    .limit(1000)
    .returns<DevelopmentResultRow[]>();
  if (resultsResult.error) return [];

  const results = resultsResult.data ?? [];
  const editionById = toMap(editions);
  const todaysWinners = results.filter(
    (result) =>
      result.rank === 1 &&
      editionById.get(result.race_edition_id)?.end_day_number ===
        context.dayNumber,
  );
  if (todaysWinners.length === 0) return [];

  const stories: CyclogazetteFeatureStory[] = todaysWinners
    .slice(0, 1)
    .map((winner) => {
      const edition = editionById.get(winner.race_edition_id)!;
      return {
        id: `development-win:${winner.race_edition_id}:${winner.academy_rider_id ?? winner.rider_name}`,
        kind: "development" as const,
        kicker: "La relève · DevTeam",
        kickerEn: "Next generation · Development team",
        title: `${winner.rider_name} fait gagner la jeunesse de ${winner.team_name}`,
        titleEn: `${winner.rider_name} delivers for ${winner.team_name}'s next generation`,
        body: `Le junior s’impose sur ${edition.name}. Une victoire qui confirme la qualité du travail de formation et place déjà son nom dans les carnets des observateurs.`,
        bodyEn: `The junior wins ${edition.name}. The result confirms the quality of the development programme and puts the rider firmly in the scouts' notebooks.`,
        href: winner.academy_rider_id
          ? `/jeu/centre-de-formation/development/${winner.academy_rider_id}`
          : "/jeu/centre-de-formation",
      };
    });

  const aggregateByRider = new Map<
    string,
    {
      riderId: string;
      riderName: string;
      teamName: string;
      wins: number;
      podiums: number;
      points: number;
    }
  >();
  for (const result of results) {
    if (!result.academy_rider_id || !result.development_team_id) continue;
    const current = aggregateByRider.get(result.academy_rider_id) ?? {
      riderId: result.academy_rider_id,
      riderName: result.rider_name,
      teamName: result.team_name,
      wins: 0,
      podiums: 0,
      points: 0,
    };
    if (result.rank === 1) current.wins += 1;
    if (result.rank <= 3) current.podiums += 1;
    current.points += Number(result.points);
    aggregateByRider.set(result.academy_rider_id, current);
  }
  const prospect = [...aggregateByRider.values()].sort(
    (left, right) =>
      right.wins - left.wins ||
      right.podiums - left.podiums ||
      right.points - left.points,
  )[0];
  if (prospect) {
    stories.push({
      id: `development-prospect:${prospect.riderId}:${context.dayNumber}`,
      kind: "development",
      kicker: "Le junior à suivre",
      kickerEn: "Junior to watch",
      title: `${prospect.riderName}, le nom qui revient dans toutes les conversations`,
      titleEn: `${prospect.riderName}, the name on everyone's lips`,
      body: `${prospect.wins} victoire${prospect.wins > 1 ? "s" : ""}, ${prospect.podiums} podiums et ${prospect.points} points : le coureur de ${prospect.teamName} est pour l’instant la valeur montante du circuit junior.`,
      bodyEn: `${prospect.wins} win${prospect.wins === 1 ? "" : "s"}, ${prospect.podiums} podiums and ${prospect.points} points: the ${prospect.teamName} rider is currently the leading prospect on the junior circuit.`,
      href: `/jeu/centre-de-formation/development/${prospect.riderId}`,
    });
  }

  return stories.slice(0, 2);
}

async function loadTransferRumors(
  admin: AdminClient,
  context: EditorialContext,
): Promise<CyclogazetteFeatureStory[]> {
  const offersResult = await admin
    .from("direct_transfer_offers")
    .select("id, rider_id, buyer_team_id, seller_team_id, created_at")
    .eq("season_id", context.seasonId)
    .in("status", ["pending", "rejected"])
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<TransferRumorRow[]>();
  const offers = (offersResult.data ?? []).filter(
    (offer) => getParisDateKey(offer.created_at) === context.calendarDate,
  );
  if (offersResult.error || offers.length === 0) return [];

  const [ridersResult, teamsResult] = await Promise.all([
    admin
      .from("riders")
      .select("id, first_name, last_name")
      .in("id", unique(offers.map((offer) => offer.rider_id)))
      .returns<RumorRiderRow[]>(),
    admin
      .from("team_seasons")
      .select("team_id, display_name")
      .eq("season_id", context.seasonId)
      .in(
        "team_id",
        unique(
          offers.flatMap((offer) => [
            offer.buyer_team_id,
            offer.seller_team_id,
          ]),
        ),
      )
      .returns<RumorTeamRow[]>(),
  ]);
  if (ridersResult.error || teamsResult.error) return [];

  const riderById = toMap(ridersResult.data ?? []);
  const teamById = new Map(
    (teamsResult.data ?? []).map((team) => [team.team_id, team]),
  );

  return offers.flatMap((offer): CyclogazetteFeatureStory[] => {
    const rider = riderById.get(offer.rider_id);
    const buyer = teamById.get(offer.buyer_team_id);
    const seller = teamById.get(offer.seller_team_id);
    if (!rider || !buyer || !seller) return [];
    const riderName = `${rider.first_name} ${rider.last_name}`;
    return [
      {
        id: `transfer-rumor:${offer.id}`,
        kind: "transfer_rumor",
        kicker: "Rumeur du mercato",
        kickerEn: "Transfer rumour",
        title: `Ça discute autour de ${riderName}`,
        titleEn: `Talks are gathering around ${riderName}`,
        body: `Selon nos informations, ${buyer.display_name} a pris contact avec ${seller.display_name}. Aucun accord n’est annoncé : dans le paddock, les téléphones chauffent plus vite que les home-trainers.`,
        bodyEn: `Our sources say ${buyer.display_name} has contacted ${seller.display_name}. No agreement has been announced: in the paddock, the phones are running hotter than the turbo trainers.`,
        href: `/jeu/coureurs/${rider.id}`,
      },
    ];
  }).slice(0, 2);
}

async function loadInjuryChronicle(
  admin: AdminClient,
  context: EditorialContext,
): Promise<CyclogazetteFeatureStory[]> {
  const injuriesResult = await admin
    .from("rider_injuries")
    .select(
      "id, rider_id, diagnosis_code, source_stage_id, started_at, expected_recovery_at",
    )
    .eq("status", "active")
    .gt("expected_recovery_at", new Date().toISOString())
    .order("started_at", { ascending: false })
    .limit(20)
    .returns<InjuryRow[]>();
  const injuries = injuriesResult.data ?? [];
  if (injuriesResult.error || injuries.length === 0) return [];

  const todaysInjuries = injuries.filter(
    (injury) => getParisDateKey(injury.started_at) === context.calendarDate,
  );
  const pool = todaysInjuries.length > 0 ? todaysInjuries : injuries;
  const injury = pool[Math.abs(context.dayNumber) % pool.length];
  if (!injury) return [];

  const [ridersResult, contractsResult, stagesResult] = await Promise.all([
    admin
      .from("riders")
      .select("id, first_name, last_name")
      .eq("id", injury.rider_id)
      .returns<InjuryRiderRow[]>(),
    admin
      .from("rider_contracts")
      .select("rider_id, team_id")
      .eq("rider_id", injury.rider_id)
      .eq("status", "active")
      .returns<InjuryContractRow[]>(),
    injury.source_stage_id
      ? admin
          .from("stages")
          .select("id, name, race_editions(display_name)")
          .eq("id", injury.source_stage_id)
          .returns<InjuryStageRow[]>()
      : Promise.resolve({ data: [] as InjuryStageRow[], error: null }),
  ]);
  const rider = ridersResult.data?.[0];
  if (!rider || ridersResult.error) return [];

  const contract = contractsResult.data?.[0];
  const teamResult = contract
    ? await admin
        .from("team_seasons")
        .select("team_id, display_name")
        .eq("season_id", context.seasonId)
        .eq("team_id", contract.team_id)
        .maybeSingle<InjuryTeamRow>()
    : { data: null, error: null };
  const teamName = teamResult.data?.display_name ?? "son équipe";
  const riderName = `${rider.first_name} ${rider.last_name}`;
  const diagnosis = getDiagnosis(injury.diagnosis_code);
  const recoveryDays = Math.max(
    1,
    Math.ceil(
      (new Date(injury.expected_recovery_at).getTime() - Date.now()) /
        86_400_000,
    ),
  );
  const source = stagesResult.data?.[0];
  const raceName = source?.race_editions?.display_name;
  const template = Math.abs(context.dayNumber) % 3;
  const title =
    template === 0
      ? `${riderName} apprend la patience`
      : template === 1
        ? `Dans la roue de la convalescence de ${riderName}`
        : `${riderName}, des pansements et déjà l’envie de repartir`;
  const titleEn =
    template === 0
      ? `${riderName} learns the art of patience`
      : template === 1
        ? `Following ${riderName}'s road to recovery`
        : `${riderName}: bandages on, comeback already in mind`;
  const originFr = raceName
    ? ` Depuis sa mésaventure sur ${raceName},`
    : " Depuis l’arrêt forcé,";
  const originEn = raceName
    ? ` Since the mishap at ${raceName},`
    : " Since being forced off the bike,";

  return [
    {
      id: `injury-chronicle:${injury.id}:${context.dayNumber}`,
      kind: "injury",
      kicker: "Carnet de convalescence",
      kickerEn: "Recovery diary",
      title,
      titleEn,
      body: `${diagnosis.label} : le verdict a imposé une pause à ${riderName}.${originFr} ${teamName} protège son coureur, attendu de retour dans environ ${recoveryDays} jour${recoveryDays > 1 ? "s" : ""}. « Le vélo attendra ; l’impatience, elle, travaille déjà », souffle-t-on dans l’entourage.`,
      bodyEn: `${diagnosis.labelEn}: the verdict has forced ${riderName} to pause.${originEn} ${teamName} is looking after its rider, who is expected back in roughly ${recoveryDays} day${recoveryDays === 1 ? "" : "s"}. “The bike can wait; the impatience is already training,” says someone close to the team.`,
      href: `/jeu/coureurs/${rider.id}`,
    },
  ];
}

function getDiagnosis(code: string) {
  if (code in RIDER_INJURY_DIAGNOSES) {
    const diagnosis =
      RIDER_INJURY_DIAGNOSES[code as RiderInjuryDiagnosisCode];
    const english = {
      rib_fracture: "Rib fracture",
      wrist_fracture: "Wrist fracture",
      clavicle_fracture: "Collarbone fracture",
      fatigue_exhaustion: "Fatigue injury",
    } satisfies Record<RiderInjuryDiagnosisCode, string>;
    return { label: diagnosis.label, labelEn: english[code as RiderInjuryDiagnosisCode] };
  }
  return { label: "Blessure", labelEn: "Injury" };
}

function formatList(values: string[]) {
  if (values.length <= 1) return values[0] ?? "";
  return `${values.slice(0, -1).join(", ")} et ${values.at(-1)}`;
}

function formatEnglishList(values: string[]) {
  if (values.length <= 1) return values[0] ?? "";
  return `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function toMap<T extends { id: string }>(values: T[]) {
  return new Map(values.map((value) => [value.id, value]));
}
