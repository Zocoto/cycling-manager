import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { RiderQuickPreview } from "@/lib/game/rider-quick-preview";

const runtime = vi.hoisted(() => ({
  states: [] as unknown[],
  cursor: 0,
  effects: [] as Array<() => unknown>,
  fetchPreview: vi.fn(),
}));

vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useId: () => "preview",
  useRef: (current: unknown) => ({ current }),
  useEffect: (effect: () => unknown) => { runtime.effects.push(effect); },
  useLayoutEffect: () => {},
  useState: (initial: unknown) => {
    const index = runtime.cursor++;
    if (!(index in runtime.states)) runtime.states[index] = typeof initial === "function" ? initial() : initial;
    return [runtime.states[index], (value: unknown) => {
      runtime.states[index] = typeof value === "function" ? value(runtime.states[index]) : value;
    }];
  },
}));
vi.mock("react-dom", () => ({ createPortal: (node: unknown) => node }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("@/components/game/equipment-rating-bonus", () => ({ EquipmentRatingBonus: () => null }));
vi.mock("@/lib/game/rider-preview-client", () => ({ getRiderPreview: runtime.fetchPreview }));

import { RiderPreviewLink, type RiderPreviewLinkProps } from "./rider-preview-link";

type Element = { type: unknown; props: Record<string, unknown> };

function elements(node: unknown): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  return [element, ...elements(element.props.children)];
}

function find(node: unknown, match: (element: Element) => boolean) {
  const element = elements(node).find(match);
  if (!element) throw new Error("Expected preview element");
  return element;
}

const profile: RiderQuickPreview = {
  id: "rider-a", name: "Lou Martin", age: 24, potentialSteps: null, scoutedPotential: null,
  country: { code: "FR", name: "France" }, team: { id: "club-a", name: "Club A" },
  ratings: null, equipmentRatingBonuses: {}, ratingVisibility: "unavailable",
};

function render(props: Partial<RiderPreviewLinkProps> = {}) {
  runtime.cursor = 0;
  runtime.effects = [];
  return (RiderPreviewLink as unknown as {
    render: (props: RiderPreviewLinkProps, ref: null) => unknown;
  }).render({ riderId: profile.id, href: `/jeu/coureurs/${profile.id}`, children: profile.name, ...props }, null);
}

function trigger(tree: unknown) {
  return find(tree, (element) => "data-rider-preview-trigger" in element.props);
}

function content(tree: unknown) {
  return find(tree, (element) => typeof element.type === "function" && "loadState" in element.props);
}

function event(pointerType?: string) {
  return { pointerType, defaultPrevented: false, preventDefault: vi.fn() };
}

function call(element: Element, name: string, argument: ReturnType<typeof event>) {
  (element.props[name] as (value: ReturnType<typeof event>) => void)(argument);
}

beforeEach(() => {
  vi.useFakeTimers();
  runtime.states = [];
  runtime.fetchPreview.mockReset();
  vi.stubGlobal("document", { body: {}, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("window", { setTimeout, clearTimeout });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("uses provided ratings on auto-open, focus and hover without fetching", () => {
  let tree = render({ autoOpen: true, previewData: profile });
  runtime.effects[0]();
  expect(content(tree).props.preview).toBe(profile);
  expect(content(tree).props.loadState).toBe("loaded");
  call(trigger(tree), "onFocus", event());
  call(trigger(tree), "onPointerEnter", event("mouse"));
  vi.advanceTimersByTime(100);
  tree = render({ autoOpen: true, previewData: profile });
  expect(content(tree).props.preview).toBe(profile);
  expect(runtime.fetchPreview).not.toHaveBeenCalled();
});

it("reads updated provided data immediately while the same rider remains open", () => {
  render({ autoOpen: true, previewData: profile });
  const updated = { ...profile, name: "Lou Martin actualisé", age: 25 };
  const tree = render({ autoOpen: true, previewData: updated });
  expect(content(tree).props.preview).toBe(updated);
  expect(runtime.fetchPreview).not.toHaveBeenCalled();
});

it("loads the requested rider when provided data belongs to someone else", async () => {
  runtime.fetchPreview.mockResolvedValue(profile);
  render({ autoOpen: true, previewData: { ...profile, id: "other-rider" } });
  runtime.effects[0]();
  await Promise.resolve();
  const tree = render({ autoOpen: true, previewData: { ...profile, id: "other-rider" } });
  expect(runtime.fetchPreview).toHaveBeenCalledExactlyOnceWith(profile.id);
  expect(content(tree).props.preview).toBe(profile);
});

it("keeps remote previews lazy and opens the existing touch preview before navigation", async () => {
  runtime.fetchPreview.mockResolvedValue(profile);
  let tree = render();
  expect(runtime.fetchPreview).not.toHaveBeenCalled();
  call(trigger(tree), "onPointerDown", event("touch"));
  const firstTap = event();
  call(trigger(tree), "onClick", firstTap);
  expect(firstTap.preventDefault).toHaveBeenCalledOnce();
  expect(runtime.fetchPreview).toHaveBeenCalledExactlyOnceWith(profile.id);
  await Promise.resolve();
  tree = render();
  expect(content(tree).props.preview).toBe(profile);
  const secondTap = event();
  call(trigger(tree), "onClick", secondTap);
  expect(secondTap.preventDefault).not.toHaveBeenCalled();
});

it("uses the trigger's real junior profile for the full-profile link", () => {
  const href = "/jeu/centre-de-formation/development/junior-a";
  const tree = render({ href, autoOpen: true, previewData: profile });
  const panel = content(tree);
  const markup = renderToStaticMarkup((panel.type as (props: typeof panel.props) => React.ReactNode)(panel.props));
  expect(markup).toContain(`href="${href}"`);
  expect(markup).toContain("Voir la fiche");
  expect(markup).not.toContain(`/jeu/coureurs/${profile.id}`);
});

it("opens a school-only overview on click and omits the unavailable full-profile link", () => {
  let tree = render({ href: "#", profileHref: null, previewData: profile });
  const click = event();
  call(trigger(tree), "onClick", click);
  expect(click.preventDefault).toHaveBeenCalledOnce();
  tree = render({ href: "#", profileHref: null, previewData: profile });
  const panel = content(tree);
  const markup = renderToStaticMarkup((panel.type as (props: typeof panel.props) => React.ReactNode)(panel.props));
  expect(markup).toContain(profile.name);
  expect(markup).not.toContain("Voir la fiche");
  expect(runtime.fetchPreview).not.toHaveBeenCalled();
});

it("keeps Escape closed when restoring focus and still opens on ordinary keyboard focus", () => {
  let tree = render({ autoOpen: true, previewData: profile });
  const link = trigger(tree);
  const focus = vi.fn(() => call(link, "onFocus", event()));
  (link.props.ref as (node: unknown) => void)({ focus });
  runtime.effects[1]();
  const keydown = vi.mocked(document.addEventListener).mock.calls.find(([name]) => name === "keydown")?.[1];
  expect(keydown).toBeTypeOf("function");
  if (typeof keydown !== "function") throw new Error("Expected a keyboard event listener");
  keydown({ key: "Escape" } as KeyboardEvent);

  tree = render({ autoOpen: true, previewData: profile });
  expect(focus).toHaveBeenCalledOnce();
  expect(elements(tree).some((element) => element.props.role === "dialog")).toBe(false);

  call(trigger(tree), "onFocus", event());
  tree = render({ autoOpen: true, previewData: profile });
  expect(elements(tree).some((element) => element.props.role === "dialog")).toBe(true);
  expect(runtime.fetchPreview).not.toHaveBeenCalled();
});
