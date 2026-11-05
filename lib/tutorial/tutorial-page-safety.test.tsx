import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import * as history from "@/lib/game/youth-scouting-history";
import { TRAINING_DOMAIN_LABELS } from "@/lib/game/training";
import { YOUTH_TRAINING_GAME_LABELS } from "@/lib/game/youth-training";
import * as youthTutorial from "@/lib/tutorial/youth-development";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

// Evaluate the actual page branches with inert UI boundaries. No auth, server
// client or action can enter this isolated renderer.
function youthPageBranches() {
  const source = read("app/jeu/centre-de-formation/page.tsx");
  const parsed = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const action = vi.fn();
  const imports: Record<string, unknown> = {
    react: React,
    "react/jsx-runtime": jsx,
    "next/navigation": { redirect: () => { throw new Error("Unexpected navigation"); } },
    "@/app/jeu/centre-de-formation/actions": {
      markYouthScoutingReportViewedAction: action,
      naturalizeYouthRiderAction: action,
    },
    "@/lib/game/rider-profile": { RIDER_RATING_AXES: [] },
    "@/lib/game/training": { TRAINING_DOMAIN_LABELS },
    "@/lib/game/youth-scouting-history": history,
    "@/lib/game/youth-training": { YOUTH_TRAINING_GAME_LABELS },
    "@/lib/tutorial/youth-development": youthTutorial,
  };
  for (const statement of parsed.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const name = (statement.moduleSpecifier as ts.StringLiteral).text;
    if (!name.startsWith("@/components/")) continue;
    const names: string[] = [];
    if (statement.importClause?.name) names.push("default");
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      names.push(...bindings.elements.filter((element) => !element.isTypeOnly).map((element) => element.name.text));
    }
    imports[name] = Object.fromEntries(names.map((component) => [component, (props: { demoMode?: boolean }) => (
      <span data-test-component={component} data-demo-mode={props.demoMode ? "true" : undefined} />
    )]));
  }
  // Runtime imports needed only by the uncalled async page are also inert.
  for (const name of ["@/lib/supabase/authenticated-user", "@/lib/supabase/server", "@/lib/tutorial/progress", "@/services/game-header-data", "@/services/development-team", "@/services/youth-development"]) {
    imports[name] = {};
  }
  const loaded = { exports: {} as Record<string, React.ComponentType<Record<string, unknown>>> };
  const compiled = ts.transpileModule(source + "\nexport { ScoutingTab, AcademyTab };", {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  runInNewContext(compiled, {
    module: loaded, exports: loaded.exports, Intl, Date, console,
    require(name: string) {
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    },
  });
  return {
    ScoutingTab: loaded.exports.ScoutingTab,
    AcademyTab: loaded.exports.AcademyTab,
    action,
  };
}

describe("tutorial page action boundaries", () => {
  it("keeps real scouting reports and their actions out of the demo", () => {
    const { ScoutingTab, action } = youthPageBranches();
    const overview = {
      missions: [{ id: "real-report", status: "completed", viewedAt: null, unread: true, countryCode: "FR", countryName: "France", scoutName: "Real Scout", durationDays: 3, candidates: [] }],
      scouts: [], countries: [], currentDayNumber: 5, currency: "EUR", balance: 50_000,
    };
    const props = { overview, defaultCountryId: "FR", showReportHistory: false };
    const demo = renderToStaticMarkup(<ScoutingTab {...props} tutorialDemo />);
    expect(demo).toContain('data-tutorial-id="youth-tutorial-signing"');
    expect(demo).not.toContain("Real Scout");
    expect(demo).not.toContain("Marquer comme consulté");
    expect(demo).not.toContain("<form");
    const normal = renderToStaticMarkup(<ScoutingTab {...props} tutorialDemo={false} />);
    expect(normal).toContain("Real Scout");
    expect(normal).toContain("Marquer comme consulté");
    expect(normal).toContain("<form");
    expect(action).not.toHaveBeenCalled();
  });

  it("shows only demo training when an existing academy is populated", () => {
    const { AcademyTab, action } = youthPageBranches();
    const overview = {
      academy: [{ id: "real-junior", firstName: "Junior", lastName: "Example", age: 17, status: "active", trainingPriority: "grimpeur", trainingModePreference: "manual", manualTraining: { gameType: "rhythm" } }],
      totalTuitionPerSeason: 1000, currency: "EUR", gameYear: 2026, youthCoach: null, canScheduleYouthPromotion: true,
    };
    const demo = renderToStaticMarkup(<AcademyTab overview={overview} tutorialDemo activeFilter="all" />);
    expect(demo).toContain('data-tutorial-id="youth-tutorial-academy"');
    expect(demo).toContain('data-test-component="YouthTrainingMiniGame" data-demo-mode="true"');
    expect(demo).not.toContain('data-test-component="YouthTrainingBulkEditor"');
    expect(demo).not.toContain('data-test-component="YouthPromotionForm"');
    expect(demo).not.toContain("<form");
    const normal = renderToStaticMarkup(<AcademyTab overview={overview} tutorialDemo={false} activeFilter="all" />);
    expect(normal).toContain('data-test-component="YouthTrainingBulkEditor"');
    expect(action).not.toHaveBeenCalled();
  });
});

describe("Critérium registration confirmation resume", () => {
  it.each([
    [undefined, "in_progress", "registration-confirmed", true, true],
    [undefined, "in_progress", "registration-confirmed", false, false],
    [undefined, "completed", "registration-confirmed", true, false],
    [undefined, "in_progress", "live-overview", true, false],
    ["confirmee", undefined, undefined, false, true],
  ])("restores the real page confirmation branch (%s, %s, %s, run=%s)", (inscription, status, step, hasRun, expected) => {
    const source = read("app/jeu/calendrier/page.tsx");
    const parsed = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let condition = "";
    function visit(node: ts.Node) {
      if (ts.isJsxAttribute(node) && node.name.getText(parsed) === "data-tutorial-id" && node.initializer?.getText(parsed) === '"criterium-registration-confirmation"') {
        let parent: ts.Node | undefined = node.parent;
        while (parent && !ts.isConditionalExpression(parent)) parent = parent.parent;
        if (parent && ts.isConditionalExpression(parent)) condition = parent.condition.getText(parsed);
      }
      ts.forEachChild(node, visit);
    }
    visit(parsed);
    expect(condition).not.toBe("");
    const visible = runInNewContext(condition, {
      resolvedSearchParams: { inscription }, readSingleSearchParam: (value: unknown) => value,
      criteriumRun: hasRun ? {} : null, criteriumProgress: { status, current_step_key: step },
      CRITERIUM_DISCOVERY_REGISTRATION_STEP_KEY: "registration-confirmed",
    });
    expect(Boolean(visible)).toBe(expected);
  });
});

describe("replay controls after changing tabs", () => {
  it("keeps a working return-to-Live target outside the Live panel", () => {
    const source = read("components/game/race-live-lab.tsx");
    const parsed = ts.createSourceFile("race-live-lab.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let branch = "";
    function visit(node: ts.Node) {
      if (branch) return;
      if (ts.isJsxAttribute(node) && node.name.getText(parsed) === "data-tutorial-id" && node.initializer?.getText(parsed) === '"race-replay-controls"') {
        let parent: ts.Node | undefined = node.parent;
        while (parent && !ts.isConditionalExpression(parent)) parent = parent.parent;
        if (parent && ts.isConditionalExpression(parent)) branch = parent.getText(parsed);
      }
      ts.forEachChild(node, visit);
    }
    visit(parsed);
    expect(branch).not.toBe("");
    const compiled = ts.transpileModule(`export const control = (${branch});`, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }, fileName: "control.tsx",
    }).outputText;
    const setTab = vi.fn();
    const loaded = { exports: {} as { control: React.ReactElement<{ children: React.ReactElement<{ onClick: () => void }> }> } };
    runInNewContext(compiled, {
      module: loaded, exports: loaded.exports, tab: "classification", mode: "replay", setTab,
      require: (name: string) => { if (name === "react/jsx-runtime") return jsx; throw new Error(name); },
    });
    expect(renderToStaticMarkup(loaded.exports.control)).toContain('data-tutorial-id="race-replay-controls"');
    loaded.exports.control.props.children.props.onClick();
    expect(setTab).toHaveBeenCalledWith("live");
  });
});
