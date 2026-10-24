import type { MouseEvent, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Link from "./app-link";
import { confirmManagementDraftNavigation } from "@/lib/game/management-navigation";

const { renderedLinks } = vi.hoisted(() => ({
  renderedLinks: [] as Array<{
    onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
    onNavigate?: (event: { preventDefault: () => void }) => void;
    prefetch?: boolean | null;
  }>,
}));

vi.mock("next/link", () => ({
  default: (props: {
    href: string | {
      pathname?: string;
      query?: Record<string, string>;
      hash?: string;
    };
    children?: ReactNode;
    onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
    prefetch?: boolean | null;
  }) => {
    renderedLinks.push(props);
    const href = typeof props.href === "string"
      ? props.href
      : `${props.href.pathname ?? ""}${props.href.query ? `?${new URLSearchParams(props.href.query)}` : ""}${props.href.hash ? `#${props.href.hash.replace(/^#/, "")}` : ""}`;
    return <a href={href}>{props.children}</a>;
  },
  useLinkStatus: () => ({ pending: false }),
}));

vi.mock("@/lib/game/management-navigation", () => ({
  confirmManagementDraftNavigation: vi.fn(() => true),
}));

const origin = "https://cyclostratege.test";
let browserLocation: { pathname: string; origin: string; href: string; assign: ReturnType<typeof vi.fn> };
let fetchSpy: ReturnType<typeof vi.fn>;

function renderLink(props: Parameters<typeof Link>[0] = { href: "/jeu/calendrier" }) {
  renderedLinks.length = 0;
  const markup = renderToStaticMarkup(<Link {...props}>Calendrier</Link>);
  expect(renderedLinks).toHaveLength(1);
  return { markup, props: renderedLinks[0] };
}

function clickEvent(
  href = `${origin}/jeu/calendrier`,
  overrides: Partial<MouseEvent<HTMLAnchorElement>> = {},
  attributes: Record<string, string> = {},
) {
  const target = new URL(href, origin);
  const anchor = {
    nodeName: "A",
    tagName: "A",
    href: target.href,
    origin: target.origin,
    pathname: target.pathname,
    target: attributes.target ?? "",
    download: attributes.download ?? "",
    getAttribute: (name: string) => attributes[name] ?? null,
    hasAttribute: (name: string) => Object.hasOwn(attributes, name),
  } as unknown as HTMLAnchorElement;
  const event = {
    currentTarget: anchor,
    target: anchor,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
    preventDefault: vi.fn(function (this: { defaultPrevented: boolean }) {
      this.defaultPrevented = true;
    }),
    ...overrides,
  } as unknown as MouseEvent<HTMLAnchorElement>;
  return event;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(confirmManagementDraftNavigation).mockReturnValue(true);
  browserLocation = {
    pathname: "/jeu/courses/tour-des-alpes",
    origin,
    href: `${origin}/jeu/courses/tour-des-alpes?inscription=confirmee#peloton`,
    assign: vi.fn(),
  };
  fetchSpy = vi.fn();
  vi.stubGlobal("window", { location: browserLocation });
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => vi.unstubAllGlobals());

describe("retour sécurisé au calendrier après une inscription", () => {
  it("déclenche exactement une navigation GET documentaire, sans rejouer l'inscription", () => {
    const { props, markup } = renderLink();
    const event = clickEvent();
    expect(markup).toContain('href="/jeu/calendrier"');
    expect(props.onClick).toBeTypeOf("function");

    props.onClick?.(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(browserLocation.assign).toHaveBeenCalledExactlyOnceWith(`${origin}/jeu/calendrier`);
    expect(confirmManagementDraftNavigation).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("conserve paramètres et ancre de l'URL réellement cliquée", () => {
    const href = "/jeu/calendrier/?wildcard=demandee&course=tour-des-alpes#courses";
    const { props } = renderLink({ href });
    const event = clickEvent(`${origin}${href}`);
    props.onClick?.(event);
    expect(browserLocation.assign).toHaveBeenCalledExactlyOnceWith(`${origin}${href}`);
  });

  it("préserve aussi query et hash d'un href objet sans les reconstruire", () => {
    const { props, markup } = renderLink({
      href: {
        pathname: "/jeu/calendrier",
        query: { course: "tour-des-alpes", inscription: "confirmee" },
        hash: "courses",
      },
    });
    const target = `${origin}/jeu/calendrier?course=tour-des-alpes&inscription=confirmee#courses`;
    expect(markup).toContain("course=tour-des-alpes&amp;inscription=confirmee#courses");
    props.onClick?.(clickEvent(target));
    expect(browserLocation.assign).toHaveBeenCalledExactlyOnceWith(target);
  });

  it("garde le même garde-fou pour un lien préchargé uniquement sur intention", () => {
    const { props } = renderLink({ href: "/jeu/calendrier", prefetchOnIntent: true });
    expect(props.prefetch).toBe(false);
    props.onClick?.(clickEvent());
    expect(browserLocation.assign).toHaveBeenCalledTimes(1);
  });

  it("lit la route courante au clic et non au rendu du lien", () => {
    browserLocation.pathname = "/jeu";
    const { props } = renderLink();
    browserLocation.pathname = "/jeu/courses/ronde-van-brabant";
    props.onClick?.(clickEvent());
    expect(browserLocation.assign).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["ctrl", { ctrlKey: true }],
    ["meta", { metaKey: true }],
    ["shift", { shiftKey: true }],
    ["alt", { altKey: true }],
    ["bouton central", { button: 1 }],
    ["bouton secondaire", { button: 2 }],
    ["événement déjà annulé", { defaultPrevented: true }],
  ] as const)("ne détourne pas un clic %s", (_label, overrides) => {
    const { props } = renderLink();
    const event = clickEvent(undefined, overrides);
    props.onClick?.(event);
    expect(browserLocation.assign).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(confirmManagementDraftNavigation).not.toHaveBeenCalled();
  });

  it.each<Record<string, string>>([
    { target: "_blank" },
    { target: "autre-fenetre" },
    { download: "" },
    { download: "calendrier.html" },
  ])("respecte les attributs natifs %j", (attributes) => {
    const { props } = renderLink({ href: "/jeu/calendrier", ...attributes });
    const event = clickEvent(undefined, {}, attributes);
    props.onClick?.(event);
    expect(browserLocation.assign).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("accepte explicitement target=_self", () => {
    const { props } = renderLink({ href: "/jeu/calendrier", target: "_self" });
    props.onClick?.(clickEvent(undefined, {}, { target: "_self" }));
    expect(browserLocation.assign).toHaveBeenCalledTimes(1);
  });

  it("respecte le callback consommateur avant de changer de document", () => {
    const calls: string[] = [];
    browserLocation.assign.mockImplementation(() => calls.push("navigation"));
    const onClick = vi.fn(() => calls.push("consommateur"));
    const { props } = renderLink({ href: "/jeu/calendrier", onClick });
    const event = clickEvent();
    props.onClick?.(event);
    expect(onClick).toHaveBeenCalledExactlyOnceWith(event);
    expect(calls).toEqual(["consommateur", "navigation"]);
  });

  it("ne navigue pas si le callback consommateur annule le clic", () => {
    const onClick = vi.fn((event: MouseEvent<HTMLAnchorElement>) => event.preventDefault());
    const { props } = renderLink({ href: "/jeu/calendrier", onClick });
    const event = clickEvent();
    props.onClick?.(event);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(browserLocation.assign).not.toHaveBeenCalled();
    expect(confirmManagementDraftNavigation).not.toHaveBeenCalled();
  });

  it("préserve la confirmation des changements de gestion non enregistrés", () => {
    vi.mocked(confirmManagementDraftNavigation).mockReturnValue(false);
    const { props } = renderLink();
    const event = clickEvent();
    props.onClick?.(event);
    expect(confirmManagementDraftNavigation).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(browserLocation.assign).not.toHaveBeenCalled();
  });

  it("refuse de détourner une ancre d'une autre origine", () => {
    const { props } = renderLink();
    const event = clickEvent("https://autre.example/jeu/calendrier");
    props.onClick?.(event);
    expect(browserLocation.assign).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it.each([
    "/jeu",
    "/jeu/calendrier",
    "/jeu/preparation-course",
    "/jeu/resultats/tour-des-alpes",
    "/jeu/courses/tour-des-alpes/historique/4",
  ])("ne force pas de rechargement depuis %s", (pathname) => {
    browserLocation.pathname = pathname;
    const { props } = renderLink();
    const event = clickEvent();
    props.onClick?.(event);
    expect(browserLocation.assign).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it.each([
    "/jeu/preparation-course",
    "/jeu/resultats/tour-des-alpes",
    "/jeu/calendrier/course",
    "/jeu/calendrier-autre",
    "https://autre.example/jeu/calendrier",
  ])("préserve la navigation Next.js ordinaire vers %s", (href) => {
    const { props } = renderLink({ href });
    const event = clickEvent(href);
    props.onClick?.(event);
    expect(browserLocation.assign).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(props.prefetch).toBe(false);
  });
});
