import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "components/game/youth-training-mini-game.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("youth training minigame surfaces", () => {
  it("rend une surface distincte pour chacun des six profils", () => {
    for (const gameType of [
      "rhythm",
      "reflex",
      "speed",
      "time_trial",
      "breakaway",
      "puncheur",
    ]) {
      expect(source).toContain(`data-youth-game="${gameType}"`);
    }
  });

  it("laisse le DS déclencher lui-même le chrono pour tous les jeux", () => {
    expect(source).toContain("data-youth-game-start");
    expect(source).toContain("Le chrono ne démarrera qu’après votre action");
    expect(source).toContain('"Commencer"');
    expect(source).not.toContain("PuncheurInstructions");
    expect(source).not.toContain("data-youth-game-instructions");
  });

  it("resserre la cible du Puncheur et accélère progressivement sa jauge", () => {
    expect(source).toContain("YOUTH_PUNCHEUR_TARGET_MIN");
    expect(source).toContain("PUNCHEUR_BASE_CHARGE_MILLISECONDS = 4_000");
    expect(source).toContain("getYouthPuncheurChargeRateMultiplier");
    expect(source).toContain("YOUTH_PUNCHEUR_HITS_FOR_MAX_SCORE");
    expect(source).toContain("puncheurHitsRef.current");
    expect(source).toContain("select-none");
  });

  it("ne compte pas comme échec un HIT Puncheur maintenu à l’expiration", () => {
    expect(source).toContain("getYouthPuncheurScoredOpportunities");
    expect(source).toContain("puncheurAttemptActive");
    expect(source).toContain("puncheurAttemptActiveRef.current = false");
    expect(source).toContain(
      "puncheurOpportunities: scoredPuncheurOpportunities",
    );
  });

  it("prévoit des interactions tactiles pour les trois nouveaux jeux", () => {
    expect(source).toContain("onTimeTrialControlStart");
    expect(source).toContain("onBreakawayAttack");
    expect(source).toContain("onPuncheurChargeStart");
    expect(source).toContain("touch-none");
  });

  it("démarre le Grimpeur au bord et varie Pavés et Baroudeur", () => {
    expect(source).toContain("getYouthRhythmCursorPosition(0)");
    expect(source).toContain("scheduleTarget(YOUTH_REFLEX_INITIAL_DELAY_MS)");
    expect(source).toContain(
      "scheduleTarget(getYouthReflexTargetInterval(Math.random()))",
    );
    expect(source).toContain("BREAKAWAY_CYCLE_MILLISECONDS = 3_000");
    expect(source).toContain(
      "breakawayWindowStart={breakawayWindowStart}",
    );
  });

  it("accentue l’instabilité du CLM", () => {
    expect(source).toContain("getYouthTimeTrialWindDrift(elapsed)");
  });

  it("allège le chemin tactile du Sprint pour limiter les freezes", () => {
    expect(source).toContain("event.preventDefault();");
    expect(source).toContain("touch-none select-none");
    expect(source).toContain("transition-colors duration-75");
    expect(source).not.toContain("active:scale-95");
  });
});
