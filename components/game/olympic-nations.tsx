import type { OlympicOverview } from "@/services/olympic-games";

export function OlympicNations({ overview }: { overview: OlympicOverview }) {
  return <><OlympicDisciplineNations overview={overview} timeTrial={false} /><OlympicDisciplineNations overview={overview} timeTrial /></>;
}

function OlympicDisciplineNations({ overview, timeTrial }: { overview: OlympicOverview; timeTrial: boolean }) {
  const invited = (timeTrial ? overview.timeTrialNations ?? [] : overview.nations).filter((nation) => nation.rider_quota > 0);
  return (
    <section className="mt-7 rounded-3xl border border-[#315B3E]/15 bg-white p-5 sm:p-7">
      <h2 className="text-2xl font-black">{timeTrial ? "Contre-la-montre · nations invitées" : "Course en ligne · nations invitées"}</h2>
      <p className="mt-3 text-sm leading-6 text-[#60756E]">{timeTrial ? "J24 à 14 h · 36 km. Rangs 1–20 : jusqu’à 2 places ; 21–100 : 1. Jusqu’à 100 nations, sans divisions." : "J24 à 18 h · 194 km. Un seul peloton, sans divisions. Rangs 1–10 : jusqu’à 8 places ; 11–30 : 4 ; 31–60 : 2."} Les quotas ne dépassent pas le nombre de coureurs disponibles dans chaque pays.</p>
      <p className="mt-2 text-sm leading-6 text-[#60756E]">{timeTrial ? "Le CLM reprend le classement olympique figé à J4, avec ses propres quotas et ses propres convocations." : "Qualification figée à J4 : 70 % classement UCI national final de la saison précédente, 30 % niveau des quatre meilleurs coureurs sur le parcours."} Aucun effet sur les divisions de la Nations Cup.</p>
      <p className="mt-3 font-bold">{invited.length} nations · {invited.reduce((sum, nation) => sum + nation.rider_quota, 0)} places attribuées / {timeTrial ? 120 : 220} maximum</p>
      {invited.some((nation) => nation.exception_reason === "existing_confirmed_selection") ? <p className="mt-2 text-sm leading-6">Exception de transition en S4 : le Japon conserve 2 places pour honorer une convocation déjà acceptée, à la place de la 60e nation.</p> : null}
      <p className="mt-2 text-sm leading-6">Convocations automatiques dès H−7 jours ; envois jusqu’à H−24 ; réponses des DS jusqu’à H−1. Sans réponse, aucune inscription ni retrait des autres courses.</p>
      {!overview.qualificationFrozenAt ? <p className="mt-4">Les invitations seront publiées à J4.</p> : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[540px] text-left text-sm">
            <thead><tr className="border-b"><th className="p-3">Qualification</th><th className="p-3">Nation</th><th className="p-3">Places</th><th className="p-3">Confirmés</th><th className="p-3">En attente</th><th className="p-3">Meilleur résultat</th></tr></thead>
            <tbody>{invited.map((nation) => <tr key={nation.country_id} className="border-b border-[#315B3E]/10">
              <td className="p-3">#{nation.qualification_rank}{nation.exception_reason === "existing_confirmed_selection" ? <span className="block text-xs text-[#60756E]">Invitation exceptionnelle</span> : null}</td><td className="p-3 font-bold"><span aria-hidden="true" className={`fi fi-${nation.country_code.toLowerCase()} mr-2`} />{nation.country_name}</td>
              <td className="p-3">{nation.rider_quota}</td><td className="p-3">{nation.registered_riders}/{nation.rider_quota}</td><td className="p-3">{nation.pending_riders}</td><td className="p-3">{nation.best_finish == null ? "—" : `#${nation.best_finish}`}</td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
