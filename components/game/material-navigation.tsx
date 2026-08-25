import Link from "@/components/ui/app-link";

const MATERIAL_ROUTES = [
  ["/jeu/materiel", "Matériel commercial"],
  ["/jeu/materiel/equipementier", "Équipementier"],
  ["/jeu/materiel/laboratoire", "Labo R&D"],
  ["/jeu/materiel/equiper", "Équiper l’équipe"],
] as const;

type MaterialRoute = (typeof MATERIAL_ROUTES)[number][0];

export function MaterialNavigation({
  activeHref,
}: {
  activeHref: MaterialRoute;
}) {
  return (
    <nav
      aria-label="Rubriques du matériel"
      className="mt-5 flex flex-wrap gap-2 rounded-2xl border border-[#315B3E]/12 bg-white p-2 shadow-sm"
    >
      {MATERIAL_ROUTES.map(([href, label]) => {
        const isActive = href === activeHref;

        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-xl px-5 py-3 text-xs font-black uppercase tracking-wider transition ${
              isActive
                ? "bg-[#0B302B] text-white"
                : "text-[#60756E] hover:bg-[#EAF5F3] hover:text-[#176951]"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
