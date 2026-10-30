import { recoverEmptyTeamRosterAction } from "@/app/jeu/effectif/actions";
import type { EmptyRosterRecoveryState } from "@/services/empty-roster-recovery";
import { EmptyRosterRecoverySubmitButton } from "./empty-roster-recovery-submit-button";

export function EmptyRosterRecovery({ state }: { state: EmptyRosterRecoveryState }) {
  if (!state.available && !state.recovered_this_season) return null;
  return (
    <section
      id="relancer-effectif"
      aria-labelledby="relancer-effectif-title"
      data-site-theme-preserve
      className="mt-5 scroll-mt-6 rounded-2xl border border-[#C99B36]/50 bg-[#FFF8DC] p-5 text-[#183F37] shadow-sm sm:p-6"
    >
      <p className="text-xs font-extrabold uppercase tracking-wider text-[#78591D]">Un nouveau départ</p>
      <h2 id="relancer-effectif-title" className="mt-2 text-xl font-black">Votre équipe peut reprendre la route</h2>
      {state.available ? (
        <>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6">
            Votre effectif est vide. Relancez-le avec 7 coureurs de départ générés pour votre équipe.
          </p>
          <p className="mt-2 text-sm font-bold">Nationalité des 7 coureurs : {state.team_country_name}.</p>
          <p className="mt-2 max-w-3xl text-sm leading-6">
            Les coureurs ont le niveau d’un effectif débutant et des contrats avec le salaire habituel correspondant à leurs notes. Votre club, sa trésorerie, ses infrastructures et son historique sont conservés.
          </p>
          <p className="mt-2 text-xs font-semibold text-[#78591D]">
            Une seule relance par saison, uniquement sans coureur sous contrat pour la saison en cours.
          </p>
          <form action={recoverEmptyTeamRosterAction} className="mt-4">
            <EmptyRosterRecoverySubmitButton />
          </form>
        </>
      ) : (
        <p className="mt-2 text-sm font-semibold leading-6">
          La relance d’effectif a déjà été utilisée cette saison. Vous pouvez continuer à recruter au Bureau des transferts.
        </p>
      )}
    </section>
  );
}
