import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { NationalFederationJerseyWorkshop } from "@/components/game/national-federation-jersey-workshop";
import { NationalFederationJersey } from "@/components/game/national-federation-jersey";
import { RiderAvatar } from "@/components/game/rider-avatar";
import { createNationalChampionRiderJersey } from "@/lib/rider-jersey";
import { PREVIEW_MAURITIUS_SELECTION as selection, PREVIEW_MAURITIUS_CHAMPION as champion, previewPublishedJersey } from "@/lib/game/federation-jersey-preview-fixtures";

export const metadata = { title: "Aperçu · Les deux maillots fédéraux", robots: { index: false, follow: false } };

export default function FederationJerseysPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return <main className="min-h-screen bg-[#F1F6F2] pb-20 text-[#183F37]" style={{ "--federation-primary": "#102E4D", "--federation-secondary": "#176951", "--federation-accent": "#F4D233", "--federation-soft": "#EAF5EE" } as CSSProperties}>
    <header className="bg-[#092B26] px-6 py-9 text-white"><div className="mx-auto max-w-6xl">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-[#A8DEC6]">Cyclo Stratège · atelier fédéral</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-5"><div><h1 className="text-3xl font-black sm:text-4xl">Une nation, deux identités.</h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#C4DAD2]">La sélection rassemble le pays. Le titre national distingue ses champions. Des compositions indépendantes, un même atelier.</p></div>
        <span className="rounded-full border border-[#F4D233]/35 bg-[#F4D233]/10 px-4 py-2 text-xs font-black text-[#F4D233]">Aperçu local · non publié</span></div>
      <nav className="mt-6 flex flex-wrap gap-5 text-xs font-black text-[#A8DEC6]"><a href="#atelier">L’atelier ↓</a><a href="#pays">Fiche du pays ↓</a><a href="#classement">Classement UCI ↓</a><a href="#startlist">Inscriptions internationales ↓</a></nav>
    </div></header>
    <div className="mx-auto max-w-6xl space-y-12 px-5 pt-8 sm:px-8">
      <section id="atelier" className="scroll-mt-6"><NationalFederationJerseyWorkshop countryCode="MU" countryName="Maurice"
        selectionJersey={previewPublishedJersey(selection)} championJersey={previewPublishedJersey(champion)} canEdit previewOnly /></section>
      <section id="pays" className="scroll-mt-6"><Eyebrow>Sur la fiche publique du pays</Eyebrow><h2 className="mt-2 text-2xl font-black">Maurice · ses couleurs, ses maillots</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">{(["national_team", "national_champion"] as const).map((kind) => <article key={kind} className="flex items-center gap-5 rounded-2xl border border-[#315B3E]/10 bg-white p-6">
          <NationalFederationJersey countryCode="MU" countryName="Maurice" kind={kind} design={kind === "national_team" ? selection : champion} className="h-40 w-32 shrink-0 drop-shadow-xl" />
          <div><h3 className="text-lg font-black">{kind === "national_team" ? "Sélection nationale" : "Champions nationaux"}</h3><p className="mt-2 text-sm font-semibold leading-6 text-[#60756E]">{kind === "national_team" ? "La tenue des rendez-vous internationaux, commune à tous les sélectionnés." : "Le maillot sur route et CLM, porté dans les courses disputées avec leur club."}</p></div>
        </article>)}</div>
      </section>
      <section id="classement" className="scroll-mt-6"><Eyebrow>Dans le classement UCI des nations</Eyebrow><h2 className="mt-2 text-2xl font-black">Reconnaître chaque sélection d’un regard</h2>
        <div className="mt-5 overflow-hidden rounded-2xl border border-[#315B3E]/10 bg-white"><div className="grid grid-cols-[4rem_1fr_6rem] bg-[#0B302B] px-5 py-3 text-xs font-black uppercase tracking-wider text-[#9BE0BC]"><span>Rang</span><span>Nation</span><span className="text-right">Points</span></div>
          {[{ code: "MU", name: "Maurice", points: "2 450" }, { code: "FR", name: "France", points: "2 130" }, { code: "JP", name: "Japon", points: "1 980" }].map((nation, index) => <div key={nation.code} className="grid grid-cols-[4rem_1fr_6rem] items-center border-b border-[#315B3E]/10 px-5 py-3 text-sm font-black">
            <span className="text-[#278B70]">#{index + 1}</span><span className="flex items-center gap-3"><NationalFederationJersey countryCode={nation.code} countryName={nation.name} design={nation.code === "MU" ? selection : null} className="h-14 w-12 shrink-0" /><span className={`fi fi-${nation.code.toLowerCase()}`} />{nation.name}</span><span className="text-right">{nation.points}</span>
          </div>)}</div>
      </section>
      <section id="startlist" className="scroll-mt-6"><Eyebrow>Dans les inscriptions internationales</Eyebrow><h2 className="mt-2 text-2xl font-black">Une tenue commune pour la nation</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2"><article className="rounded-2xl border border-[#315B3E]/10 bg-white p-6"><div className="flex items-center gap-4"><NationalFederationJersey countryCode="MU" countryName="Maurice" design={selection} className="h-24 w-20" /><div><h3 className="text-xl font-black">Maurice</h3><p className="mt-1 text-xs font-bold text-[#60756E]">Championnat continental · sélection confirmée</p></div></div><p className="mt-4 text-sm font-semibold text-[#60756E]">Le maillot de sélection apparaît à côté du pays et accompagne les coureurs dans le direct.</p></article>
        <article className="flex items-center gap-5 rounded-2xl border border-[#D5AC18]/20 bg-[#FFFCF0] p-6"><RiderAvatar profileKey={null} seed={42} jersey={createNationalChampionRiderJersey({ countryCode: "MU", championshipType: "road", nationalDesign: champion })} className="h-28 w-28" /><div><h3 className="font-black">En club : le champion garde son titre</h3><p className="mt-2 text-sm font-semibold leading-6 text-[#60756E]">Son maillot de champion est distinct de la tenue de sélection. Il n’est pas imposé aux autres coureurs du pays.</p></div></article></div>
      </section>
      <p className="rounded-2xl bg-[#DDECE4] px-5 py-4 text-xs font-bold leading-6 text-[#416156]">Démonstration sans données de jeu : noms, points et compositions illustratifs. Les boutons de validation restent locaux. Aucune publication, migration ou modification en production.</p>
    </div>
  </main>;
}

function Eyebrow({children}: {children: React.ReactNode}) {return <p className="text-xs font-black uppercase tracking-[0.18em] text-[#278B70]">{children}</p>;}
