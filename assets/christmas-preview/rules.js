(() => {
  "use strict";
  const milestones = [
    { goal: 500, name: "La première lueur", grelots: 25, items: [] },
    { goal: 1500, name: "Le village s’éveille", grelots: 40, items: [] },
    { goal: 3500, name: "Le relais des bonnets", grelots: 0, items: ["bonnet-relais"] },
    { goal: 6500, name: "Des cartes sous le sapin", grelots: 60, items: ["booster-noel"] },
    { goal: 10000, name: "La couronne du Peloton", grelots: 0, items: ["cadre-grand-sapin"] },
    { goal: 14000, name: "Les éclaireurs polaires", grelots: 0, items: ["boussole-polaire", "carnet-eclaireur"] },
    { goal: 19000, name: "L’aurore des champions", grelots: 0, items: ["tenue-aurore"] },
    { goal: 23500, name: "La hotte précieuse", grelots: 0, items: ["booster-noel", "booster-noel", "vignette-renne", "vignette-renne"] },
    { goal: 28000, name: "L’étoile du Peloton", grelots: 0, items: ["potential-notebook"] },
  ];

  function flightReward(score) {
    return Math.min(45, 8 + Math.floor(score / 110));
  }

  // One paid run a day. An explicitly consumed retry only pays the improvement.
  function settleFlight(previous, score, deliveries, retry = false) {
    if (!Number.isInteger(score) || score < 0 || score > 7000
      || !Number.isInteger(deliveries) || deliveries < 0 || deliveries > 14) return null;
    if (previous && !retry) return null;
    const improved = !previous || score > previous.score
      || (score === previous.score && deliveries > previous.deliveries);
    const result = improved ? {
      score, deliveries: Math.max(deliveries, previous?.deliveries ?? 0),
      reward: Math.max(flightReward(score), previous?.reward ?? 0),
    } : { ...previous };
    return {
      result, improved,
      grelots: result.reward - (previous?.reward ?? 0),
      lights: result.deliveries - (previous?.deliveries ?? 0),
    };
  }

  function rarity(roll, precious = false) {
    if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new Error("Tirage invalide");
    if (precious) return roll < .1 ? "holographic" : roll < .3 ? "gold" : "silver";
    return roll < .8 ? "bronze" : roll < .969 ? "silver" : roll < .999 ? "gold" : "holographic";
  }

  function silverTrade(stickers, cards, roll) {
    if (!Number.isFinite(roll) || roll < 0 || roll >= 1) return null;
    const silver = cards.filter(card => card.rarity === "silver");
    const missing = silver.filter(card => !(stickers[card.number] > 0));
    const payment = [];
    for (const card of silver) {
      const surplus = Math.max(0, (stickers[card.number] ?? 0) - 1);
      const take = Math.min(3 - payment.length, surplus);
      for (let i = 0; i < take; i++) payment.push(card.number);
      if (payment.length === 3) break;
    }
    if (!missing.length || payment.length < 3) return null;
    return { payment, card: missing[Math.floor(roll * missing.length)] };
  }

  globalThis.noelRules = Object.freeze({ milestones, flightReward, settleFlight, rarity, silverTrade });
})();
