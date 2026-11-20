import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({ error: false }));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useActionState: () => [{
    status: runtime.error ? "error" : "idle",
    message: runtime.error ? "Connexion impossible dans ce test" : "",
    fieldErrors: {},
  }, "/login-fixture", false],
}));
vi.mock("../../app/(public)/connexion/actions", () => ({ loginAccount: vi.fn() }));

import { LoginForm } from "./login-form";

beforeEach(() => { runtime.error = false; });

it.each(["/apercus/noel/index.html", "/apercus/noel/index.html#tournee"])(
  "keeps the requested preview in a hidden field through a failed login (%s)", (returnTo) => {
    for (const error of [false, true]) {
      runtime.error = error;
      const html = renderToStaticMarkup(<LoginForm returnTo={returnTo} />);
      expect(html).toContain(`type="hidden" name="returnTo" value="${returnTo}"`);
      if (error) expect(html).toContain("Connexion impossible dans ce test");
    }
  },
);

it.each([undefined, "/jeu", "https://example.test", "//example.test"])(
  "keeps ordinary login unchanged for %s", (returnTo) => {
    expect(renderToStaticMarkup(<LoginForm returnTo={returnTo} />)).not.toContain('name="returnTo"');
  },
);
