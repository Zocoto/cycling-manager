import { HalloweenCandyScene, NativeAvatarPreview } from "./halloween-art";
import { HalloweenNightRide } from "./halloween-night-ride";

/** The approved illustrated hub, with real navigation and no demonstration account. */
export function HalloweenEventHome({ onSelect }: { onSelect: (tab: "poursuite" | "bonbons" | "boutique") => void }) {
  return <section className="halloween-event-hub" aria-label="Accueil de l’événement Halloween">
    <div className="halloween-event-activities">
      <article className="halloween-event-activity" data-halloween-activity="runner">
        <div className="halloween-event-card-art"><HalloweenNightRide decorative /></div>
        <div className="halloween-event-card-copy">
          <p className="halloween-eyebrow">01 · L’adresse</p><h3>Cycling Hollow</h3>
          <p>Sautez, baissez-vous et ramassez les roues démoniaques. Un parcours identique pour tous, un meilleur score conservé et les roues de chaque essai validé dans votre portefeuille.</p>
          <span className="halloween-tag">1 essai quotidien · +1 avec un ticket bonus</span>
          <button className="halloween-button" onClick={() => onSelect("poursuite")}>Jouer la poursuite <span aria-hidden="true">→</span></button>
        </div>
      </article>
      <article className="halloween-event-activity" data-halloween-activity="candy">
        <div className="halloween-event-card-art halloween-event-candy-art"><HalloweenCandyScene /></div>
        <div className="halloween-event-card-copy">
          <p className="halloween-eyebrow">02 · Le hasard</p><h3>Trick or Treat</h3>
          <p>Deux bonbons, les mêmes chances. Misez 5 roues démoniaques : une récompense ou une mauvaise pioche, sans malus sur votre équipe.</p>
          <span className="halloween-tag">Un tirage quotidien · aucun malus sur l’équipe</span>
          <button className="halloween-button" onClick={() => onSelect("bonbons")}>Choisir un bonbon <span aria-hidden="true">→</span></button>
        </div>
      </article>
      <article className="halloween-event-activity" data-halloween-activity="shop">
        <div className="halloween-event-card-art halloween-event-shop-art"><NativeAvatarPreview art="vlad" /><NativeAvatarPreview art="moon" avatarKey="director_f_03" /><NativeAvatarPreview art="cap" /></div>
        <div className="halloween-event-card-copy">
          <p className="halloween-eyebrow">03 · Les trésors</p><h3>La boutique de minuit</h3>
          <p>Lord Vlad, les potions et des reliques exceptionnelles. Transformez vos roues démoniaques en trésors d’Halloween et retrouvez vos objets dans « Mes trésors ».</p>
          <span className="halloween-tag">Portraits, consommables et transformations</span>
          <button className="halloween-button" onClick={() => onSelect("boutique")}>Explorer la boutique <span aria-hidden="true">→</span></button>
        </div>
      </article>
    </div>
    <div className="halloween-event-bottom">
      <div><p className="halloween-eyebrow">Une parenthèse hors des courses</p><h3>Des frissons, pas de fatigue.</h3>
        <p>Les jeux ne modifient ni la forme de vos coureurs, ni les classements cyclistes. Les objets ont les effets indiqués sur leur fiche, uniquement lorsque vous décidez de les utiliser.</p>
        <p>Journées renouvelées à minuit à Paris. Les podiums quotidiens suivent la sauvegarde des derniers essais ; les lots finaux suivent la clôture du 2 novembre. La boutique reste ouverte jusqu’au 9 novembre inclus. Les tickets expirent à la fin des jeux ; les roues restantes, à la fermeture de la boutique.</p>
      </div>
    </div>
  </section>;
}
