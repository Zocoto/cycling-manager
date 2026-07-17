import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { WheelLogo } from "../../../components/ui/wheel-logo";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { logoutAccount } from "../actions";

export const metadata: Metadata = {
  title: "Effectif",
  description:
    "Consultez les coureurs de votre équipe dans Cyclostratège.",
};

type CurrentTeamDashboardSummary = {
  team_id: string;
  team_name: string;
  rider_count: number;
  season_id: string;
  season_name: string;
  season_day_number: number;
};

type RiderRow = {
  rider_id: string;
  first_name: string;
  last_name: string;
  country_id: string;
  country_name: string;
  country_iso_alpha2: string;
  avatar_profile_key: string | null;
  avatar_seed: number | string | null;
  age: number;
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
  salary_per_season: number | string;
  contract_currency: string;
  contract_end_season_id: string;
  contract_end_season_name: string;
};

type RatingKey =
  | "mountain"
  | "hills"
  | "flat"
  | "time_trial"
  | "cobbles"
  | "sprint"
  | "acceleration"
  | "downhill"
  | "endurance"
  | "resistance"
  | "recovery"
  | "breakaway"
  | "prologue";

const ratingColumns: Array<{
  key: RatingKey;
  label: string;
  fullLabel: string;
}> = [
  {
    key: "mountain",
    label: "MON",
    fullLabel: "Montagne",
  },
  {
    key: "hills",
    label: "VAL",
    fullLabel: "Vallon",
  },
  {
    key: "flat",
    label: "PLA",
    fullLabel: "Plaine",
  },
  {
    key: "time_trial",
    label: "CLM",
    fullLabel: "Contre-la-montre",
  },
  {
    key: "cobbles",
    label: "PAV",
    fullLabel: "Pavés",
  },
  {
    key: "sprint",
    label: "SPR",
    fullLabel: "Sprint",
  },
  {
    key: "acceleration",
    label: "ACC",
    fullLabel: "Accélération",
  },
  {
    key: "downhill",
    label: "DES",
    fullLabel: "Descente",
  },
  {
    key: "endurance",
    label: "END",
    fullLabel: "Endurance",
  },
  {
    key: "resistance",
    label: "RES",
    fullLabel: "Résistance",
  },
  {
    key: "recovery",
    label: "REC",
    fullLabel: "Récupération",
  },
  {
    key: "breakaway",
    label: "BAR",
    fullLabel: "Baroudeur",
  },
  {
    key: "prologue",
    label: "PRO",
    fullLabel: "Prologue",
  },
];

