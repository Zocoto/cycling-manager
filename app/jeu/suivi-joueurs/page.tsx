import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import { canAccessPlayerTracking } from "@/lib/game/player-tracking-access";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import {
  getPlayerTrackingOverview,
  type PlayerTrackingRow,
} from "@/services/player-tracking-admin";

export const metadata: Metadata = {
  title: "Suivi des joueurs",
  description: "Console privée des dernières connexions des joueurs.",
};

const LAST_SIGN_IN_DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Paris",
});

export default async function PlayerTrackingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) redirect("/connexion");
  if (!canAccessPlayerTracking(user.email)) notFound();

  const [headerData, overview] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getPlayerTrackingOverview(user.email),
  ]);

  const connectedPlayers = overview.players.filter(
    (player) => player.lastSignInAt,
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
              Dernière connexion connue par Supabase Auth. Seule la date est
              affichée ; aucune heure ni donnée de session n’est exposée.
            </p>
          </header>
          <BackToOfficeLink />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <StatCard label="Comptes joueurs" value={overview.players.length} />
          <StatCard label="Connexion déjà enregistrée" value={connectedPlayers} />
        </div>

        <section className="mt-7 overflow-hidden rounded-[1.75rem] border border-[#B9CEC7] bg-white shadow-[0_20px_55px_rgba(20,67,56,0.09)]">
          <div className="border-b border-[#D7E4DF] bg-[#123D34] px-5 py-5 text-white sm:px-7">
            <h2 className="text-xl font-black">Activite des comptes</h2>
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
                      <TableHeader>Dernière connexion</TableHeader>
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
        <LastSignInDate value={player.lastSignInAt} />
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
          <LastSignInDate value={player.lastSignInAt} />
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

function LastSignInDate({ value }: { value: string | null }) {
  if (!value) return <>Jamais</>;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <>Date indisponible</>;

  return <time dateTime={value}>{LAST_SIGN_IN_DATE_FORMAT.format(date)}</time>;
}
