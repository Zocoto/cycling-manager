import type { ComponentProps, MouseEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LOCALE_COOKIE_NAME } from "@/lib/i18n/config";
import PublicLink from "./public-link";

const state = vi.hoisted(() => ({ locale: "en", linkProps: {} as ComponentProps<"a">, assign: vi.fn() }));
vi.mock("@/components/i18n/locale-provider", () => ({ useLocale: () => ({ locale: state.locale }) }));
vi.mock("@/components/ui/app-link", () => ({
  default: (props: ComponentProps<"a">) => { state.linkProps = props; return <a {...props} />; },
}));

beforeEach(() => {
  state.locale = "en";
  state.assign.mockReset();
  vi.stubGlobal("window", { location: { protocol: "https:", pathname: "/en/guide", assign: state.assign } });
  vi.stubGlobal("document", { cookie: "" });
});
afterEach(() => vi.unstubAllGlobals());

function click(overrides: Record<string, unknown> = {}, anchorOverrides: Record<string, unknown> = {}) {
  const event = {
    button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false,
    currentTarget: { href: "https://cyclostratege.com/inscription?from=guide#team", target: "", hasAttribute: () => false, ...anchorOverrides },
    preventDefault() { this.defaultPrevented = true; },
    ...overrides,
  };
  state.linkProps.onClick?.(event as unknown as MouseEvent<HTMLAnchorElement>);
  return event;
}

describe("public to account navigation", () => {
  it("does not change the game locale merely by rendering a public link", () => {
    renderToStaticMarkup(<PublicLink href="/inscription">Join</PublicLink>);
    expect(document.cookie).toBe("");
    expect(state.assign).not.toHaveBeenCalled();
  });

  it.each([["/en/guide", "en"], ["/guide", "fr"], ["/nouveautes/news-id", "fr"]])(
    "persists the URL language on a normal signup click from %s", (pathname, expectedLocale) => {
      window.location.pathname = pathname;
      renderToStaticMarkup(<PublicLink href="/inscription?from=guide#team">Join</PublicLink>);
      expect(click().defaultPrevented).toBe(true);
      expect(document.cookie).toBe(`${LOCALE_COOKIE_NAME}=${expectedLocale}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`);
      expect(state.assign).toHaveBeenCalledExactlyOnceWith(`https://cyclostratege.com/inscription?from=guide&lang=${expectedLocale}#team`);
    },
  );

  it("handles login links through the same document boundary", () => {
    renderToStaticMarkup(<PublicLink href="/connexion">Login</PublicLink>);
    click({}, { href: "https://cyclostratege.com/connexion" });
    expect(document.cookie).toContain(`${LOCALE_COOKIE_NAME}=en;`);
    expect(state.assign).toHaveBeenCalledExactlyOnceWith("https://cyclostratege.com/connexion?lang=en");
  });

  it.each(["/jeu", "/connexion", "/inscription", "/unknown"])(
    "does not persist a public locale from the cookie-based path %s", (pathname) => {
      window.location.pathname = pathname;
      renderToStaticMarkup(<PublicLink href="/inscription">Join</PublicLink>);
      click();
      expect(document.cookie).toBe("");
    },
  );

  it.each([{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }])(
    "preserves modified clicks without changing cookies: %o", (modifiers) => {
      renderToStaticMarkup(<PublicLink href="/inscription">Join</PublicLink>);
      expect(click(modifiers).defaultPrevented).toBe(false);
      expect(document.cookie).toBe("");
      expect(state.assign).not.toHaveBeenCalled();
    },
  );

  it.each([{ target: "_blank" }, { hasAttribute: () => true }])("preserves target and download links: %o", (anchor) => {
    renderToStaticMarkup(<PublicLink href="/inscription">Join</PublicLink>);
    expect(click({}, anchor).defaultPrevented).toBe(false);
    expect(document.cookie).toBe("");
    expect(state.assign).not.toHaveBeenCalled();
  });

  it("honours a caller's cancelled click", () => {
    const onClick = vi.fn((event: MouseEvent<HTMLAnchorElement>) => event.preventDefault());
    renderToStaticMarkup(<PublicLink href="/inscription" onClick={onClick}>Join</PublicLink>);
    click();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(document.cookie).toBe("");
    expect(state.assign).not.toHaveBeenCalled();
  });

  it("leaves external URL objects untouched even if their pathname resembles authentication", () => {
    const html = renderToStaticMarkup(<PublicLink href={{ protocol: "https:", hostname: "example.com", pathname: "/inscription" }}>External</PublicLink>);
    click();
    expect(html).not.toContain('data-navigation-mode="document"');
    expect(document.cookie).toBe("");
    expect(state.assign).not.toHaveBeenCalled();
  });
});