export default async function TeamRosterPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const [teamSummaryResult, rosterResult] =
    await Promise.all([
      supabase
        .rpc("get_current_team_dashboard_summary")
        .maybeSingle<CurrentTeamDashboardSummary>(),

      supabase.rpc("get_current_team_roster"),
    ]);

  if (teamSummaryResult.error) {
    console.error(
      "Impossible de récupérer le résumé de l’équipe :",
      {
        code: teamSummaryResult.error.code,
        message: teamSummaryResult.error.message,
        details: teamSummaryResult.error.details,
        hint: teamSummaryResult.error.hint,
      }
    );
  }

  if (rosterResult.error) {
    console.error(
      "Impossible de récupérer l’effectif :",
      {
        code: rosterResult.error.code,
        message: rosterResult.error.message,
        details: rosterResult.error.details,
        hint: rosterResult.error.hint,
      }
    );
  }

  const teamSummary =
    (teamSummaryResult.data ??
      null) as CurrentTeamDashboardSummary | null;

  const riders = (rosterResult.data ?? []) as RiderRow[];

  const minimumAge =
    riders.length > 0
      ? Math.min(...riders.map((rider) => rider.age))
      : 0;

  const maximumAge =
    riders.length > 0
      ? Math.max(...riders.map((rider) => rider.age))
      : 0;

  const teamAverage =
    riders.length > 0
      ? Math.round(
          riders.reduce(
            (total, rider) =>
              total + getRiderAverage(rider),
            0
          ) / riders.length
        )
      : 0;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader />

      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-96 bg-linear-to-b from-[#D7EEE8] to-transparent"
        />

        <MountainDecoration />

        <div className="relative mx-auto max-w-[1500px] px-5 py-10 sm:px-8 sm:py-14">
          <Link
            href="/jeu"
            className="inline-flex items-center gap-2 text-sm font-extrabold text-[#176951] transition hover:text-[#0B4A3B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
          >
            <BackIcon />
            Retour au bureau
          </Link>

          <header className="mt-7 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#278B70]">
                Gestion sportive
              </p>

              <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
                Effectif
              </h1>

              <p className="mt-4 max-w-3xl text-lg leading-8 text-[#48665F]">
                Consultez les qualités, les contrats et les
                spécialités de vos coureurs pour la saison
                actuelle.
              </p>
            </div>

            {teamSummary ? (
              <div className="rounded-2xl border border-[#315B3E]/20 bg-white/85 px-5 py-4 text-right shadow-[0_14px_34px_rgba(19,60,46,0.08)]">
                <p className="font-black text-[#082A2A]">
                  {teamSummary.team_name}
                </p>

                <p className="mt-1 text-sm font-semibold text-[#60756E]">
                  {teamSummary.season_name} · Jour{" "}
                  {teamSummary.season_day_number} / 28
                </p>
              </div>
            ) : null}
          </header>

          {rosterResult.error ? (
            <RosterErrorMessage />
          ) : null}

          <section className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Coureurs"
              value={String(riders.length)}
              detail="Sous contrat actif"
            />

            <SummaryCard
              label="Âges"
              value={
                riders.length > 0
                  ? `${minimumAge} – ${maximumAge} ans`
                  : "Non disponible"
              }
              detail="Effectif initial équilibré"
            />

            <SummaryCard
              label="Niveau moyen"
              value={
                riders.length > 0
                  ? String(teamAverage)
                  : "—"
              }
              detail="Moyenne des 13 caractéristiques"
            />

            <SummaryCard
              label="Échéance"
              value={
                riders[0]?.contract_end_season_name ??
                "Non disponible"
              }
              detail="Contrats initiaux"
            />
          </section>

          <section className="mt-6 overflow-hidden rounded-2xl border border-[#315B3E]/20 bg-white/95 shadow-[0_22px_55px_rgba(19,60,46,0.12)]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#315B3E]/15 bg-[#0B302B] px-5 py-5 text-[#FFFDF4] sm:px-7">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#7CCF9C]">
                  Équipe première
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  {formatRiderCount(riders.length)}
                </h2>
              </div>

              <RatingLegend />
            </div>

            {riders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-[1450px] w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[#315B3E]/15 bg-[#F3F8F6]">
                      <th
                        scope="col"
                        className="sticky left-0 z-10 min-w-80 bg-[#F3F8F6] px-5 py-4 text-left text-xs font-extrabold uppercase tracking-wider text-[#48665F]"
                      >
                        Coureur
                      </th>

                      <th
                        scope="col"
                        className="px-3 py-4 text-center text-xs font-extrabold uppercase tracking-wider text-[#48665F]"
                      >
                        Âge
                      </th>

                      <th
                        scope="col"
                        className="min-w-40 px-3 py-4 text-left text-xs font-extrabold uppercase tracking-wider text-[#48665F]"
                      >
                        Profil
                      </th>

                      {ratingColumns.map((column) => (
                        <th
                          key={column.key}
                          scope="col"
                          title={column.fullLabel}
                          className="px-2 py-4 text-center text-xs font-extrabold uppercase tracking-wider text-[#48665F]"
                        >
                          {column.label}
                        </th>
                      ))}

                      <th
                        scope="col"
                        className="min-w-28 px-3 py-4 text-center text-xs font-extrabold uppercase tracking-wider text-[#48665F]"
                      >
                        Moy.
                      </th>

                      <th
                        scope="col"
                        className="min-w-36 px-4 py-4 text-right text-xs font-extrabold uppercase tracking-wider text-[#48665F]"
                      >
                        Salaire
                      </th>

                      <th
                        scope="col"
                        className="min-w-36 px-5 py-4 text-left text-xs font-extrabold uppercase tracking-wider text-[#48665F]"
                      >
                        Contrat
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {riders.map((rider) => (
                      <RiderTableRow
                        key={rider.rider_id}
                        rider={rider}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyRoster />
            )}
          </section>

          <p className="mt-5 text-sm leading-6 text-[#60756E]">
            Les portraits définitifs et la fiche détaillée de
            chaque coureur seront ajoutés dans une prochaine
            évolution.
          </p>
        </div>
      </section>
    </main>
  );
}

function GameHeader() {
  return (
    <header className="relative z-20 border-b border-[#78947D]/25 bg-[#071A17] text-[#FFFDF4] shadow-lg shadow-black/15">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-5 px-5 py-4 sm:px-8">
        <Link
          href="/jeu"
          className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
        >
          <WheelLogo />

          <span>
            <span className="block text-lg font-extrabold uppercase leading-none">
              Cyclo
            </span>

            <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.26em] text-[#F2C94C]">
              Stratège
            </span>
          </span>
        </Link>

        <form action={logoutAccount}>
          <button
            type="submit"
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#F2C94C]/45 bg-[#F2C94C]/10 px-4 py-2 text-xs font-extrabold uppercase tracking-widest text-[#F2C94C] transition hover:bg-[#F2C94C] hover:text-[#071A17] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
          >
            Se déconnecter
          </button>
        </form>
      </div>
    </header>
  );
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-2xl border border-[#315B3E]/20 bg-white/90 p-5 shadow-[0_14px_34px_rgba(19,60,46,0.08)]">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#278B70]">
        {label}
      </p>

      <p className="mt-3 text-2xl font-black text-[#082A2A]">
        {value}
      </p>

      <p className="mt-2 text-sm font-semibold text-[#60756E]">
        {detail}
      </p>
    </article>
  );
}

function RiderTableRow({
  rider,
}: {
  rider: RiderRow;
}) {
  const riderName =
    `${rider.first_name} ${rider.last_name}`.trim();

  const riderProfile = getRiderProfile(rider);
  const riderAverage = getRiderAverage(rider);

  return (
    <tr className="border-b border-[#315B3E]/10 transition last:border-b-0 hover:bg-[#F6FAF8]">
      <th
        scope="row"
        className="sticky left-0 z-10 bg-white px-5 py-4 text-left group-hover:bg-[#F6FAF8]"
      >
        <div className="flex items-center gap-4">
          <RiderSilhouette />

          <div className="min-w-0">
            <p className="truncate text-base font-black text-[#082A2A]">
              {riderName}
            </p>

            <div className="mt-1 flex items-center gap-2">
              <CountryFlag
                isoAlpha2={rider.country_iso_alpha2}
                countryName={rider.country_name}
              />

              <span className="truncate text-xs font-semibold text-[#60756E]">
                {rider.country_name}
              </span>
            </div>
          </div>
        </div>
      </th>

      <td className="px-3 py-4 text-center font-black text-[#082A2A]">
        {rider.age}
      </td>

      <td className="px-3 py-4">
        <span className="inline-flex rounded-full bg-[#D7EEE8] px-3 py-1.5 text-xs font-extrabold text-[#176951]">
          {riderProfile}
        </span>
      </td>

      {ratingColumns.map((column) => {
        const value = rider[column.key];

        return (
          <td
            key={column.key}
            className="px-2 py-4 text-center"
          >
            <RatingBadge
              value={value}
              label={column.fullLabel}
            />
          </td>
        );
      })}

      <td className="px-3 py-4 text-center">
        <span className="font-black text-[#082A2A]">
          {riderAverage}
        </span>
      </td>

      <td className="px-4 py-4 text-right font-bold text-[#48665F]">
        {formatMoney(
          rider.salary_per_season,
          rider.contract_currency
        )}
      </td>

      <td className="px-5 py-4">
        <p className="font-bold text-[#082A2A]">
          {rider.contract_end_season_name}
        </p>

        <p className="mt-1 text-xs font-semibold text-[#60756E]">
          Expire en fin de saison
        </p>
      </td>
    </tr>
  );
}

function RatingBadge({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <span
      title={`${label} : ${value}`}
      className={[
        "inline-flex h-9 min-w-10 items-center justify-center rounded-lg border px-2 text-sm font-black",
        getRatingClasses(value),
      ].join(" ")}
    >
      {value}
    </span>
  );
}

function RatingLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
      <span className="text-[#BFD1C6]">
        Échelle :
      </span>

      <span className="rounded-md bg-white px-2 py-1 text-[#48665F]">
        &lt; 50
      </span>

      <span className="rounded-md bg-[#DDF3E3] px-2 py-1 text-[#2C6A3F]">
        50+
      </span>

      <span className="rounded-md bg-[#A9DFB7] px-2 py-1 text-[#174E2A]">
        60+
      </span>

      <span className="rounded-md bg-[#3F8F5A] px-2 py-1 text-white">
        70+
      </span>

      <span className="rounded-md bg-[#F4B04D] px-2 py-1 text-[#5B3100]">
        80+
      </span>

      <span className="rounded-md bg-[#D84B4B] px-2 py-1 text-white">
        90+
      </span>
    </div>
  );
}

