import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";

import { FederationHostingResultViewMarker } from "@/components/game/federation-hosting-result-view-marker";
import { GameHeader } from "@/components/game/game-header";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";

export const metadata: Metadata = { title: "Résultats des compétitions accueillies" };

const archivePath = "/jeu/resultats/accueils";
const editionIdSchema = z.uuid();
const resultRowSchema = z.object({
  rank: z.number(),
  rider_name: z.string(),
  team_name: z.string().nullable(),
  elapsed_time_seconds: z.number().nullable(),
  gap_to_winner_seconds: z.number().nullable(),
});
const archiveSchema = z.object({
  editions: z.array(z.object({
    edition_id: z.string(),
    is_junior: z.boolean(),
    target_game_year: z.number(),
    name: z.string(),
  })),
  classification: z.array(resultRowSchema),
});

type ResultRow = z.infer<typeof resultRowSchema>;

export default async function HostingResultsArchivePage({ searchParams }: {
  searchParams: Promise<{ epreuve?: string | string[] }>;
}) {
  const [supabase, { epreuve }] = await Promise.all([createSupabaseServerClient(), searchParams]);
  const { data: { user }, error: authenticationError } = await getAuthenticatedUser(supabase);
  if (authenticationError || !user) redirect("/connexion");

  const selectedId = editionIdSchema.safeParse(epreuve).data ?? null;
  const [headerData, archive] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    supabase.rpc("get_recent_federation_hosting_result_archive", {
      p_edition_id: selectedId,
    }),
  ]);
  if (archive.error) throw new Error(`Impossible de charger les résultats des accueils (${archive.error.code}).`);

  const { editions, classification: results } = archiveSchema.parse(archive.data);
  const selected = editions.find((edition) => edition.edition_id === selectedId);

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorVisual}
        maxWidth="wide"
      />
      <div className="mx-auto max-w-[1280px] space-y-5 px-4 py-8 sm:px-8">
        <Link href="/jeu/resultats" className="inline-flex min-h-10 items-center rounded-xl border border-[#176951]/20 bg-white px-4 text-sm font-black text-[#176951]">
          ← Résultats / Live
        </Link>
        <header className="rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-8 text-white sm:px-10">
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Résultats des compétitions accueillies</h1>
          <p className="mt-3 text-sm font-semibold text-[#C7DBD2]">Classements officiels de la saison précédente encore ouverts à la consultation.</p>
        </header>
        {editions.length === 0 ? (
          <p className="rounded-2xl border border-[#315B3E]/15 bg-white p-5 text-sm font-semibold text-[#48665F]">Aucun résultat à consulter pour le moment.</p>
        ) : (
          <nav aria-label="Épreuves" className="flex flex-wrap gap-2">
            {editions.map((edition) => (
              <Link key={edition.edition_id} href={`${archivePath}?epreuve=${edition.edition_id}`} prefetch={false}
                aria-current={selected?.edition_id === edition.edition_id ? "page" : undefined}
                className={selected?.edition_id === edition.edition_id
                  ? "rounded-xl bg-[#176951] px-4 py-3 text-sm font-bold text-white"
                  : "rounded-xl border border-[#176951]/20 bg-white px-4 py-3 text-sm font-bold text-[#176951]"}>
                {edition.name} · S{edition.target_game_year}
              </Link>
            ))}
          </nav>
        )}
        {selected && results.length > 0 ? (
          <section className="overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-white">
            <FederationHostingResultViewMarker editionId={selected.edition_id} isJunior={selected.is_junior} />
            <h2 className="px-5 py-4 text-xl font-black">{selected.name}</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-left text-sm">
                <thead className="bg-[#0B302B] text-xs font-black uppercase tracking-wide text-white">
                  <tr><th scope="col" className="px-4 py-3">#</th><th scope="col" className="px-4 py-3">Coureur</th><th scope="col" className="px-4 py-3">Nation</th><th scope="col" className="px-4 py-3 text-right">Temps / écart</th></tr>
                </thead>
                <tbody className="divide-y divide-[#315B3E]/10">
                  {results.map((result) => (
                    <tr key={result.rank} className={result.rank <= 3 ? "bg-[#FFF9DE]" : "even:bg-[#F8FBF9]"}>
                      <td className="px-4 py-3 font-black text-[#176951]">{result.rank}</td>
                      <td className="px-4 py-3 font-bold">{result.rider_name}</td>
                      <td className="px-4 py-3 text-[#48665F]">{result.team_name ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums">{formatClassificationTime(result)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function formatClassificationTime(result: ResultRow): string {
  const seconds = result.rank === 1 ? result.elapsed_time_seconds : result.gap_to_winner_seconds;
  if (seconds === null) return "—";
  const clock = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60];
  return `${result.rank === 1 ? "" : "+"}${clock.map((part) => String(part).padStart(2, "0")).join(":")}`;
}
