import type { DevelopmentRace } from "@/services/development-team";

export function JuniorChampionshipResultEmptyState({
  status,
}: {
  status: DevelopmentRace["status"];
}) {
  const cancelled = status === "cancelled";

  return (
    <div className="px-6 py-12 text-center">
      <p className="font-black text-[#183F37]">
        {cancelled
          ? "Cette épreuve a été annulée."
          : "Le résultat n’est pas encore publié."}
      </p>
      <p className="mt-2 text-sm font-semibold text-[#60756E]">
        {cancelled
          ? "Aucun classement ne sera publié pour cette édition."
          : "Les sélections sont consultables dès maintenant ; le classement apparaîtra automatiquement après la course."}
      </p>
    </div>
  );
}
