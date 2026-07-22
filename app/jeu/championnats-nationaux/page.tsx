import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { redirect } from "next/navigation";

import { GameHeader } from "@/components/game/game-header";
import type { NationalChampionshipType } from "@/lib/game/race-calendar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import {
  getCurrentTeamNationalChampionships,
  type NationalChampionshipEntry,
} from "@/services/national-championships";

export const metadata: Metadata = {
  title: "Championnats nationaux",
  description: "Engagez vos coureurs aux championnats nationaux sur route et contre-la-montre.",
};

type PageProps = {
  searchParams: Promise<{
    discipline?: string | string[];
    inscription?: string | string[];
  }>;
};

export default async function NationalChampionshipsPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const discipline = readDiscipline(query.discipline);
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/connexion");

  const [headerData, overviewResult] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getCurrentTeamNationalChampionships(supabase, user.id, discipline)
      .then((overview) => ({ overview, error: null }))
      .catch((overviewError: unknown) => ({ overview: null, error: overviewError })),
  ]);

  if (overviewResult.error) {
    console.error("Impossible de charger les championnats nationaux :", overviewResult.error);
  }

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1450px] px-5 py-8 sm:px-8 sm:py-12">
        <Link href="/jeu/calendrier" className="text-sm font-extrabold text-[#176951] hover:text-[#0B302B]">
          ← Retour au calendrier
        </Link>

        <header className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-9 text-white shadow-[0_24px_70px_rgba(19,60,46,0.18)] sm:px-10">
          <div aria-hidden="true" className="absolute -right-12 -top-24 h-72 w-72 rounded-full border-[42px] border-white/5" />
          <div className="relative max-w-4xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#9BE0BC]">Le maillot d’une nation se gagne ici</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Championnats nationaux</h1>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[#D6DFD2] sm:text-base">
              Seules les nations représentées dans votre effectif sont proposées. Engagez de 1 à 8 coureurs de la nationalité concernée : le vainqueur gagne 10 points de réputation et porte les couleurs nationales jusqu’à l’édition suivante.
            </p>
          </div>
        </header>

        {readSingle(query.inscription) === "confirmee" ? (
          <div className="mt-6 rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-sm font-black text-emerald-900">
            L’inscription au championnat national est confirmée.
          </div>
        ) : null}

        <nav className="mt-7 flex flex-wrap gap-3" aria-label="Disciplines nationales">
          <DisciplineLink discipline="road" active={discipline === "road"}>Course en ligne</DisciplineLink>
          <DisciplineLink discipline="time_trial" active={discipline === "time_trial"}>Contre-la-montre</DisciplineLink>
        </nav>

        {overviewResult.error ? (
          <div className="mt-7 rounded-2xl border border-red-300 bg-red-50 p-6 font-bold text-red-900">
            Les championnats nationaux ne peuvent pas être chargés pour le moment.
          </div>
        ) : overviewResult.overview?.entries.length ? (
          <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {overviewResult.overview.entries.map((entry) => (
              <ChampionshipCard key={entry.edition.id} entry={entry} />
            ))}
          </div>
        ) : (
          <div className="mt-7 rounded-2xl border border-dashed border-[#315B3E]/30 bg-white/80 p-8 text-center">
            <h2 className="text-xl font-black text-[#0B302B]">Aucune épreuve disponible</h2>
            <p className="mt-2 text-sm font-semibold text-[#688176]">Aucun coureur actif de votre effectif ne correspond à cette discipline pour le moment.</p>
          </div>
        )}
      </section>
    </main>
  );
}

function DisciplineLink({ discipline, active, children }: { discipline: NationalChampionshipType; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={`/jeu/championnats-nationaux?discipline=${discipline}`}
      className={`rounded-xl border px-5 py-3 text-xs font-black uppercase tracking-[0.13em] transition ${active ? "border-[#0B302B] bg-[#0B302B] text-white" : "border-[#315B3E]/20 bg-white text-[#176951] hover:border-[#176951]"}`}
    >
      {children}
    </Link>
  );
}

function ChampionshipCard({ entry }: { entry: NationalChampionshipEntry }) {
  const { edition, eligibleRiderCount } = entry;
  const stage = edition.stages[0];
  const registration = edition.currentTeamRegistration;
  return (
    <article className="group relative overflow-hidden rounded-[1.5rem] border border-[#315B3E]/15 bg-white p-6 shadow-[0_14px_40px_rgba(19,60,46,0.08)] transition hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(19,60,46,0.14)]">
      <span aria-hidden className={`fi fi-${edition.countryCode.toLowerCase()} absolute -right-5 -top-3 text-[7rem] opacity-10`} />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <span className={`fi fi-${edition.countryCode.toLowerCase()} rounded text-3xl shadow`} role="img" aria-label={`Drapeau ${edition.countryName}`} />
          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${registration?.status === "accepted" ? "bg-emerald-100 text-emerald-800" : "bg-[#EAF5F3] text-[#176951]"}`}>
            {registration?.status === "accepted" ? `${registration.rosterCount} engagé${registration.rosterCount > 1 ? "s" : ""}` : "Inscriptions ouvertes"}
          </span>
        </div>
        <h2 className="mt-5 text-xl font-black text-[#0B302B]">{edition.countryName}</h2>
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-[#278B70]">{edition.nationalChampionshipType === "time_trial" ? "Contre-la-montre individuel" : "Course en ligne"}</p>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <Metric label="Éligibles" value={`${eligibleRiderCount} coureur${eligibleRiderCount > 1 ? "s" : ""}`} />
          <Metric label="Parcours" value={stage ? `${stage.distanceKm} km` : "À venir"} />
        </div>
        <Link href={`/jeu/courses/${edition.slug}`} className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#F2C94C] px-4 text-xs font-black uppercase tracking-[0.11em] text-[#071A17] transition group-hover:bg-[#FFD968]">
          {registration?.status === "accepted" ? "Voir mon inscription" : "Composer la sélection"} →
        </Link>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#F4F8F6] p-3"><p className="text-[9px] font-black uppercase tracking-wider text-[#78947D]">{label}</p><p className="mt-1 font-black text-[#0B302B]">{value}</p></div>;
}

function readDiscipline(value: string | string[] | undefined): NationalChampionshipType {
  return readSingle(value) === "time_trial" ? "time_trial" : "road";
}

function readSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
