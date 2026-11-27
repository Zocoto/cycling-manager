import type { ZoneMixteEventOutcome } from "./post-race-interview";
import type { RiderCommunicationApproach } from "./post-race-interview-rider-scenarios";
import type { RiderPersonalityKey } from "./rider-personalities";
import { getRiderMoraleBand, type RiderMoraleBand } from "./rider-morale";

type Preference = {
  welcomes: readonly RiderCommunicationApproach[];
  resists: readonly RiderCommunicationApproach[];
};

const PREFERENCES: Record<RiderPersonalityKey, Preference> = {
  franc_tireur: { welcomes: ["autonomy", "challenge"], resists: ["protect", "collective"] },
  opportuniste: { welcomes: ["autonomy", "analyse"], resists: ["protect"] },
  calculateur: { welcomes: ["analyse", "accountability"], resists: ["challenge", "praise"] },
  solidaire: { welcomes: ["collective", "protect"], resists: ["challenge", "praise"] },
  sociable: { welcomes: ["praise", "collective"], resists: ["challenge"] },
  ambitieux: { welcomes: ["challenge", "autonomy", "praise"], resists: ["protect"] },
  colerique: { welcomes: ["listen", "accountability"], resists: ["challenge", "praise"] },
  charismatique: { welcomes: ["praise", "collective"], resists: ["protect"] },
  assidu: { welcomes: ["analyse", "challenge"], resists: ["praise"] },
  imprevisible: { welcomes: ["autonomy", "listen"], resists: ["analyse", "accountability"] },
  fonceur: { welcomes: ["challenge", "autonomy"], resists: ["protect", "analyse"] },
  cooperatif: { welcomes: ["collective", "analyse"], resists: ["autonomy"] },
  metronome: { welcomes: ["analyse", "collective"], resists: ["challenge"] },
  tenace: { welcomes: ["challenge", "analyse"], resists: ["protect"] },
  prudent: { welcomes: ["protect", "analyse"], resists: ["challenge", "praise"] },
  fidele: { welcomes: ["collective", "accountability"], resists: ["autonomy"] },
  mentor: { welcomes: ["collective", "listen"], resists: ["praise"] },
  collectif: { welcomes: ["collective", "accountability"], resists: ["praise", "autonomy"] },
  globe_trotteur: { welcomes: ["autonomy", "listen"], resists: ["protect"] },
  meticuleux: { welcomes: ["analyse", "accountability"], resists: ["challenge"] },
  perfectionniste: { welcomes: ["analyse", "challenge"], resists: ["praise", "protect"] },
  force_tranquille: { welcomes: ["listen", "protect"], resists: ["challenge"] },
  discret: { welcomes: ["listen", "protect"], resists: ["praise", "challenge"] },
  franc_parleur: { welcomes: ["accountability", "analyse"], resists: ["protect"] },
  chambreur: { welcomes: ["challenge", "praise"], resists: ["protect"] },
};

const MORALE_MODIFIERS: Partial<Record<RiderMoraleBand, Partial<Record<RiderCommunicationApproach, number>>>> = {
  dejected: { listen: 2, protect: 2, challenge: -2, praise: -1 },
  fragile: { listen: 1, protect: 1, challenge: -2, praise: -1 },
  confident: { autonomy: 1, challenge: 1 },
  euphoric: { autonomy: 1, challenge: 1, protect: -1 },
};

const REACTIONS: Record<RiderCommunicationApproach, { positive: string; negative: string }> = {
  listen: {
    positive: "{{riderName}} apprécie de pouvoir donner sa version et repart avec le sentiment d’avoir été entendu.",
    negative: "{{riderName}} trouve l’échange trop flou et attend une décision plus concrète du staff.",
  },
  protect: {
    positive: "{{riderName}} apprécie que le staff lui laisse le temps de souffler après l’arrivée.",
    negative: "{{riderName}} aurait préféré être associé à la réponse et vit mal cette mise en retrait.",
  },
  praise: {
    positive: "{{riderName}} accueille les félicitations et apprécie que son effort soit reconnu devant la presse.",
    negative: "{{riderName}} reçoit mal cette mise en avant et aurait préféré un mot en privé.",
  },
  analyse: {
    positive: "{{riderName}} apprécie de repartir avec un point de travail concret pour la suite.",
    negative: "{{riderName}} trouve le débrief prématuré et peine à se projeter dans le travail proposé.",
  },
  challenge: {
    positive: "{{riderName}} accueille le défi et se sent prêt à retrouver la course.",
    negative: "{{riderName}} vit mal la pression supplémentaire dès la sortie de cette course.",
  },
  autonomy: {
    positive: "{{riderName}} voit dans cette marge de manœuvre une marque de confiance.",
    negative: "{{riderName}} aurait préféré une consigne claire et doute du soutien du staff.",
  },
  collective: {
    positive: "{{riderName}} apprécie la place donnée au travail de l’équipe.",
    negative: "{{riderName}} a le sentiment que son effort personnel passe au second plan.",
  },
  accountability: {
    positive: "{{riderName}} apprécie que le staff prenne sa part dans le bilan de la course.",
    negative: "{{riderName}} trouve que la réponse laisse peu de place à ce qui s’est joué en course.",
  },
};

export function buildRiderCommunicationOutcome({
  approach,
  baseMorale,
  popularityDelta,
  personalityKey,
  morale,
}: {
  approach: RiderCommunicationApproach;
  baseMorale: number;
  popularityDelta?: number;
  personalityKey?: RiderPersonalityKey | null;
  morale?: number | null;
}): ZoneMixteEventOutcome {
  const preference = personalityKey ? PREFERENCES[personalityKey] : undefined;
  const personalityModifier = preference?.welcomes.includes(approach) ? 2 : preference?.resists.includes(approach) ? -2 : 0;
  const moraleModifier = morale == null ? 0 : MORALE_MODIFIERS[getRiderMoraleBand(morale)]?.[approach] ?? 0;
  const total = baseMorale + personalityModifier + moraleModifier;
  const delta = Math.min(5, Math.max(-5, total || Math.sign(personalityModifier || moraleModifier || baseMorale)));
  const reaction = REACTIONS[approach];
  const summary = delta === 0
    ? "{{riderName}} prend acte de votre réponse. Son moral reste stable."
    : delta > 0 ? reaction.positive : reaction.negative;

  return {
    weight: 100,
    riderMoraleDelta: delta,
    ...(popularityDelta ? { riderPopularityDelta: popularityDelta } : {}),
    summary,
  };
}
