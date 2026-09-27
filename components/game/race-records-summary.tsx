import Link from "@/components/ui/app-link";
import type {
  RaceHistoricalRecord,
  RaceHistoricalRecordType,
} from "@/services/race-calendar";

export function RaceRecordsSummary({
  records,
  isStageRace,
  hasError = false,
}: {
  records: RaceHistoricalRecord[];
  isStageRace: boolean;
  hasError?: boolean;
}) {
  const overallRecords = records.filter(
    (record) => record.type === "overall" && record.rank <= 8,
  );
  const stageRecords = records.filter(
    (record) => record.type === "stage" && record.rank <= 8,
  );

  if (overallRecords.length === 0 && stageRecords.length === 0) {
    return hasError ? (
      <p className="mt-4 rounded-xl border border-dashed border-[#315B3E]/25 bg-white px-4 py-3 text-xs font-semibold text-[#688176]">
        Le livre des records est momentanément indisponible.
      </p>
    ) : null;
  }

  return (
    <section className="mt-5 rounded-[1.35rem] border border-[#315B3E]/15 bg-white p-4 shadow-[0_12px_32px_rgba(19,60,46,0.07)] sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#B07A16]">
            Livre des records
          </p>
          <h3 className="mt-1 text-lg font-black text-[#0B302B]">
            Les références historiques à battre
          </h3>
        </div>
        <span className="rounded-full bg-[#FFF4C7] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#8A6514]">
          Top 8
        </span>
      </div>

      <div
        className={`mt-4 grid gap-4 ${
          isStageRace && stageRecords.length > 0
            ? "lg:grid-cols-2"
            : "grid-cols-1"
        }`}
      >
        <RecordBoard
          type="overall"
          title={
            isStageRace
              ? "Victoires au classement général"
              : "Victoires sur la classique"
          }
          description={
            isStageRace
              ? "Les coureurs qui ont le plus souvent remporté le classement final."
              : "Les coureurs qui ont le plus souvent inscrit leur nom au palmarès."
          }
          records={overallRecords}
        />

        {isStageRace && stageRecords.length > 0 ? (
          <RecordBoard
            type="stage"
            title="Victoires d’étapes"
            description="Les chasseurs d’étapes les plus prolifiques de l’histoire de ce tour."
            records={stageRecords}
          />
        ) : null}
      </div>
    </section>
  );
}

function RecordBoard({
  type,
  title,
  description,
  records,
}: {
  type: RaceHistoricalRecordType;
  title: string;
  description: string;
  records: RaceHistoricalRecord[];
}) {
  if (records.length === 0) return null;

  return (
    <article className="overflow-hidden rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9]">
      <header className="border-b border-[#315B3E]/10 px-4 py-3.5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg ${
              type === "stage"
                ? "bg-[#DDEBF9] text-[#256A9B]"
                : "bg-[#FFF0BC] text-[#9B6A12]"
            }`}
          >
            {type === "stage" ? "⚡" : "★"}
          </span>
          <div>
            <h4 className="text-sm font-black text-[#0B302B]">{title}</h4>
            <p className="mt-0.5 text-[11px] font-semibold leading-4 text-[#688176]">
              {description}
            </p>
          </div>
        </div>
      </header>

      <ol className="divide-y divide-[#315B3E]/8">
        {records.map((record) => (
          <li
            key={`${type}-${record.riderId}`}
            className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2.5 px-4 py-3"
          >
            <span
              className={`grid h-8 w-8 place-items-center rounded-full text-[11px] font-black ${getRankClassName(
                record.rank,
              )}`}
              aria-label={`Rang ${record.rank}`}
            >
              {record.rank}
            </span>
            <span className="min-w-0">
              <Link
                href={`/jeu/coureurs/${record.riderId}`}
                target="_blank"
                rel="noreferrer"
                className="block truncate text-sm font-black text-[#0B302B] transition hover:text-[#176951]"
              >
                {record.riderName}
              </Link>
              <span className="block truncate text-[10px] font-semibold text-[#789087]">
                {formatWinningSeasons(record.gameYears)} · {record.latestTeamName}
              </span>
            </span>
            <span className="rounded-xl bg-[#0B302B] px-2.5 py-1.5 text-right text-[10px] font-black text-white">
              <strong className="text-sm text-[#F2C94C]">
                {record.victoryCount}
              </strong>{" "}
              {record.victoryCount > 1 ? "victoires" : "victoire"}
            </span>
          </li>
        ))}
      </ol>
    </article>
  );
}

function formatWinningSeasons(gameYears: number[]) {
  const seasons = [...new Set(gameYears)].sort((first, second) => first - second);
  if (seasons.length === 0) return "Saison historique";
  return seasons.map((gameYear) => `S${gameYear}`).join(" · ");
}

function getRankClassName(rank: number) {
  if (rank === 1) return "bg-[#F2C94C] text-[#473300] shadow-sm";
  if (rank === 2) return "bg-[#DDE5E2] text-[#365149]";
  if (rank === 3) return "bg-[#E9C4A5] text-[#6B3E1F]";
  return "bg-[#E8F3EE] text-[#315B3E]";
}
