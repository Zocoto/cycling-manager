import Link from "@/components/ui/app-link";
import { SEASON_FINALE_GALA_PRIZES } from "@/lib/game/season-finale-gala";
import { SEASON_FINALE_GALA_RESULTS } from "@/lib/game/season-finale-gala-results-data";
import type { SeasonFinaleGalaPublishedReward } from "@/services/season-finale-gala-results";
import { SeasonFinaleGalaReplay } from "./season-finale-gala-replay";
import styles from "./season-finale-gala.module.css";

type Props = {
  videoIds: Record<number, string | null>;
  rewards: SeasonFinaleGalaPublishedReward[] | null;
};

export function SeasonFinaleGalaResults({ videoIds, rewards }: Props) {
  const rewardByPlace = new Map((rewards ?? []).map((reward) => [`${reward.group_number}:${reward.rank}`, reward]));
  const awardsByTeam = new Map<string, { teamId: string; teamName: string; managerName: string | null; awards: Array<{ group: number; rank: number; riderName: string; itemName: string; summary: string; allocated: boolean }> }>();

  for (const group of SEASON_FINALE_GALA_RESULTS) {
    for (const row of group.rows.filter((row) => row.rank <= 5)) {
      const prize = SEASON_FINALE_GALA_PRIZES.find((prize) => prize.rank === row.rank)!;
      const candidate = rewardByPlace.get(`${group.groupNumber}:${row.rank}`);
      const granted = candidate?.team_id === row.teamId && candidate.rider_id === row.riderId ? candidate : undefined;
      const beneficiary = awardsByTeam.get(row.teamId) ?? { teamId: row.teamId, teamName: row.teamName, managerName: granted?.manager_name ?? null, awards: [] };
      beneficiary.managerName ??= granted?.manager_name ?? null;
      beneficiary.awards.push({ group: group.groupNumber, rank: row.rank, riderName: row.riderName, itemName: granted?.item_name ?? prize.name, summary: granted?.summary ?? prize.summary, allocated: Boolean(granted?.allocated_at) });
      awardsByTeam.set(row.teamId, beneficiary);
    }
  }

  return (
    <>
      <section id="resultats-gala" aria-label="Films et classements du gala" className="scroll-mt-6">
        {SEASON_FINALE_GALA_RESULTS.map((group) => (
          <article key={group.groupNumber} className={styles.resultGroup} aria-labelledby={`gala-group-${group.groupNumber}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id={`gala-group-${group.groupNumber}`} className="text-xl font-semibold text-[#F0E3C2]">{group.label}</h2>
              <span className="text-xs text-[#A5A9B3]">{group.teams.length} équipes engagées</span>
            </div>
            <details className="mt-3 rounded-lg border border-[#393C44] bg-[#111215] p-3" open>
              <summary className="cursor-pointer text-xs font-semibold text-[#BFC3CE]">Les équipes de cette poule</summary>
              <ul className="mt-3 flex list-none flex-wrap gap-1.5 p-0" aria-label={`Équipes de la poule ${group.groupNumber}`}>
                {group.teams.map((team) => (
                  <li key={team.teamId}><Link href={`/jeu/equipes/${team.teamId}`} className="block rounded-md border border-[#393C44] bg-[#17191D] px-2 py-1 text-[10px] text-[#C1C4CC] hover:border-[#8F7C50] hover:text-[#F0E3C2]">{team.teamName}</Link></li>
                ))}
              </ul>
            </details>
            <div className={styles.resultColumns}>
              <SeasonFinaleGalaReplay videoId={videoIds[group.groupNumber] ?? null} groupNumber={group.groupNumber} />
              <section className={styles.classification} aria-labelledby={`gala-classification-${group.groupNumber}`}>
                <h3 id={`gala-classification-${group.groupNumber}`} className="px-4 py-3 text-sm font-semibold text-[#E5E7ED]">Classement · Top 20</h3>
                <div className={styles.classificationScroll} tabIndex={0} role="region" aria-label={`Classement de la poule ${group.groupNumber}, défilement vertical`}>
                  <table className="w-full border-collapse text-xs">
                    <caption className="sr-only">Top 20 de la poule {group.groupNumber}. Temps du vainqueur : {group.winnerTime}.</caption>
                    <thead className="sticky top-0 bg-[#17191D] text-[10px] uppercase tracking-wide text-[#A5A9B3]">
                      <tr><th scope="col" className="w-10 px-3 py-2 text-left">Pl.</th><th scope="col" className="px-2 py-2 text-left">Coureur · Équipe</th><th scope="col" className="px-3 py-2 text-right">Temps</th></tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => (
                        <tr key={row.rank} className={`border-t border-[#393C44]/60 ${row.rank <= 3 ? "bg-[#252117]/50" : ""}`}>
                          <td className={`px-3 py-2 align-top font-bold ${row.rank <= 5 ? "text-[#D2B46B]" : "text-[#A5A9B3]"}`}>{row.rank}</td>
                          <td className="min-w-0 px-2 py-2">
                            <Link href={`/jeu/coureurs/${row.riderId}`} className="font-semibold text-[#E5E7ED] hover:text-[#D2B46B]">{row.riderName}</Link>
                            <Link href={`/jeu/equipes/${row.teamId}`} className="mt-0.5 block text-[10px] leading-4 text-[#A5A9B3] hover:text-[#D2B46B]">{row.teamName}</Link>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right align-top font-medium tabular-nums text-[#D2B46B]">{row.rank === 1 ? group.winnerTime : formatGalaGap(row.gapSeconds)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="border-t border-[#393C44] px-4 py-2 text-[10px] leading-4 text-[#A5A9B3]">Les 20 premiers, d’après les résultats PCM. Les cinq premières places de chaque poule sont récompensées.</p>
              </section>
            </div>
          </article>
        ))}
      </section>
      <section id="gains-gala" aria-labelledby="gala-gains" className="mt-8 scroll-mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="gala-gains" className="text-xl font-semibold text-[#F0E3C2]">Les gains par membre</h2>
          <span className="text-xs text-[#A5A9B3]">10 lots · {awardsByTeam.size} équipes récompensées</span>
        </div>
        <p className="mt-2 text-xs leading-5 text-[#A5A9B3]">Un lot par place dans le top 5 : une même équipe peut donc remporter plusieurs objets. Les autres équipes ne remportent pas de lot pour cette édition.</p>
        {rewards === null ? <p role="status" className="mt-3 rounded-lg border border-[#8F7C50] bg-[#252117] px-3 py-2 text-xs text-[#E2C784]">Le suivi des attributions est temporairement indisponible. Les lots remportés restent indiqués ci-dessous.</p> : null}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[...awardsByTeam.values()].map((team) => (
            <article key={team.teamId} className="min-w-0 rounded-xl border border-[#393C44] bg-[#111215] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[#E5E7ED]">{team.managerName ?? "DS de l’équipe"}</h3>
                  <Link href={`/jeu/equipes/${team.teamId}`} className="mt-0.5 block text-xs text-[#A5A9B3] hover:text-[#D2B46B]">{team.teamName}</Link>
                </div>
                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${team.awards.every((award) => award.allocated) ? "bg-[#163C2D] text-[#A8DBC0]" : "bg-[#252117] text-[#E2C784]"}`}>
                  {team.awards.every((award) => award.allocated) ? "Dans l’inventaire ✓" : rewards === null ? "Attribution à vérifier" : "Attribution en attente"}
                </span>
              </div>
              <ul className="mt-3 list-none space-y-3 p-0">
                {team.awards.map((award) => (
                  <li key={`${award.group}:${award.rank}`} className="border-t border-[#393C44] pt-3">
                    <p className="text-[10px] text-[#A5A9B3]">Poule {award.group} · {award.rank}{award.rank === 1 ? "er" : "e"} · {award.riderName}</p>
                    <p className="mt-1 text-xs font-semibold text-[#E5E7ED]">{award.itemName}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-[#D2B46B]">{award.summary}</p>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export function formatGalaGap(seconds: number) {
  if (seconds === 0) return "m.t.";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `+${minutes}′${String(remainder).padStart(2, "0")}″` : `+${remainder}″`;
}
