import Link from "@/components/ui/app-link";
import {
  getPantheonHref,
  PANTHEON_CATEGORIES,
  PANTHEON_PAGE_SIZE,
  PANTHEON_PATH,
  type PantheonCategory,
  type PantheonFilters,
  type PantheonKind,
  type PantheonSort,
} from "@/lib/game/pantheon";
import type { PantheonData, PantheonRank, PantheonWinner } from "@/services/pantheon";

const kinds = {
  race: "Course d’un jour",
  general: "Classement général",
  stage: "Étape",
  team: "Épreuve par équipes",
} satisfies Record<PantheonKind, string>;

const field = "min-h-11 w-full min-w-0 rounded-xl border border-[#B9D0C5] bg-white px-3 py-2 text-base text-[#183F37] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176951]";
const button = "inline-flex min-h-11 items-center justify-center rounded-xl border border-[#B9D0C5] px-4 text-sm font-bold text-[#176951] hover:bg-[#EAF5F3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176951]";
const number = new Intl.NumberFormat("fr-FR");

export function PantheonRecords({ filters, records }: {
  filters: PantheonFilters;
  records: PantheonData;
}) {
  const ranking = records.view === "classement";
  const clearHref = getPantheonHref(filters, { category: "all", kind: "all", query: "", season: null, raceKey: null, page: 1 });
  const filtered = Boolean(filters.query || filters.season || filters.raceKey || filters.category !== "all" || filters.kind !== "all");
  const pages = Math.max(1, Math.ceil(records.total / PANTHEON_PAGE_SIZE));

  return (
    <section aria-labelledby="pantheon-records-heading" className="mt-5 overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-white shadow-[0_12px_35px_#133c2e12]">
      <div className="border-b border-[#D8E5DE] bg-[#F8FBF9] px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="pantheon-records-heading" className="font-serif text-2xl font-black text-[#143D33]">
            {ranking ? "Classement historique" : "Registre des victoires"}
          </h2>
          <p className="text-sm tabular-nums text-[#415E52]">{number.format(records.total)}{" "}
            {ranking ? (records.total === 1 ? "coureur classé" : "coureurs classés") : (records.total === 1 ? "victoire" : "victoires")}
          </p>
        </div>

        <form method="get" action={PANTHEON_PATH} key={getPantheonHref(filters)} className="mt-4 flex flex-wrap items-end gap-3">
          {ranking ? <input type="hidden" name="vue" value="classement" /> : null}
          {!ranking && filters.raceKey ? <input type="hidden" name="course" value={filters.raceKey} /> : null}
          <label className="min-w-0 flex-[2_1_15rem] text-sm font-semibold text-[#415E52]">
            {ranking ? "Rechercher un coureur" : "Rechercher une course ou un vainqueur"}
            <input type="search" name="q" maxLength={80} defaultValue={filters.query} className={`mt-1 ${field}`} />
          </label>
          <label className="flex-[1_1_9rem] text-sm font-semibold text-[#415E52]">
            Catégorie
            <select name="categorie" defaultValue={filters.category} className={`mt-1 ${field}`}>
              <option value="all">Toutes les catégories</option>
              {Object.entries(PANTHEON_CATEGORIES).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </label>
          {ranking ? (
            <label className="flex-[1_1_12rem] text-sm font-semibold text-[#415E52]">
              Trier par
              <select name="tri" defaultValue={filters.sort === "wins" ? "victoires" : filters.sort} className={`mt-1 ${field}`}>
                <option value="points">Points de prestige</option>
                <option value="victoires">Nombre de victoires</option>
                <option value="prestige">Olympique · victoires par catégorie</option>
              </select>
            </label>
          ) : (
            <>
              <label className="flex-[1_1_8rem] text-sm font-semibold text-[#415E52]">
                Saison
                <select name="saison" defaultValue={filters.season ?? ""} className={`mt-1 ${field}`}>
                  <option value="">Toutes les saisons</option>
                  {records.seasons.map((season) => <option key={season.game_year} value={season.game_year}>{season.season_name}</option>)}
                </select>
              </label>
              <label className="flex-[1_1_9rem] text-sm font-semibold text-[#415E52]">
                Type de victoire
                <select name="type" defaultValue={filters.kind} className={`mt-1 ${field}`}>
                  <option value="all">Tous les types</option>
                  {Object.entries(kinds).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </label>
            </>
          )}
          <button type="submit" className="min-h-11 rounded-xl bg-[#176951] px-5 text-sm font-bold text-white hover:bg-[#104C3C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176951]">
            {ranking ? "Appliquer" : "Filtrer"}
          </button>
          {filtered ? <Link href={clearHref} className={button}>Effacer les filtres</Link> : null}
        </form>

        {!ranking && filters.raceKey ? (
          <p className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[#415E52]">
            <strong>{records.race_name ?? records.items[0]?.race_name ?? "Course sélectionnée"}</strong>
            <Link href={getPantheonHref(filters, { raceKey: null, page: 1 })} className="min-h-11 content-center underline underline-offset-4">
              Voir toutes les courses
            </Link>
          </p>
        ) : null}
        {ranking ? (
          <details className="mt-4 text-sm text-[#415E52]">
            <summary className="w-fit cursor-pointer rounded font-bold text-[#176951] focus-visible:outline-2 focus-visible:outline-offset-2">Comment le classement est calculé</summary>
            <div className="mt-2 max-w-3xl space-y-2 leading-6">
              <p>Le mode olympique compare d’abord les victoires dans les Grands Tours et Monuments, puis en Élite, et ainsi de suite jusqu’aux Juniors. Les points de prestige départagent les coureurs à égalité.</p>
              <p>Le général d’un Grand Tour ou la victoire dans un Monument rapporte 14 points. Pour les autres courses, le barème va de 12 en Élite à 2 en Local ou en Juniors, par paliers de 2 points. Une étape vaut la moitié du barème de sa catégorie. Les victoires par équipes figurent dans le palmarès des courses.</p>
            </div>
          </details>
        ) : null}
      </div>

      {records.items.length === 0 ? (
        <p className="px-6 py-10 text-center text-[#415E52]">{ranking ? "Aucun coureur ne correspond à ces filtres." : "Aucune victoire ne correspond à ces filtres."}</p>
      ) : ranking ? <Ranking rows={records.items} category={filters.category} sort={filters.sort} /> : <Winners rows={records.items} filters={filters} />}

      {pages > 1 || filters.page > 1 ? (
        <nav aria-label="Pages du Panthéon" className="flex flex-wrap items-center justify-between gap-3 border-t border-[#D8E5DE] px-4 py-4 sm:px-6">
          <p className="text-sm tabular-nums text-[#415E52]">{`Page ${number.format(filters.page)} sur ${number.format(pages)}`}</p>
          <div className="flex flex-wrap gap-2">
            {filters.page > 1 ? <Link href={getPantheonHref(filters, { page: Math.min(pages, filters.page - 1) })} className={button}>Précédent</Link> : null}
            {filters.page < pages ? <Link href={getPantheonHref(filters, { page: filters.page + 1 })} className={button}>Suivant</Link> : null}
          </div>
        </nav>
      ) : null}
    </section>
  );
}

function Winners({ rows, filters }: { rows: PantheonWinner[]; filters: PantheonFilters }) {
  return (
    <ul className="divide-y divide-[#D8E5DE]">
      {rows.map((winner) => (
        <li key={winner.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,0.6fr)] sm:items-center sm:px-6">
          <div className="min-w-0">
            <div className="text-sm text-[#415E52]"><span data-i18n-skip="">{winner.season_name}</span> · {PANTHEON_CATEGORIES[winner.category] ?? winner.category}</div>
            <h3 className="mt-1 wrap-anywhere font-bold text-[#183F37]">
              {filters.raceKey ? <span data-i18n-skip="">{winner.race_name}</span> : (
                <Link href={getPantheonHref(filters, { raceKey: winner.race_key, season: null, query: "", kind: "all", category: "all", page: 1 })} className="underline decoration-[#82AB96] underline-offset-4 hover:text-[#176951]" data-i18n-skip="">
                  {winner.race_name}
                </Link>
              )}
            </h3>
          </div>
          <div className="min-w-0">
            <RiderIdentity rider={winner} />
            {winner.rider_name && winner.team_name ? <p className="mt-1 wrap-anywhere text-sm text-[#415E52]" data-i18n-skip="">{winner.team_name}</p> : null}
          </div>
          <div className="text-sm text-[#415E52] sm:text-right">
            <span>{kinds[winner.kind]}</span>
            {winner.stage_name ? <p className="mt-1 wrap-anywhere" data-i18n-skip="">{winner.stage_name}</p> : null}
            {winner.result_href ? (
              <Link href={winner.result_href} className="mt-1 inline-block font-semibold text-[#176951] underline underline-offset-4">Résultat</Link>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Ranking({ rows, category, sort }: { rows: PantheonRank[]; category: PantheonCategory | "all"; sort: PantheonSort }) {
  const byPoints = sort === "points";
  return (
    <ol className="divide-y divide-[#D8E5DE]">
      {rows.map((rider) => (
        <li key={rider.rider_key ?? rider.rider_id} className="grid grid-cols-[2.5rem_minmax(0,1fr)_max-content] items-start gap-x-3 gap-y-2 px-4 py-4 sm:grid-cols-[3.25rem_minmax(0,1fr)_max-content] sm:items-center sm:px-6">
          <span className={`flex min-h-10 items-center justify-center rounded-lg px-1.5 text-sm font-black tabular-nums ${rider.rank === 1 ? "bg-[#F5E6BC] text-[#563D12]" : "bg-[#EDF5F0] text-[#285642]"}`}>
            {number.format(rider.rank)}
          </span>
          <RiderIdentity rider={rider} />
          <div className="flex flex-col text-right tabular-nums">
            <p className={byPoints ? "" : "order-2"}>
              <span className={byPoints ? "text-lg font-bold text-[#143D33]" : "text-sm text-[#415E52]"}>{number.format(rider.points)} pts</span>
            </p>
            <p className={byPoints ? "text-sm text-[#415E52]" : "font-bold text-[#143D33]"}>
              {number.format(rider.wins)}{" "}{rider.wins === 1 ? "victoire" : "victoires"}
            </p>
          </div>
          {category === "all" ? (
            <ul className="col-span-2 col-start-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#415E52]">
              {Object.entries(PANTHEON_CATEGORIES).map(([code, label]) => {
                const wins = rider.category_wins[code as PantheonCategory];
                return wins ? <li key={code}><span className="mr-1 font-bold tabular-nums text-[#143D33]">{number.format(wins)}</span>{label}</li> : null;
              })}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function RiderIdentity({ rider }: {
  rider: Pick<PantheonWinner, "rider_id" | "rider_name" | "country_code" | "retired"> & { team_name?: string | null };
}) {
  const name = rider.rider_name ?? rider.team_name ?? "Vainqueur non renseigné";
  const code = rider.country_code?.toLowerCase();
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      {code && /^[a-z]{2}$/.test(code) ? <span aria-label={code.toUpperCase()} role="img" className={`fi fi-${code} shrink-0 rounded-sm`} /> : null}
      {rider.rider_id ? (
        <Link href={`/jeu/coureurs/${encodeURIComponent(rider.rider_id)}`} data-i18n-skip="" className="min-w-0 wrap-anywhere font-bold text-[#176951] hover:underline">{name}</Link>
      ) : <span className="min-w-0 wrap-anywhere font-bold" data-i18n-skip={rider.rider_name || rider.team_name ? "" : undefined}>{name}</span>}
      {rider.retired ? <span className="rounded-md bg-[#EEF2EF] px-2 py-0.5 text-xs font-semibold text-[#415E52]">Retraité</span> : null}
    </div>
  );
}
