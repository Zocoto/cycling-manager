import {
  getRiderWeightThreshold,
  getRiderMinimumPowerWeight,
  RIDER_OVERWEIGHT_BONUS_FADE_BMI,
  RIDER_OVERWEIGHT_RULES,
  type RiderPhysiologyProfile,
} from "@/lib/game/rider-physiology";

const profiles: RiderPhysiologyProfile[] = [
  "climber", "stage_racer", "breakaway", "puncheur", "rouleur", "northern_classics", "sprinter",
];
const heights = [170, 175, 180, 185];
const examples = [
  { profile: "northern_classics", terrain: "cobbles" },
  { profile: "sprinter", terrain: "flat" },
  { profile: "rouleur", terrain: "time_trial" },
] as const;
const number = (value: number, decimals = 1) => value.toLocaleString("fr-FR", {
  minimumFractionDigits: decimals, maximumFractionDigits: decimals,
});
const cell = "px-3 py-3";
const table = "w-full min-w-[620px] text-left text-sm";
const head = "bg-[#0B302B] text-xs text-white";
const body = "divide-y divide-[#315B3E]/10 bg-white font-semibold text-[#48665F]";
const wrapper = "mt-5 overflow-x-auto rounded-xl border border-[#315B3E]/10";

export function RiderWeightGuideTables() {
  return (
    <article id="poids-surpoids" className="mt-7 scroll-mt-24 rounded-[1.75rem] border border-[#315B3E]/15 bg-white p-6 shadow-[0_16px_42px_rgba(19,60,46,0.08)] sm:p-8">
      <h3 className="text-2xl font-black text-[#082A2A]">Poids et surpoids : seuils et barème</h3>
      <p className="mt-4 text-sm font-medium leading-7 text-[#60756E]">
        Le seuil dépend du profil naturel et de la taille du coureur, pas de son
        rôle en course ni de son équipement. Ce sont des seuils sportifs propres
        au jeu, pas des classifications médicales. L’IMC correspond au poids
        divisé par la taille en mètres au carré.
      </p>
      <div className={wrapper}>
        <table className={table}>
          <caption className="bg-[#F3F8F6] px-4 py-3 text-left font-black text-[#176951]">Début de l’alerte de surpoids</caption>
          <thead className={head}>
            <tr>
              <th scope="col" className={cell}>Profil naturel</th>
              <th scope="col" className={cell}>IMC limite ≈</th>
              {heights.map((height) => <th key={height} scope="col" className={cell}>{number(height / 100, 2)} m</th>)}
            </tr>
          </thead>
          <tbody className={body}>
            {profiles.map((profile) => {
              const limit = getRiderWeightThreshold(profile, 180);
              return <tr key={profile}>
                <th scope="row" className={cell}>{limit.profileLabel}</th>
                <td className={cell}>{number(limit.maximumBodyMassIndex, 2)}</td>
                {heights.map((height) => <td key={height} className={cell}>
                  {number(getRiderWeightThreshold(profile, height).maximumWeightKg + 0.1)} kg
                </td>)}
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 text-[#60756E]">
        Les poids indiquent le premier dixième déclenchant l’alerte. Les IMC
        affichés sont arrondis ; le calcul utilise les seuils exacts.
      </p>
      <p className="mt-5 text-sm font-medium leading-7 text-[#60756E]">
        Sur pavés, plat/sprint et CLM, le bonus acquis au seuil diminue ensuite
        progressivement. À un point d’IMC au-dessus du seuil, il en reste la
        moitié ; à deux points, il disparaît. Au-delà, un malus progresse jusqu’à
        la limite propre au terrain. Un malus déjà présent n’est jamais effacé.
      </p>
      <div className={wrapper}>
        <table className={table}>
          <caption className="bg-[#F3F8F6] px-4 py-3 text-left font-black text-[#176951]">Barème sur pavés, plat/sprint et CLM</caption>
          <thead className={head}><tr>
            <th scope="col" className={cell}>Terrain</th>
            <th scope="col" className={cell}>Diminution du bonus</th>
            <th scope="col" className={cell}>Bonus disparu</th>
            <th scope="col" className={cell}>Malus par point d’IMC suivant</th>
            <th scope="col" className={cell}>Malus maximal</th>
          </tr></thead>
          <tbody className={body}>
            {Object.entries(RIDER_OVERWEIGHT_RULES).map(([key, rule]) => <tr key={key}>
              <th scope="row" className={cell}>{rule.label}</th>
              <td className={cell}>Dès le seuil du profil</td>
              <td className={cell}>Seuil + {RIDER_OVERWEIGHT_BONUS_FADE_BMI} d’IMC</td>
              <td className={cell}>−{number(rule.penaltyPerBmi)} point</td>
              <td className={cell}>−{rule.maximumPenalty} points</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <div className={wrapper}>
        <table className={table}>
          <caption className="bg-[#F3F8F6] px-4 py-3 text-left font-black text-[#176951]">Exemples à 1,80 m sur le terrain favori</caption>
          <thead className={head}><tr>
            <th scope="col" className={cell}>Profil / terrain</th>
            <th scope="col" className={cell}>Bonus réduit dès</th>
            <th scope="col" className={cell}>Bonus disparu dès</th>
            <th scope="col" className={cell}>Malus à IMC 30 · 97,2 kg</th>
          </tr></thead>
          <tbody className={body}>
            {examples.map(({ profile, terrain }) => {
              const limit = getRiderWeightThreshold(profile, 180);
              const rule = RIDER_OVERWEIGHT_RULES[terrain];
              const zeroBonusBmi = limit.maximumBodyMassIndex + RIDER_OVERWEIGHT_BONUS_FADE_BMI;
              const zeroBonusWeight = Math.ceil(zeroBonusBmi * 1.8 ** 2 * 10 - 1e-9) / 10;
              const penalty = Math.min(rule.maximumPenalty, Math.max(0, 30 - zeroBonusBmi) * rule.penaltyPerBmi);
              return <tr key={profile}>
                <th scope="row" className={cell}>{limit.profileLabel} · {rule.label}</th>
                <td className={cell}>{number(limit.maximumWeightKg + 0.1)} kg</td>
                <td className={cell}>{number(zeroBonusWeight)} kg</td>
                <td className={cell}>−{number(penalty)} points</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 rounded-xl bg-[#FFF9DF] px-4 py-3 text-sm font-bold leading-6 text-[#705B00]">
        Ces valeurs modulent la performance en course : ce ne sont ni des
        pourcentages ni des pertes permanentes de notes. Montagne et vallons
        conservent leurs pénalités de poids. Les résultats passés ne changent pas.
      </p>
      <p className="mt-3 text-xs font-semibold leading-5 text-[#60756E]">
        Ces exemples supposent qu’aucun malus de gabarit n’est déjà présent.
      </p>
      <p className="mt-4 text-sm font-medium leading-6 text-[#60756E]">
        L’assistant du DS vous avertit du surpoids et distingue bonus réduit et
        malus. La fiche du coureur et la rubrique nutrition affichent son seuil.
        Revenir sous le seuil retire l’alerte de surpoids.
      </p>
      <h4 className="mt-7 text-lg font-black text-[#082A2A]">Sous-poids des profils de puissance</h4>
      <p className="mt-3 text-sm font-medium leading-7 text-[#60756E]">
        Un rouleur, pavéman ou sprinteur trop léger manque de puissance sur
        pavés, plat/sprint et CLM. Sous le seuil ci-dessous, le bonus éventuel
        diminue sur un point d’IMC et un malus progresse immédiatement, avec
        les mêmes pentes et plafonds que dans le barème précédent. Les autres
        profils ne reçoivent pas ce malus de sous-poids.
      </p>
      <div className={wrapper}>
        <table className={table}>
          <caption className="bg-[#F3F8F6] px-4 py-3 text-left font-black text-[#176951]">Poids minimal sans alerte de sous-poids</caption>
          <thead className={head}><tr>
            <th scope="col" className={cell}>Profil naturel</th><th scope="col" className={cell}>IMC minimal ≈</th>
            {heights.map(height => <th key={height} scope="col" className={cell}>{number(height / 100, 2)} m</th>)}
          </tr></thead>
          <tbody className={body}>
            {examples.map(({profile}) => <tr key={profile}>
              <th scope="row" className={cell}>{getRiderWeightThreshold(profile, 180).profileLabel}</th>
              <td className={cell}>{number(getRiderMinimumPowerWeight(profile, 180)!.minimumBodyMassIndex, 2)}</td>
              {heights.map(height => <td key={height} className={cell}>{number(getRiderMinimumPowerWeight(profile, height)!.minimumWeightKg)} kg</td>)}
            </tr>)}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm font-medium leading-7 text-[#60756E]">
        Dans la rubrique nutrition, « Ajuster le poids » est optionnel :
        affûtage pour alléger, athlétisation pour renforcer. Chaque programme
        ajuste de 0,2 à 1 kg et coûte 4 points de forme par 0,2 kg, sans frais
        supplémentaires. Les deux sens partagent un délai de cinq jours par
        coureur. Compléments et programmes se valident ensemble dans la barre
        flottante ; la forme gagnée par le complément est prise en compte.
      </p>
      <p className="mt-3 text-xs font-semibold leading-6 text-[#60756E]">
        Aucun nouveau spécialiste de puissance ne commence en sous-poids.
        Les morphologies restent variées : environ 5 % des futurs coureurs
        peuvent naître avec un léger surpoids, de +0,15 à +0,75 d’IMC au-dessus
        du seuil de leur profil. Les variations liées aux compléments et aux
        programmes restent sous votre responsabilité.
      </p>
    </article>
  );
}
