import { signYouthCandidateAction } from "@/app/jeu/centre-de-formation/actions";
import type { YouthCandidate } from "@/services/youth-development";

export function YouthCandidateRecruitment({ candidate, balance }: {
  candidate: Pick<YouthCandidate, "id" | "firstName" | "lastName" | "age" | "status" | "signingFee">;
  balance: number;
}) {
  if (candidate.status === "signed") {
    return <span className="rounded-full bg-[#72D4B7]/15 px-3 py-2 text-[9px] font-black uppercase text-[#176951]">Déjà recruté</span>;
  }
  if (candidate.status === "expired" || candidate.age > 18) {
    return <span className="rounded-full bg-[#E8E8E2] px-3 py-2 text-[9px] font-black uppercase text-[#60756E]">
      {candidate.age > 18 ? "Indisponible · plus de 18 ans" : "Indisponible au recrutement"}
    </span>;
  }
  return <form action={signYouthCandidateAction}
    data-financial-expense={candidate.signingFee}
    data-financial-label={`la signature de ${candidate.firstName} ${candidate.lastName}`}>
    <input type="hidden" name="candidateId" value={candidate.id} />
    <button disabled={balance < candidate.signingFee}
      className="rounded-xl bg-[#F2C94C] px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-[#071A17] transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-[#D5D6CE]">
      Signer le jeune
    </button>
  </form>;
}
