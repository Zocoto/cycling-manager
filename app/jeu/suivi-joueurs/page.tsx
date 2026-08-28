import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "@/components/ui/app-link";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import { canAccessPlayerTracking } from "@/lib/game/player-tracking-access";
import {
  ACQUISITION_PERIOD_VALUES,
  parseAcquisitionPeriod,
  type AcquisitionBreakdownRow,
  type AcquisitionOverview,
  type AcquisitionPeriod,
} from "@/lib/marketing/acquisition-funnel";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import {
  getPlayerTrackingOverview,
  type PlayerTrackingRow,
} from "@/services/player-tracking-admin";

export const metadata: Metadata = {
  title: "Suivi des joueurs",
  description: "Console privée de la dernière activité quotidienne des joueurs.",
};

const LAST_ACTIVITY_DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Paris",
});

export default async function PlayerTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string | string[] }>;
}) {
  const period = parseAcquisitionPeriod((await searchParams).periode);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) redirect("/connexion");
  if (!canAccessPlayerTracking(user.email)) notFound();

  const { error: attendanceError } = await supabase.rpc(
    "record_current_sporting_director_attendance",
  );
  if (attendanceError) {
    console.error(
      "Impossible d'enregistrer la présence quotidienne du joueur administrateur.",
      attendanceError,
    );
  }

  const [headerData, overview] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getPlayerTrackingOverview(user.email, period),
  ]);

  const activePlayers = overview.players.filter(
    (player) => player.lastActivityOn,
  ).length;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1500px] px-4 py-8 sm:px-8 sm:py-12">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <header className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#278B70]">
              Administration privée
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
              Suivi des joueurs
            </h1>
            <p className="mt-4 text-base font-medium leading-7 text-[#557068]">
              Une activité est comptée dès qu’un membre ouvre une page du jeu,
              y compris avec une session déjà active. Seule la date est affichée.
            </p>
          </header>
          <BackToOfficeLink />
        </div>

        <AcquisitionDashboard acquisition={overview.acquisition} />

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <StatCard label="Comptes joueurs" value={overview.players.length} />
          <StatCard label="Activité déjà enregistrée" value={activePlayers} />
        </div>

        <section className="mt-7 overflow-hidden rounded-[1.75rem] border border-[#B9CEC7] bg-white shadow-[0_20px_55px_rgba(20,67,56,0.09)]">
          <div className="border-b border-[#D7E4DF] bg-[#123D34] px-5 py-5 text-white sm:px-7">
            <h2 className="text-xl font-black">Activité des comptes</h2>
            <p className="mt-1 text-sm font-medium text-[#CDE2DA]">
              Joueur = identifiant de compte · DS = nom public du Directeur Sportif
            </p>
          </div>

          {overview.players.length > 0 ? (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse text-left">
                  <thead className="bg-[#F2F7F5] text-[0.67rem] font-black uppercase tracking-[0.14em] text-[#60756E]">
                    <tr>
                      <TableHeader>Joueur</TableHeader>
                      <TableHeader>E-mail</TableHeader>
                      <TableHeader>DS</TableHeader>
                      <TableHeader>Équipe</TableHeader>
                      <TableHeader>Dernière activité</TableHeader>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.players.map((player) => (
                      <PlayerTableRow key={player.authUserId} player={player} />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-[#DDE9E5] md:hidden">
                {overview.players.map((player) => (
                  <PlayerMobileCard key={player.authUserId} player={player} />
                ))}
              </div>
            </>
          ) : (
            <p className="px-6 py-12 text-center font-semibold text-[#60756E]">
              Aucun compte joueur n’est disponible.
            </p>
          )}
        </section>
      </section>
    </main>
  );
}

function AcquisitionDashboard({
  acquisition,
}: {
  acquisition: AcquisitionOverview;
}) {
  const steps = [
    {
      label: "Inscriptions",
      value: acquisition.registrations,
      detail: "Cohorte créée",
    },
    {
      label: "E-mails confirmés",
      value: acquisition.confirmed,
      detail: `${formatRate(acquisition.confirmationRate)} des inscrits`,
    },
    {
      label: "Profils DS",
      value: acquisition.directorProfiles,
      detail: "Profil métier créé",
    },
    {
      label: "Équipes créées",
      value: acquisition.teamsCreated,
      detail: `${formatRate(acquisition.teamConversionRate)} des inscrits`,
    },
    {
      label: "Actifs sur 7 jours",
      value: acquisition.activeLastSevenDays,
      detail: "Dans cette cohorte",
    },
  ] as const;

  return (
    <section className="mt-8 overflow-hidden rounded-[1.75rem] border border-[#B9CEC7] bg-white shadow-[0_20px_55px_rgba(20,67,56,0.09)]">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#123D34] px-5 py-5 text-white sm:px-7">
        <div>
          <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[#8DDFC2]">
            Acquisition sans surcoût côté jeu
          </p>
          <h2 className="mt-1 text-2xl font-black">Entonnoir d’activation</h2>
          <p className="mt-1 max-w-2xl text-sm font-medium text-[#CDE2DA]">
            Cohortes calculées à la demande depuis les données déjà enregistrées.
            Aucun script de suivi ni rafraîchissement automatique n’est ajouté.
          </p>
        </div>
        <PeriodNavigation selected={acquisition.period} />
      </div>

      <div className="grid gap-px bg-[#DDE9E5] sm:grid-cols-2 xl:grid-cols-5">
        {steps.map((step) => (
          <article key={step.label} className="bg-white px-5 py-5">
            <p className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-[#60756E]">
              {step.label}
            </p>
            <p className="mt-2 text-3xl font-black text-[#176951]">
              {step.value}
            </p>
            <p className="mt-1 text-xs font-bold text-[#789088]">
              {step.detail}
            </p>
          </article>
        ))}
      </div>

      <div className="grid border-t border-[#DDE9E5] lg:grid-cols-2 lg:divide-x lg:divide-[#DDE9E5]">
        <AcquisitionBreakdown
          title="Sources d’inscription"
          emptyLabel="Aucune inscription sur cette période."
          rows={acquisition.sources}
        />
        <AcquisitionBreakdown
          title="Campagnes UTM"
          emptyLabel="Aucune campagne attribuée sur cette période."
          rows={acquisition.campaigns}
        />
      </div>
    </section>
  );
}

function PeriodNavigation({ selected }: { selected: AcquisitionPeriod }) {
  return (
    <nav aria-label="Période d’acquisition" className="flex flex-wrap gap-2">
      {ACQUISITION_PERIOD_VALUES.map((period) => {
        const active = selected === period;
        const label = period === "all" ? "Tout" : `${period} j`;

        return (
          <Link
            key={period}
            href={`/jeu/suivi-joueurs?periode=${period}`}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
              active
                ? "bg-[#F2C94C] text-[#123D34]"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function AcquisitionBreakdown({
  title,
  emptyLabel,
  rows,
}: {
  title: string;
  emptyLabel: string;
  rows: AcquisitionBreakdownRow[];
}) {
  return (
    <section className="min-w-0 p-5 sm:p-7">
      <h3 className="text-lg font-black text-[#123D34]">{title}</h3>
      {rows.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#789088]">
              <tr>
                <th className="pb-2 pr-3">Origine</th>
                <th className="px-2 pb-2 text-right">Inscr.</th>
                <th className="px-2 pb-2 text-right">Confirm.</th>
                <th className="px-2 pb-2 text-right">Équipes</th>
                <th className="pb-2 pl-2 text-right">Conv.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1EBE7]">
              {rows.slice(0, 8).map((row) => (
                <tr key={row.label}>
                  <td className="max-w-60 break-words py-3 pr-3 text-sm font-black text-[#284E45]">
                    {row.label}
                  </td>
                  <NumericCell>{row.registrations}</NumericCell>
                  <NumericCell>{row.confirmed}</NumericCell>
                  <NumericCell>{row.teamsCreated}</NumericCell>
                  <td className="py-3 pl-2 text-right text-sm font-black text-[#176951]">
                    {formatRate(row.teamConversionRate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-sm font-semibold text-[#789088]">
          {emptyLabel}
        </p>
      )}
    </section>
  );
}

function NumericCell({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-2 py-3 text-right text-sm font-bold text-[#526A63]">
      {children}
    </td>
  );
}

function formatRate(value: number) {
  return `${new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 1,
  }).format(value)} %`;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#C6D8D2] bg-white px-5 py-4 shadow-sm">
      <p className="text-[0.68rem] font-black uppercase tracking-[0.15em] text-[#60756E]">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black text-[#176951]">{value}</p>
    </div>
  );
}

function TableHeader({ children }: { children: React.ReactNode }) {
  return <th className="px-5 py-3.5">{children}</th>;
}

function PlayerTableRow({ player }: { player: PlayerTrackingRow }) {
  return (
    <tr className="border-t border-[#E1EBE7] align-top transition hover:bg-[#F7FAF9]">
      <TableCell strong>{player.playerName}</TableCell>
      <TableCell>{player.email}</TableCell>
      <TableCell>{player.directorName}</TableCell>
      <TableCell>{player.teamName ?? "Aucune équipe active"}</TableCell>
      <TableCell>
        <LastActivityDate value={player.lastActivityOn} />
      </TableCell>
    </tr>
  );
}

function TableCell({
  children,
  strong = false,
}: {
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <td
      className={`max-w-[20rem] break-words px-5 py-4 text-sm ${
        strong ? "font-black text-[#123D34]" : "font-semibold text-[#526A63]"
      }`}
    >
      {children}
    </td>
  );
}

function PlayerMobileCard({ player }: { player: PlayerTrackingRow }) {
  return (
    <article className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="break-words text-lg font-black text-[#123D34]">
            {player.playerName}
          </h3>
          <p className="mt-1 break-all text-sm font-semibold text-[#60756E]">
            {player.email}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[#DFF1EB] px-2.5 py-1 text-[0.65rem] font-black uppercase text-[#176951]">
          <LastActivityDate value={player.lastActivityOn} />
        </span>
      </div>
      <dl className="mt-4 grid gap-3 text-sm">
        <MobileDetail label="Directeur Sportif" value={player.directorName} />
        <MobileDetail
          label="Équipe"
          value={player.teamName ?? "Aucune équipe active"}
        />
      </dl>
    </article>
  );
}

function MobileDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.65rem] font-black uppercase tracking-[0.13em] text-[#789088]">
        {label}
      </dt>
      <dd className="mt-0.5 font-bold text-[#284E45]">{value}</dd>
    </div>
  );
}

function LastActivityDate({ value }: { value: string | null }) {
  if (!value) return <>Aucune</>;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <>Date indisponible</>;

  return <time dateTime={value}>{LAST_ACTIVITY_DATE_FORMAT.format(date)}</time>;
}
