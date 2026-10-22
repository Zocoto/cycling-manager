import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ locale: "fr" }));
vi.mock("@/components/i18n/locale-provider", () => ({ useLocale: () => ({ locale: mocks.locale }) }));
import { SiteReleaseManagementPanel, preserveSavedSiteRelease } from "./site-release-management";
const initial = { version: "1.2.3", revision: 4, updated_at: "2026-10-22T12:00:00Z", history: [{ version: "1.2.3", previous_version: "1.2.2", revision: 4, note: "Correction <script>", recorded_at: "2026-10-22T12:00:00Z" }] };
const action = async () => ({ status: "idle" as const, message: null });
describe("compact version settings", () => {
  it("preserves the last confirmed revision after a later validation error or conflict", () => {
    for (const status of ["error", "conflict"] as const) {
      expect(preserveSavedSiteRelease({ status: "success", message: null, management: initial }, { status, message: "Refus" })).toMatchObject({ status, management: initial });
    }
    const updated = { ...initial, revision: 5 };
    expect(preserveSavedSiteRelease({ status: "success", message: null, management: initial }, { status: "success", message: null, management: updated }).management).toBe(updated);
  });
  it("is collapsed, uses a separate form and displays the current revision and escaped history", () => {
    mocks.locale = "fr";
    const html = renderToStaticMarkup(<SiteReleaseManagementPanel initial={initial} action={action} />);
    expect(html).toContain("Version du site"); expect(html).toContain('name="revision" value="4"');
    expect(html).toContain('name="version"'); expect(html).not.toContain("<details open");
    expect(html).toContain("ne déploie pas"); expect(html).toContain("Correction &lt;script&gt;"); expect(html).toContain("14:00");
    expect(html).not.toContain('value="publish"');
  });
  it("fails closed without blocking the editorial page when settings cannot be read", () => {
    const html = renderToStaticMarkup(<SiteReleaseManagementPanel initial={null} action={action} />);
    expect(html).toContain("continuer à rédiger"); expect(html).not.toContain('name="version"');
  });
  it("also offers English labels", () => {
    mocks.locale = "en";
    const html = renderToStaticMarkup(<SiteReleaseManagementPanel initial={initial} action={action} />);
    expect(html).toContain("Site version"); expect(html).toContain("Update version"); expect(html).toContain("Recent changes");
    mocks.locale = "fr";
  });
});
