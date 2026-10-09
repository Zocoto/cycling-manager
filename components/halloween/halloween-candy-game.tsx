import { HalloweenCandyScene } from "./halloween-art";

export type CandyColor = "orange" | "violet";

export function HalloweenCandyGame({ disabled, busy, drawn, pendingGift, coins, chosen, result, onChoose }: {
  disabled: boolean; busy: boolean; drawn: boolean; pendingGift: boolean; coins: number;
  chosen: CandyColor | null; result: string | null; onChoose: (color: CandyColor) => void;
}) {
  const reason = busy ? "Votre bonbon s’ouvre…" : drawn || result ? "Votre bonbon du jour a été choisi. Revenez demain !" :
    pendingGift ? "Déballez d’abord le cadeau de la momie." : coins < 5 ? "Il vous faut 5 roues démoniaques pour choisir un bonbon." :
    disabled ? "Le jeu est momentanément fermé." : "Cliquez sur le bonbon orange ou violet dans les mains du petit cycliste.";
  return <section className="halloween-card halloween-candy-game">
    <p className="halloween-eyebrow">Une fois par jour · mise de 5 roues</p>
    <h2>Trick or Treat</h2>
    <p>Deux bonbons : une récompense… ou une mauvaise pioche ?</p>
    <HalloweenCandyScene>
      {(["orange", "violet"] as const).map(color => <button
        type="button" key={color} className="halloween-candy-hotspot" data-candy-color={color}
        data-chosen={chosen === color ? "true" : undefined}
        aria-label={`Choisir le bonbon ${color} · miser 5 roues démoniaques`}
        title={`Choisir le bonbon ${color}`} disabled={disabled || !!result}
        onClick={() => onChoose(color)}
      ><span className="halloween-candy-label">{color === "orange" ? "Orange" : "Violet"}</span></button>)}
    </HalloweenCandyScene>
    <p className="halloween-candy-instruction" aria-live="polite">{reason}</p>
    {result ? <p className="halloween-candy-draw-result" role="status">{result}</p> : null}
    <div className="halloween-candy-rule"><strong>50 % de récompense · 50 % de mauvaise pioche.</strong><p>Les deux couleurs ont les mêmes chances. Vous risquez uniquement les 5 roues misées : aucun malus sur votre équipe.</p></div>
    <details className="halloween-candy-probabilities"><summary>Récompenses et probabilités</summary>
      <p>50 % sans cadeau ; 30 % pour 8 roues ; 12 % pour 15 roues ; 5 % pour un consommable ; 1 % pour un cosmétique ; 1,9 % pour un ticket bonus ; 0,1 % pour l’Étoile de la sorcière.</p>
      <p className="halloween-secondary">Les gains de roues sont indiqués avant déduction de la mise. Chaque objet d’une même famille a la même chance. Un cosmétique déjà possédé est remplacé par la moitié de son prix, avec un minimum de 5 roues. Après votre première Étoile de la sorcière, ce tirage rare donne 15 roues. Les autres reliques et les récompenses exclusives du vainqueur ne figurent pas dans les tirages.</p>
    </details>
  </section>;
}
