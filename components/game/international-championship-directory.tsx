import Link from "@/components/ui/app-link";
import { RaceStageProfile } from "@/components/game/race-stage-profile";
import {
  RACE_DAY_SLOT_CONFIG,
  RACE_PROFILE_LABELS,
  RACE_STAGE_TYPE_LABELS,
  compareRaceDaySlots,
  type RaceCalendarEdition,
  type SeasonRaceCalendar,
} from "@/lib/game/race-calendar";
import {
  getInternationalChampionshipDetailsHref,
  getInternationalChampionshipStartlistHref,
} from "@/lib/game/international-championship-navigation";

type InternationalChampionshipGroup = {
  key: "continental_championship" | "world_championship";
  eyebrow: string;
  title: string;
  description: string;
  editions: RaceCalendarEdition[];
};

export function InternationalChampionshipDirectory({
  calendar,
}: {
  calendar: SeasonRaceCalendar;
}) {
  const groups = buildInternationalChampionshipGroups(calendar);

  if (groups.every((group) => group.editions.length === 0)) {
    return (
      <div className="rounded-[2rem] border border-dashed border-[#315B3E]/25 bg-white px-6 py-12 text-center shadow-[0_16px_45px_rgba(19,60,46,0.06)]">
        <p className="text-xl font-black text-[#183F37]">
          Aucun championnat programmé
        </p>
        <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#60756E]">
          Les profils des championnats continentaux et mondiaux apparaîtront
          ici dès la publication du calendrier de la saison.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-9">
      {groups.map((group) =>
        group.editions.length > 0 ? (
          <section key={group.key} aria-labelledby={`${group.key}-title`}>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#176951]">
                  {group.eyebrow}
                </p>
                <h2
                  id={`${group.key}-title`}
                  className="mt-2 text-2xl font-black text-[#0B302B] sm:text-3xl"
                >
                  {group.title}
                </h2>
                <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#60756E]">
                  {group.description}
                </p>
              </div>
              <span className="rounded-full bg-[#D7EEE8] px-4 py-2 text-xs font-black text-[#176951]">
                {group.editions.length} épreuve
                {group.editions.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              {group.editions.map((edition) => (
                <InternationalChampionshipCard
                  key={edition.id}
                  edition={edition}
                />
              ))}
            </div>
          </section>
        ) : null,
      )}
    </div>
  );
}

export function buildInternationalChampionshipGroups(
  calendar: SeasonRaceCalendar,
): InternationalChampionshipGroup[] {
  const configurations = [
    {
      key: "continental_championship" as const,
      eyebrow: "CC · Équipes nationales",
      title: "Championnats continentaux",
      description:
        "Tous les parcours continentaux de la saison, avec leur startlist nationale actualisée.",
    },
    {
      key: "world_championship" as const,
      eyebrow: "CM · Équipes nationales",
      title: "Championnats du monde",
      description:
        "Les parcours mondiaux contre-la-montre et en ligne, leurs engagés et leur fiche complète.",
    },
  ];

  return configurations.map((configuration) => ({
    ...configuration,
    editions: calendar.editions
      .filter(
        (edition) => edition.competitionType === configuration.key,
      )
      .sort(compareInternationalChampionshipEditions),
  }));
}

function InternationalChampionshipCard({
  edition,
}: {
  edition: RaceCalendarEdition;
}) {
  const isWorld = edition.competitionType === "world_championship";

  return (
    <article
      id={edition.slug}
      data-international-championship={isWorld ? "CM" : "CC"}
      className="relative scroll-mt-24 overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.08)]"
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#0085C7_0_20%,#E31837_20%_40%,#111827_40%_60%,#FFD100_60%_80%,#009B3A_80%_100%)]"
      />

      <div className="p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#0B302B] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                {isWorld ? "CM" : "CC"}
              </span>
              <span className="rounded-full bg-[#EEF5F1] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#315B3E]">
                {formatEditionSchedule(edition)}
              </span>
            </div>
            <h3 className="mt-3 text-xl font-black text-[#183F37] sm:text-2xl">
              {edition.name}
            </h3>
            <p className="mt-1 flex items-center gap-2 text-sm font-bold text-[#60756E]">
              <span
                className={`fi fi-${edition.countryCode.toLowerCase()} rounded shadow-sm`}
                role="img"
                aria-label={`Drapeau ${edition.countryName}`}
              />
              {edition.countryName}
            </p>
          </div>
          <span className="rounded-xl border border-[#278B70]/20 bg-[#E8F7F1] px-3 py-2 text-xs font-black text-[#176951]">
            {edition.engagedRiderCount} sélectionné
            {edition.engagedRiderCount > 1 ? "s" : ""}
          </span>
        </div>

        <div className="mt-5 space-y-4">
          {edition.stages.map((stage) => (
            <section
              key={stage.id}
              className="rounded-2xl border border-[#315B3E]/12 bg-[#F6FAF7] p-4"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-[#183F37]">
                    {edition.stages.length > 1
                      ? `Étape ${stage.stageNumber} · ${stage.name}`
                      : stage.name}
                  </p>
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-[#789087]">
                    {RACE_STAGE_TYPE_LABELS[stage.stageType]} ·{" "}
                    {RACE_PROFILE_LABELS[stage.profileType]}
                  </p>
                </div>
                <span className="text-sm font-black text-[#176951]">
                  {formatDistance(stage.distanceKm)} km
                </span>
              </div>
              <RaceStageProfile segments={stage.segments} compact />
            </section>
          ))}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link
            href={getInternationalChampionshipDetailsHref(edition.slug)}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#176951]/25 bg-white px-4 text-xs font-black uppercase tracking-[0.1em] text-[#176951] transition hover:bg-[#EEF8F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951]"
          >
            Voir les détails
          </Link>
          <Link
            href={getInternationalChampionshipStartlistHref(edition.slug)}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#176951] px-4 text-xs font-black uppercase tracking-[0.1em] text-white transition hover:bg-[#0B302B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951]"
          >
            Voir la startlist
          </Link>
        </div>
      </div>
    </article>
  );
}

function compareInternationalChampionshipEditions(
  left: RaceCalendarEdition,
  right: RaceCalendarEdition,
) {
  const leftStage = left.stages[0];
  const rightStage = right.stages[0];

  if (!leftStage || !rightStage) return left.name.localeCompare(right.name, "fr");

  return (
    leftStage.dayNumber - rightStage.dayNumber ||
    compareRaceDaySlots(leftStage.daySlot, rightStage.daySlot) ||
    left.name.localeCompare(right.name, "fr")
  );
}

function formatEditionSchedule(edition: RaceCalendarEdition) {
  const stage = edition.stages[0];
  if (!stage) return "Date à venir";

  if (stage.departureAt) {
    return `J${stage.dayNumber} · ${new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(stage.departureAt))}`;
  }

  return `J${stage.dayNumber} · ${RACE_DAY_SLOT_CONFIG[stage.daySlot].shortLabel}`;
}

function formatDistance(value: number) {
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}
