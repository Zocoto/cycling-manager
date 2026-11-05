import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import * as jsx from "react/jsx-runtime";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getTutorialDefinition, listTutorialDefinitions } from "@/lib/tutorial/catalog";
import * as routes from "@/lib/tutorial/routes";
import * as centerRoute from "@/lib/tutorial/tutorial-center-route";
import * as clientRequest from "@/lib/tutorial/client-request";
import { getTutorialCenterEntryPresentation } from "@/lib/tutorial/tutorial-center";
import type { TutorialProgressRow } from "@/types/tutorial";

type Element = { type?: unknown; props?: Record<string, unknown> };
type Component = (props: Record<string, unknown>) => Element;

// Run the real component callbacks without mounting a DOM or importing a live
// action. The import allowlist makes accidental Supabase/network use impossible.
function evaluate(path: string, imports: Record<string, unknown>) {
  const loadedModule = { exports: {} as Record<string, unknown> };
  const source = readFileSync(resolve(process.cwd(), path), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  runInNewContext(compiled, {
    module: loadedModule, exports: loadedModule.exports, URLSearchParams, console,
    require(name: string) {
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    },
  });
  return loadedModule.exports;
}

function hooks() {
  const slots: unknown[] = [];
  let cursor = 0;
  return {
    render(component: () => Element) { cursor = 0; return component(); },
    api: {
      useState<T>(initial: T | (() => T)) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = typeof initial === "function" ? (initial as () => T)() : initial;
        return [slots[index] as T, (value: T | ((previous: T) => T)) => {
          slots[index] = typeof value === "function" ? (value as (previous: T) => T)(slots[index] as T) : value;
        }];
      },
      useRef<T>(initial: T) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = { current: initial };
        return slots[index];
      },
      useMemo: <T,>(fn: () => T) => fn(),
      useCallback: <T,>(fn: T) => fn,
      useEffect: () => undefined,
      useId: () => ":tutorial-test:",
      createContext: () => ({ Provider: "provider" }),
      Suspense: "suspense",
    },
  };
}

function find(node: unknown, predicate: (element: Element) => boolean): Element | null {
  if (!node || typeof node !== "object") return null;
  const element = node as Element;
  if (predicate(element)) return element;
  for (const child of [element.props?.children].flat(Infinity)) {
    const match = find(child, predicate);
    if (match) return match;
  }
  return null;
}

async function flush() { for (let index = 0; index < 20; index += 1) await Promise.resolve(); }

