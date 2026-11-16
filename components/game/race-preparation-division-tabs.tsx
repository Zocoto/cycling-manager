import { GameSectionTabLink, GameSectionTabs } from "./game-section-tabs";

export function RacePreparationDivisionTabs({ division }: { division: "pro" | "junior" }) {
  return (
    <GameSectionTabs ariaLabel="Préparation de course" columns={2} className="mt-5">
      <GameSectionTabLink href="/jeu/preparation-course" active={division === "pro"} label="Professionnels" />
      <GameSectionTabLink href="/jeu/preparation-course/juniors" active={division === "junior"} label="Juniors" />
    </GameSectionTabs>
  );
}