function RiderSilhouette() {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#315B3E]/20 bg-[#D7EEE8]">
      <svg
        aria-label="Portrait générique du coureur"
        role="img"
        viewBox="0 0 64 64"
        className="h-full w-full"
      >
        <circle
          cx="32"
          cy="24"
          r="11"
          fill="#4F7468"
        />

        <path
          d="M13 59c1-15 8-23 19-23s18 8 19 23"
          fill="#315B3E"
        />

        <path
          d="M22 39 32 49 42 39"
          fill="none"
          stroke="#F2C94C"
          strokeWidth="3"
        />

        <path
          d="M19 19c4-10 22-13 29 0-8-3-20-3-29 0Z"
          fill="#071A17"
        />
      </svg>
    </div>
  );
}

function CountryFlag({
  isoAlpha2,
  countryName,
}: {
  isoAlpha2: string;
  countryName: string;
}) {
  const normalizedCode = isoAlpha2
    .trim()
    .toLowerCase();

  if (!/^[a-z]{2}$/.test(normalizedCode)) {
    return (
      <span
        role="img"
        aria-label={`Drapeau : ${countryName}`}
      >
        🏳️
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={`Drapeau : ${countryName}`}
      className={[
        "fi",
        `fi-${normalizedCode}`,
        "shrink-0 overflow-hidden rounded-sm text-lg shadow-sm",
      ].join(" ")}
    />
  );
}

function EmptyRoster() {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#D7EEE8] text-[#176951]">
        <RosterIcon />
      </div>

      <h2 className="mt-5 text-xl font-black">
        Aucun coureur récupéré
      </h2>

      <p className="mx-auto mt-3 max-w-xl leading-7 text-[#60756E]">
        L’équipe existe, mais aucun contrat actif n’a été trouvé
        pour la saison actuelle.
      </p>
    </div>
  );
}

