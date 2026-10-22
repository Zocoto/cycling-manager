import { notFound } from "next/navigation";
import { RiderPreparationCenter } from "@/components/game/rider-preparation-center";
import { TEAM_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS } from "@/lib/game/infrastructure-specializations";
import type { TeamRiderPreparationOverview } from "@/services/team-rider-preparation";
import { PreviewShield } from "./preview-shield";

export const metadata = { title: "Préparation · aperçu local", robots: { index: false, follow: false } };

export default function PreparationPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const codes = { cobbles_center: "cobbles_precision", hills_circuit: "hills_durability", mountain_base: "mountain_group" };
  const facility = (specializationCode: string | null = null) => ({ level: 5, activePreparationId: null, activePreparationIds: [], specializationCode });
  const overview: TeamRiderPreparationOverview = {
    teamName: "Équipe Démonstration", seasonName: "Saison 4", currentDayNumber: 10, currentGameDayIndex: 121,
    facilities: { indoor_track: facility(), wind_tunnel: facility(), cobbles_center: facility(codes.cobbles_center), hills_circuit: facility(codes.hills_circuit), mountain_base: facility(codes.mountain_base) },
    riders: [{ id: "demo", firstName: "Alex", lastName: "Exemple", countryCode: "FR" }], preparations: [],
  };
  return <main className="mx-auto max-w-6xl p-5 sm:p-8">
    <p className="mb-5 text-sm font-semibold">Aperçu local · données fictives · envoi désactivé</p>
    <PreviewShield><RiderPreparationCenter overview={overview} /></PreviewShield>
    <section className="mt-8 grid gap-5 md:grid-cols-3">
      {TEAM_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS.filter(proposal => proposal.buildingCode in codes).map(proposal => <article key={proposal.buildingCode} className="rounded-3xl border bg-white p-6">
        <h2 className="text-xl font-black text-[#183F37]">{proposal.buildingName}</h2>
        <p className="mt-2 text-sm">Orientations · choix dès le niveau 3</p>
        {proposal.options.map(option => <div key={option.code} className="mt-5"><h3 className="font-bold">{option.name}</h3><p className="mt-1 text-sm">{option.primaryEffect}</p></div>)}
      </article>)}
    </section>
  </main>;
}
