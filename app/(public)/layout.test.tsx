import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ version: vi.fn() }));
vi.mock("@/services/site-release", () => ({ getActiveSiteVersion: mocks.version }));
vi.mock("../../components/layout/public-header", () => ({ PublicHeader: () => null }));
vi.mock("../../components/layout/public-footer", () => ({ PublicFooter: ({ activeVersion }: { activeVersion: string }) => <footer>{activeVersion}</footer> }));
import Layout from "./layout";
describe("public version wiring", () => {
  it("passes the cached active version to the existing footer without an extra browser fetch", async () => {
    mocks.version.mockResolvedValue("1.2.3");
    const html = renderToStaticMarkup(await Layout({ children: "Content" as ReactNode }));
    expect(html).toContain("<footer>1.2.3</footer>"); expect(mocks.version).toHaveBeenCalledOnce();
  });
});
