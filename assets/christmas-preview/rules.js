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
    { goal: 23500, name: "La hotte précieuse", grelots: 0, items: ["booster-noel", "booster-noel", "vignette-renne", "vignette-renne"] },
    { goal: 28000, name: "L’étoile du Peloton", grelots: 0, items: ["potential-notebook"] },
  ];

  function flightReward(score) {
    return Math.min(45, 8 + Math.floor(score / 110));
  }

  const throwQualities = Object.freeze({
    successful: Object.freeze({ label: "Réussi", bonus: 10, lights: 1 }),
    super: Object.freeze({ label: "Super", bonus: 30, lights: 2 }),
    perfect: Object.freeze({ label: "Parfait", bonus: 50, lights: 3 }),
  });
  const qualityKeys = Object.keys(throwQualities);

  function throwPrecisionOffset(time, size, phase = 0) {
    if (!Number.isFinite(time) || !Number.isFinite(size) || !Number.isFinite(phase)) return 0;
    const amplitude = Math.min(8, Math.max(0, size / 2 - 5) * .65);
    return Math.sin((time % 1.1) * Math.PI * 2 / 1.1 + phase % (Math.PI * 2)) * amplitude;
  }

  // Physical delivery is checked by the flight engine before grading precision.
  function classifyThrow(error, size) {
    if (!Number.isFinite(error) || error < 0 || !Number.isFinite(size) || size <= 0) return null;
    const opening = Math.max(0, size / 2 - 5);
    const perfect = Math.max(2.4, opening * .15);
    const superLimit = Math.max(4.8, opening * .5);
    if (error <= perfect + Number.EPSILON * Math.max(1, perfect)) return "perfect";
    if (error <= superLimit + Number.EPSILON * Math.max(1, superLimit)) return "super";
    return "successful";
  }

  function normalizeThrowQualities(qualities, deliveries) {
    if (!Number.isInteger(deliveries) || deliveries < 0 || deliveries > 14) return null;
    if (qualities === undefined) return { successful: deliveries, super: 0, perfect: 0 };
    if (!qualities || typeof qualities !== "object" || Array.isArray(qualities)
      || Object.keys(qualities).length !== qualityKeys.length
      || Object.keys(qualities).some(key => !qualityKeys.includes(key))
      || qualityKeys.some(key => !Number.isInteger(qualities[key]) || qualities[key] < 0 || qualities[key] > 14)
      || qualityKeys.reduce((sum, key) => sum + qualities[key], 0) !== deliveries) return null;
    return { successful: qualities.successful, super: qualities.super, perfect: qualities.perfect };
  }

  function qualityLights(qualities) {
    return qualityKeys.reduce((sum, key) => sum + qualities[key] * throwQualities[key].lights, 0);
  }

  function normalizeFlightRun(run) {
    if (!run || typeof run !== "object" || Array.isArray(run)
      || !Number.isInteger(run.score) || run.score < 0 || run.score > 7000
      || !Number.isInteger(run.deliveries) || run.deliveries < 0 || run.deliveries > 14
      || !Number.isInteger(run.reward) || run.reward < 0 || run.reward > 45
      || (run.runId != null && (typeof run.runId !== "string" || !run.runId.length || run.runId.length > 120))) return null;
    const qualities = normalizeThrowQualities(run.qualities, run.deliveries);
    if (!qualities) return null;
    const lights = qualityLights(qualities);
    if (Object.hasOwn(run, "lights") && (!Number.isInteger(run.lights) || run.lights !== lights)) return null;
    return { ...run, runId: run.runId ?? null, qualities, lights };
  }

  function normalizeFlightDay(previous) {
    if (!previous || typeof previous !== "object" || Array.isArray(previous)
      || (Object.hasOwn(previous, "history") && !Array.isArray(previous.history))) return null;
    const legacyRun = { runId: null, score: previous.score, deliveries: previous.deliveries, reward: previous.reward };
    if (Object.hasOwn(previous, "qualities")) legacyRun.qualities = previous.qualities;
    if (Object.hasOwn(previous, "lights")) legacyRun.lights = previous.lights;
    const history = (previous.history?.length ? previous.history : [legacyRun])
      .map(normalizeFlightRun);
    if (history.some(run => !run)) return null;
    const lights = history.reduce((total, run) => total + run.lights, 0);
    if (!Number.isSafeInteger(lights)
      || (Object.hasOwn(previous, "lights") && (!Number.isSafeInteger(previous.lights) || previous.lights !== lights))) return null;
    return {
      score: history.reduce((total, run) => total + run.score, 0),
      deliveries: history.reduce((total, run) => total + run.deliveries, 0),
      lights,
      reward: history.reduce((total, run) => total + run.reward, 0),
      count: history.length,
      history,
    };
  }

  // A Second tour is a separate paid run. Its full rewards add to the daily total.
  function settleFlight(previous, score, deliveries, retry = false, runId, throwCounts) {
    if (!Number.isInteger(score) || score < 0 || score > 7000
      || !Number.isInteger(deliveries) || deliveries < 0 || deliveries > 14) return null;
    if (typeof runId !== "string" || !runId.length || runId.length > 120) return null;
    const qualities = normalizeThrowQualities(throwCounts, deliveries);
    if (!qualities) return null;
    const lights = qualityLights(qualities);
    if (previous && !retry) return null;
    const day = normalizeFlightDay(previous);
    if (previous && !day) return null;
    if (day?.history.some(run => run.runId === runId)) return null;
    const reward = flightReward(score);
    const history = [...(day?.history ?? []), { runId, score, deliveries, lights, qualities, reward }];
    return {
      result: {
        score: (day?.score ?? 0) + score,
        deliveries: (day?.deliveries ?? 0) + deliveries,
        lights: (day?.lights ?? 0) + lights,
        reward: (day?.reward ?? 0) + reward,
        count: history.length,
        history,
      },
      improved: true,
      grelots: reward,
      lights,
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

  globalThis.noelRules = Object.freeze({ milestones, flightReward, throwQualities, throwPrecisionOffset, classifyThrow, normalizeThrowQualities, normalizeFlightDay, settleFlight, rarity, silverTrade });
})();