function RosterErrorMessage() {
  return (
    <div className="mt-8 rounded-xl border border-red-300 bg-red-50 px-5 py-4 text-sm font-semibold text-red-800">
      L’effectif n’a pas pu être récupéré. Consultez le terminal
      de développement pour connaître le détail de l’erreur.
    </div>
  );
}

function BackIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12.5 4.5-5.5 5.5 5.5 5.5" />
    </svg>
  );
}

function RosterIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-8 w-8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M2.5 20c.5-4.5 2.5-7 5.5-7s5 2.5 5.5 7" />
      <path d="M14 14c3.5-.3 5.5 1.7 6 5" />
    </svg>
  );
}

function getRiderProfile(rider: RiderRow): string {
  if (
    rider.mountain >= 62 &&
    rider.mountain > rider.hills
  ) {
    return "Grimpeur";
  }

  if (
    rider.hills >= 62 &&
    rider.acceleration >= 60
  ) {
    return "Puncheur";
  }

  if (
    rider.time_trial >= 62 &&
    rider.flat >= 60
  ) {
    return "Rouleur / CLM";
  }

  if (
    rider.sprint >= 62 &&
    rider.acceleration >= 60
  ) {
    return "Sprinteur";
  }

  if (
    rider.cobbles >= 62 &&
    rider.resistance >= 58
  ) {
    return "Spécialiste des pavés";
  }

  if (
    rider.breakaway >= 62 &&
    rider.endurance >= 58
  ) {
    return "Baroudeur";
  }

  return "Équipier polyvalent";
}

function getRiderAverage(rider: RiderRow): number {
  const total = ratingColumns.reduce(
    (sum, column) => sum + rider[column.key],
    0
  );

  return Math.round(total / ratingColumns.length);
}

function getRatingClasses(value: number): string {
  if (value > 90) {
    return "border-[#B52D2D]/25 bg-[#D84B4B] text-white";
  }

  if (value > 80) {
    return "border-[#C67817]/25 bg-[#F4B04D] text-[#5B3100]";
  }

  if (value >= 70) {
    return "border-[#286C40]/25 bg-[#3F8F5A] text-white";
  }

  if (value >= 60) {
    return "border-[#65B478]/30 bg-[#A9DFB7] text-[#174E2A]";
  }

  if (value >= 50) {
    return "border-[#9FD5AC]/35 bg-[#DDF3E3] text-[#2C6A3F]";
  }

  return "border-[#D9E3DE] bg-white text-[#60756E]";
}

function formatMoney(
  value: number | string,
  currency: string
): string {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "Non disponible";
  }

  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(numericValue);
  } catch {
    return `${numericValue.toLocaleString(
      "fr-FR"
    )} ${currency}`;
  }
}

function formatRiderCount(value: number): string {
  return `${value} coureur${value === 1 ? "" : "s"}`;
}

function MountainDecoration() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 420"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 top-48 h-80 w-full opacity-20"
    >
      <path
        d="M0 365 L170 215 L310 330 L490 105 L665 340 L835 180 L1005 350 L1190 135 L1440 315 L1440 420 L0 420 Z"
        fill="#78B9A3"
        opacity="0.34"
      />

      <path
        d="M0 390 L220 300 L370 380 L545 235 L720 395 L900 285 L1075 400 L1260 255 L1440 365"
        fill="none"
        stroke="#315B3E"
        strokeDasharray="17 15"
        strokeWidth="3"
        opacity="0.38"
      />
    </svg>
  );
}