function fixture(initialRoute = "/jeu?centre-didacticiels=1") {
  const providerHooks = hooks();
  const launcherHooks = hooks();
  const menuHooks = hooks();
  let route = initialRoute;
  let context: Record<string, unknown> = {};
  const navigation: Array<[string, string]> = [];
  const router = {
    push: vi.fn((destination: string) => { navigation.push(["push", destination]); route = destination; }),
    replace: vi.fn((destination: string) => { navigation.push(["replace", destination]); route = destination; }),
    refresh: vi.fn(),
  };
  const startAction = vi.fn(async ({ tutorialKey }: { tutorialKey: string }) => {
    const definition = getTutorialDefinition(tutorialKey)!;
    return {
      ok: true, session: { id: `session-${tutorialKey}` },
      progress: { tutorial_key: tutorialKey, status: "in_progress" },
      currentStepKey: definition.steps[0].key, resolvedRoute: definition.steps[0].route,
    };
  });
  const stepAction = vi.fn();
  const quitAction = vi.fn().mockResolvedValue({ ok: false, error: "Pause unavailable" });
  const common = {
    "react/jsx-runtime": jsx,
    "next/navigation": {
      usePathname: () => route.split("?")[0], useRouter: () => router,
      useSearchParams: () => new URLSearchParams(route.split("?")[1]),
    },
    "next/dynamic": { default: () => "deferred" },
    "@/components/i18n/locale-provider": { useLocale: () => ({ locale: "fr" }) },
  };
  const runtime = { getTutorialDefinition, listAutoStartTutorialDefinitions: () => [], localizeTutorialDefinition: (definition: unknown) => definition };
  const provider = evaluate("components/tutorial/tutorial-provider.tsx", {
    ...common, react: providerHooks.api,
    "@/app/jeu/tutorial-actions": { startTutorialAction: startAction, setTutorialStepAction: stepAction, quitTutorialAction: quitAction },
    "@/lib/tutorial/client-runtime": runtime,
    "@/lib/tutorial/instant-start": { selectInstantAutoStartTutorialKey: () => null },
    "@/lib/tutorial/client-request": clientRequest,
    "@/lib/tutorial/routes": routes,
  }).TutorialProvider as Component;
  const tutorial = { useTutorial: () => context };
  const launcher = evaluate("components/tutorial/tutorial-center-launcher.tsx", {
    ...common, react: launcherHooks.api,
    "@/components/tutorial/tutorial-provider": tutorial,
    "@/lib/tutorial/tutorial-center-route": centerRoute,
  }).TutorialCenterLauncher as Component;
  const menuImports: Record<string, unknown> = {
    ...common, react: menuHooks.api,
    "@/components/ui/app-link": { default: "a" },
    "@/components/tutorial/tutorial-provider": tutorial,
    "@/lib/i18n/tutorials-en": { localizeTutorialDefinition: (definition: unknown) => definition },
    "@/lib/tutorial/catalog": runtime,
    "@/lib/tutorial/tutorial-center": { getTutorialCenterEntryPresentation },
    "@/lib/tutorial/contextual-route": { getContextualTutorialKey: () => null },
    "@/lib/tutorial/criterium-discovery": { CRITERIUM_DISCOVERY_KEY: "criterium-discovery", CRITERIUM_DISCOVERY_RESULTS_ROUTE: "/jeu/resultats/criterium-de-la-decouverte/1" },
  };
  for (const [name, constant, key] of [
    ["onboarding", "ONBOARDING_TUTORIAL_KEY", "onboarding-core"],
    ["equipment", "EQUIPMENT_TUTORIAL_KEY", "equipment"],
    ["infrastructure", "INFRASTRUCTURE_TUTORIAL_KEY", "infrastructure"],
    ["medical-center", "MEDICAL_CENTER_TUTORIAL_KEY", "medical-center"],
    ["roster", "ROSTER_TUTORIAL_KEY", "roster-management"],
    ["training", "TRAINING_TUTORIAL_KEY", "training"],
    ["staff", "STAFF_TUTORIAL_KEY", "staff"],
    ["transfers", "TRANSFER_TUTORIAL_KEY", "transfers"],
    ["youth-development", "YOUTH_DEVELOPMENT_TUTORIAL_KEY", "youth-development"],
    ["sponsoring", "SPONSORING_TUTORIAL_KEY", "sponsoring"],
  ]) menuImports[`@/lib/tutorial/${name}`] = { [constant]: key };
  const menu = evaluate("components/tutorial/tutorial-center-menu.tsx", menuImports).TutorialCenterMenu as Component;
  function renderProvider(initialProgress: TutorialProgressRow[] = []) {
    const tree = providerHooks.render(() => provider({ children: null, initialProgress }));
    context = tree.props!.value as Record<string, unknown>;
    return tree;
  }
  function renderLauncher() { return launcherHooks.render(() => launcher({})); }
  function renderMenu() {
    const launcherTree = renderLauncher();
    return menuHooks.render(() => menu({ initiallyOpen: true, ...launcherTree.props }));
  }
  renderProvider();
  return {
    startAction, stepAction, quitAction, navigation, renderProvider, renderLauncher, renderMenu,
    setRoute: (destination: string) => { route = destination; },
    context: () => context as {
      startTutorial: (options: { tutorialKey: string; launchSource: string; restartFromBeginning: boolean }) => Promise<boolean>;
      resumeActiveTutorial: () => boolean;
      quitTutorial: () => Promise<void>; nextStep: () => Promise<void>; previousStep: () => Promise<void>;
      isPending: boolean; activeTutorial: unknown; errorMessage: string | null;
    },
  };
}

afterEach(() => vi.useRealTimers());

