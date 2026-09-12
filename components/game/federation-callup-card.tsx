import Link from "@/components/ui/app-link";
import { answerFederationCallupAction } from "@/app/jeu/selections-internationales/actions";
import { InternationalSelectionSubmitButton } from "@/components/game/international-selection-submit-button";
import { formatFederationSelectionDeadline, type FederationCallup } from "@/lib/game/federation-callups";

export function FederationCallupCard({ callup }: { callup: FederationCallup }) {
  const canRespond = callup.response_status === "pending" && callup.can_respond;
  const label = callup.response_status === "confirmed" ? "Participation confirmée"
    : callup.response_status === "declined" ? "Participation refusée"
    : canRespond ? "Réponse attendue" : "Délai de réponse dépassé";
  return (
    <article className="rounded-[2rem] border border-[#315B3E]/15 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-[#60756E]">Fédération · {callup.country_name}</p>
          <h2 className="mt-2 text-2xl font-black text-[#183F37]">{callup.rider_name}</h2>
          <p className="mt-2 font-bold text-[#315B3E]">{callup.competition_label}</p>
        </div>
        <span className="rounded-full bg-[#E8F7F1] px-4 py-2 text-xs font-black text-[#176951]">{label}</span>
      </div>
      {callup.race_href ? <Link href={callup.race_href} className="mt-3 inline-block text-sm font-bold text-[#176951] underline underline-offset-4">Voir le profil et la startlist →</Link> : null}
      {canRespond ? (
        <>
          <p className="mt-4 text-sm font-semibold leading-6 text-[#60756E]">
            Vous pouvez répondre dès maintenant, jusqu’au {formatFederationSelectionDeadline(callup.closes_at)} (heure de Paris).
            Après confirmation, le président ne pourra plus retirer ce coureur.
            {callup.rider_category === "professional" ? " La sélection est prioritaire sur les engagements et stages en conflit ; un tour déjà verrouillé reste protégé." : " La participation sera inscrite dans la sélection nationale junior."}
          </p>
          <form action={answerFederationCallupAction} className="mt-5 flex flex-wrap gap-3">
            <input type="hidden" name="memberId" value={callup.member_id} />
            <InternationalSelectionSubmitButton variant="confirm" pendingLabel="Enregistrement…" name="decision" value="confirm">Confirmer la participation</InternationalSelectionSubmitButton>
            <InternationalSelectionSubmitButton variant="decline" pendingLabel="Enregistrement…" name="decision" value="decline">Refuser</InternationalSelectionSubmitButton>
          </form>
        </>
      ) : callup.response_status === "confirmed" ? (
        <p className="mt-4 text-sm font-semibold text-[#60756E]">La participation est enregistrée et verrouillée dans la liste du président.</p>
      ) : null}
    </article>
  );
}
