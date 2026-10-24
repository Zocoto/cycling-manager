import { notFound } from "next/navigation";

import { FederationSponsorsPopover } from "@/components/game/federation-sponsors-popover";
import { getFederationSponsorCoverage } from "@/services/federation-sponsors";

export const metadata = { title: "Sponsors fédération · aperçu local", robots: { index: false, follow: false } };

export default async function FederationSponsorsPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const coverage = await getFederationSponsorCoverage({ countryCode: "BE", teamIds: [] });
  return (
    <main className="min-h-screen bg-[#F3F6F3] p-6 sm:p-12">
      <h1 className="mb-8 text-2xl font-black text-[#183F37]">Sponsors nationaux</h1>
      <article className="max-w-xs rounded-[1.65rem] border border-[#315B3E]/12 bg-white p-5 shadow-[0_14px_36px_rgba(19,60,46,0.06)]">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#60756E]">Partenaires</p>
        <p className="mt-3 text-sm font-black text-[#60756E]">Sponsors nationaux</p>
        <p className="mt-1 text-2xl font-black text-[#183F37]">
          <FederationSponsorsPopover countryName="Belgique" counterLabel={`2 / ${coverage.availableSponsorCount}`} sponsors={coverage.sponsors} />
        </p>
        <p className="mt-2 text-xs font-semibold leading-5 text-[#789087]">Sponsors affiliés sur les marques nationales disponibles</p>
      </article>
    </main>
  );
}
