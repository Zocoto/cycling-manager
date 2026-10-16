import Link from "@/components/ui/app-link";

export function GamesColors({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`flex overflow-hidden ${className}`}>
    {["#0085C7", "#F4C300", "#20232B", "#009F6B", "#DF0024"].map(color =>
      <span key={color} className="min-h-1.5 flex-1" style={{ backgroundColor: color }} />)}
  </span>;
}

export function QuadrennialGamesBanner({ seasonName, compact = false }: { seasonName: string; compact?: boolean }) {
  const Heading = compact ? "h2" : "h1";
  return <section data-quadrennial-games className="relative mt-5 overflow-hidden rounded-[2rem] border border-[#DCC785]/60 bg-[#080E1D] text-white shadow-[0_20px_65px_rgba(8,14,29,.2)]">
    <GamesColors className="absolute inset-x-0 top-0 h-1.5" />
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_95%_10%,rgba(0,133,199,.22),transparent_50%),radial-gradient(ellipse_at_70%_100%,rgba(0,159,107,.14),transparent_45%)]" />
    <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-12 hidden h-[150%] w-80 -skew-x-[22deg] gap-3 opacity-20 lg:flex">
      {["#0085C7", "#F4C300", "#F8FAFC", "#009F6B", "#DF0024"].map(color => <span key={color} className="h-full flex-1" style={{ backgroundColor: color }} />)}
    </div>
    <div className={`relative ${compact ? "px-6 py-6 sm:px-8" : "px-6 py-10 sm:px-10 sm:py-14"}`}>
      <p className="text-[10px] font-black uppercase tracking-[.24em] text-[#ECD797]">{seasonName} · J24 · L’événement mondial</p>
      <Heading className={`mt-3 font-black tracking-tight ${compact ? "text-2xl sm:text-3xl" : "text-4xl sm:text-6xl"}`}>Jeux quadriennaux</Heading>
      <p className="mt-2 text-sm font-bold text-[#ECD797]">Quatre saisons d’attente. Deux titres pour l’histoire.</p>
      <p className="mt-4 max-w-3xl text-sm font-medium leading-6 text-[#CDD5E4]">J24 : contre-la-montre individuel de 36 km à 14 h, jusqu’à 100 nations et 120 partants. À 18 h, la course en ligne réunit jusqu’à 220 coureurs sur un parcours complet : montagne, vallons, pavés et final plat.</p>
      <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider">
        {["Sélections nationales", "Quotas par nation", "Une édition tous les 4 ans"].map(label => <span key={label} className="rounded-full border border-white/20 bg-white/5 px-3 py-2">{label}</span>)}
      </div>
      {compact ? <Link href="/jeu/nations-cup" prefetchOnIntent className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#ECD797] px-5 text-sm font-black text-[#111827]">Découvrir les Jeux et les nations →</Link> : null}
    </div>
  </section>;
}
