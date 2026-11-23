(() => {
  "use strict";
  const milestones = [
    { goal: 500, name: "La première lueur", grelots: 25, items: [] },
    { goal: 1500, name: "Le village s’éveille", grelots: 40, items: [] },
    { goal: 3500, name: "Le relais des bonnets", grelots: 0, items: ["bonnet-relais"] },
    { goal: 6500, name: "Des cartes sous le sapin", grelots: 60, items: ["booster-noel"] },
    { goal: 10000, name: "La couronne du Peloton", grelots: 0, items: ["cadre-grand-sapin", "talent-revealed"] },
    { goal: 14000, name: "Les éclaireurs polaires", grelots: 0, items: ["boussole-polaire", "carnet-eclaireur", "personality-reroll"] },
    { goal: 19000, name: "L’aurore des champions", grelots: 0, items: ["tenue-aurore"] },
    { goal: 23500, name: "Le bonnet de course de Noël", grelots: 0, items: ["bonnet-course-noel", "booster-noel", "booster-noel", "vignette-renne", "vignette-renne"] },
    { goal: 28000, name: "L’étoile du Peloton", grelots: 0, items: ["potential-notebook"] },
  ];

  function flightReward(score) {
    return Math.min(45, 8 + Math.floor(score / 110));
  }

  function normalizeFlightDay(previous) {
    if (!previous) return null;
    const history = Array.isArray(previous.history) && previous.history.length
      ? previous.history.map(run => ({ ...run }))
      : [{ runId: null, score: previous.score, deliveries: previous.deliveries, reward: previous.reward }];
    if (history.some(run => !Number.isInteger(run.score) || run.score < 0 || run.score > 7000
      || !Number.isInteger(run.deliveries) || run.deliveries < 0 || run.deliveries > 14
      || !Number.isInteger(run.reward) || run.reward < 0 || run.reward > 45)) return null;
    return {
      score: history.reduce((total, run) => total + run.score, 0),
      deliveries: history.reduce((total, run) => total + run.deliveries, 0),
      reward: history.reduce((total, run) => total + run.reward, 0),
      count: history.length,
      history,
    };
  }

  // A Second tour is a separate paid run. Its full rewards add to the daily total.
  function settleFlight(previous, score, deliveries, retry = false, runId) {
    if (!Number.isInteger(score) || score < 0 || score > 7000
      || !Number.isInteger(deliveries) || deliveries < 0 || deliveries > 14) return null;
    if (typeof runId !== "string" || !runId.length || runId.length > 120) return null;
    if (previous && !retry) return null;
    const day = normalizeFlightDay(previous);
    if (previous && !day) return null;
    if (day?.history.some(run => run.runId === runId)) return null;
    const reward = flightReward(score);
    const history = [...(day?.history ?? []), { runId, score, deliveries, reward }];
    return {
      result: {
        score: (day?.score ?? 0) + score,
        deliveries: (day?.deliveries ?? 0) + deliveries,
        reward: (day?.reward ?? 0) + reward,
        count: history.length,
        history,
      },
      improved: true,
      grelots: reward,
      lights: deliveries,
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

  globalThis.noelRules = Object.freeze({ milestones, flightReward, normalizeFlightDay, settleFlight, rarity, silverTrade });
})();
