import {
  GameSectionTabLink,
  GameSectionTabs,
} from "@/components/game/game-section-tabs";

const MATERIAL_ROUTES = [
  ["/jeu/materiel", "Matériel commercial", "Catalogue et achats"],
  [
    "/jeu/materiel/equipementier",
    "Équipementier",
    "Contrat et gamme partenaire",
  ],
  ["/jeu/materiel/laboratoire", "Labo R&D", "Recherche et développement"],
  ["/jeu/materiel/equiper", "Équiper l’équipe", "Attributions aux coureurs"],
] as const;

type MaterialRoute = (typeof MATERIAL_ROUTES)[number][0];

export function MaterialNavigation({
  activeHref,
}: {
  activeHref: MaterialRoute;
}) {
  return (
    <GameSectionTabs
      ariaLabel="Rubriques du matériel"
      columns={4}
      className="mt-5"
    >
      {MATERIAL_ROUTES.map(([href, label, description]) => {
        const isActive = href === activeHref;

        return (
          <GameSectionTabLink
            key={href}
            href={href}
            active={isActive}
            label={label}
            description={description}
          />
        );
      })}
    </GameSectionTabs>
  );
}