describe("tutorial client launch and recovery", () => {
  it.each(listTutorialDefinitions().map((definition) => definition.key))("keeps %s destination when closing the deep-linked centre", async (key) => {
    const h = fixture();
    const definition = getTutorialDefinition(key)!;
    const entry = find(h.renderMenu(), (element) => element.props?.title === definition.title && typeof element.props.onAction === "function")!;
    (entry.props!.onAction as () => void)();
    await flush();
    expect(h.navigation).toEqual([["push", definition.steps[0].route]]);
    h.renderProvider();
    expect(h.context().activeTutorial).not.toBeNull();
  });

  it("cleans the deep-link parameter when the player dismisses the centre", () => {
    const h = fixture("/jeu?centre-didacticiels=1&onglet=club");
    (h.renderLauncher().props!.onClose as () => void)();
    expect(h.navigation).toEqual([["replace", "/jeu?onglet=club"]]);
  });

  it("shows a refused start in the menu and on the page", async () => {
    const h = fixture();
    h.startAction.mockResolvedValueOnce({ ok: false, error: "Le serveur est indisponible." } as never);
    await h.context().startTutorial({ tutorialKey: "youth-development", launchSource: "manual", restartFromBeginning: true });
    const tree = h.renderProvider();
    expect(find(tree, (element) => element.props?.role === "alert")?.props?.children).toBe("Le serveur est indisponible.");
    expect(find(h.renderMenu(), (element) => element.props?.role === "alert")?.props?.children).toBe("Le serveur est indisponible.");
  });

  it("guards immediate duplicate launches before React renders pending", async () => {
    const h = fixture();
    const options = { tutorialKey: "youth-development", launchSource: "manual", restartFromBeginning: true };
    const first = h.context().startTutorial(options);
    expect(await h.context().startTutorial(options)).toBe(false);
    expect(await first).toBe(true);
    expect(h.startAction).toHaveBeenCalledTimes(1);
  });

  it("releases pending after a timeout and ignores a late successful response", async () => {
    vi.useFakeTimers();
    const h = fixture();
    let finish!: (result: Awaited<ReturnType<typeof h.startAction>>) => void;
    h.startAction.mockImplementationOnce(() => new Promise((resolveResult) => { finish = resolveResult; }));
    const started = h.context().startTutorial({ tutorialKey: "youth-development", launchSource: "resume", restartFromBeginning: false });
    await flush();
    await vi.advanceTimersByTimeAsync(clientRequest.TUTORIAL_CLIENT_REQUEST_TIMEOUT_MS);
    expect(await started).toBe(false);
    h.renderProvider();
    expect(h.context().isPending).toBe(false);
    expect(h.context().errorMessage).toContain("peut-être été enregistrée");
    finish({ ok: true, session: { id: "late" }, progress: { tutorial_key: "youth-development", status: "in_progress" }, currentStepKey: "youth-overview", resolvedRoute: "/jeu/centre-de-formation" });
    await flush();
    h.renderProvider();
    expect(h.context().activeTutorial).toBeNull();
    expect(h.navigation).toEqual([]);
  });

  it("lets a player reopen an active guide after leaving its route", async () => {
    const h = fixture();
    await h.context().startTutorial({ tutorialKey: "youth-development", launchSource: "manual", restartFromBeginning: true });
    h.setRoute("/jeu/effectif");
    const tree = h.renderProvider();
    expect(find(tree, (element) => element.props?.["aria-label"] === "État du didacticiel")).not.toBeNull();
    expect(h.renderLauncher().props?.disabled).toBe(false);
    expect(h.context().resumeActiveTutorial()).toBe(true);
    expect(h.navigation.at(-1)).toEqual(["push", getTutorialDefinition("youth-development")!.steps[0].route]);
    expect(h.startAction).toHaveBeenCalledTimes(1);
  });

  it("pauses locally immediately even if the server cannot acknowledge the pause", async () => {
    const h = fixture();
    await h.context().startTutorial({ tutorialKey: "youth-development", launchSource: "manual", restartFromBeginning: true });
    h.renderProvider();
    const paused = h.context().quitTutorial();
    h.renderProvider();
    expect(h.context().activeTutorial).toBeNull();
    await paused;
    h.renderProvider();
    expect(h.context().activeTutorial).toBeNull();
    expect(h.context().errorMessage).toBe("Pause unavailable");
    expect(h.context().isPending).toBe(false);
  });

  it("keeps the youth demo and tab query parameters when moving forwards and backwards", async () => {
    const h = fixture();
    const definition = getTutorialDefinition("youth-development")!;
    h.stepAction.mockImplementation(async ({ stepKey }: { stepKey: string }) => {
      const step = definition.steps.find((candidate) => candidate.key === stepKey)!;
      return { ok: true, session: { id: "session-youth-development" }, progress: { tutorial_key: definition.key, status: "in_progress" }, currentStepKey: stepKey, resolvedRoute: step.route };
    });
    await h.context().startTutorial({ tutorialKey: definition.key, launchSource: "manual", restartFromBeginning: true });
    for (let index = 0; index < 8; index += 1) {
      h.renderProvider();
      await h.context().nextStep();
    }
    expect(h.navigation.at(-1)).toEqual(["push", "/jeu/centre-de-formation?didacticiel=centre-formation&onglet=ecole"]);
    h.renderProvider();
    await h.context().previousStep();
    expect(h.navigation.at(-1)).toEqual(["push", "/jeu/centre-de-formation?didacticiel=centre-formation&onglet=scouting"]);
  });

  it("recovers a concrete rider destination without exposing a placeholder", async () => {
    const h = fixture();
    h.startAction.mockResolvedValueOnce({ ok: true, session: { id: "session-roster" }, progress: { tutorial_key: "roster-management", status: "completed" }, currentStepKey: "rider-overview", resolvedRoute: "/jeu/coureurs/local-rider" });
    await h.context().startTutorial({ tutorialKey: "roster-management", launchSource: "replay", restartFromBeginning: true });
    h.setRoute("/jeu/staff");
    h.renderProvider();
    expect(h.context().resumeActiveTutorial()).toBe(true);
    expect(h.navigation).toEqual([["push", "/jeu/coureurs/local-rider"], ["push", "/jeu/coureurs/local-rider"]]);
    expect(h.startAction).toHaveBeenCalledTimes(1);
  });

  it("keeps the page usable when the pause acknowledgement never arrives", async () => {
    vi.useFakeTimers();
    const h = fixture();
    await h.context().startTutorial({ tutorialKey: "youth-development", launchSource: "manual", restartFromBeginning: true });
    h.renderProvider();
    h.quitAction.mockImplementationOnce(() => new Promise(() => undefined));
    const paused = h.context().quitTutorial();
    h.renderProvider();
    expect(h.context().activeTutorial).toBeNull();
    await vi.advanceTimersByTimeAsync(clientRequest.TUTORIAL_CLIENT_REQUEST_TIMEOUT_MS);
    await paused;
    h.renderProvider();
    expect(h.context().activeTutorial).toBeNull();
    expect(h.context().isPending).toBe(false);
    expect(h.context().errorMessage).toContain("peut-être été enregistrée");
  });

  it("rereads a route-driven resume after registration advanced the same active tutorial", async () => {
    const h = fixture();
    await h.context().startTutorial({ tutorialKey: "criterium-discovery", launchSource: "manual", restartFromBeginning: true });
    h.startAction.mockResolvedValueOnce({ ok: true, session: { id: "session-criterium-discovery" }, progress: { tutorial_key: "criterium-discovery", status: "in_progress" }, currentStepKey: "registration-confirmed", resolvedRoute: "/jeu/calendrier" });
    h.setRoute("/jeu/calendrier");
    h.renderProvider();
    await h.context().startTutorial({ tutorialKey: "criterium-discovery", launchSource: "resume", restartFromBeginning: false });
    h.renderProvider();
    expect(h.startAction).toHaveBeenCalledTimes(2);
    expect(h.context().activeTutorial).toMatchObject({ currentStepIndex: 6 });
    expect(h.navigation).toEqual([["push", "/jeu/courses/criterium-de-la-decouverte"]]);
  });
});
