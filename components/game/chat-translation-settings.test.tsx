import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChatTranslationSettings } from "./chat-translation-settings";
describe("chat translation settings", () => {
  it("renders a checked default control, twelve native language labels, and a compact pause notice", () => {
    const html = renderToStaticMarkup(<ChatTranslationSettings automatic targetLocale="ja" paused isEnglish={false} setAutomatic={() => {}} setTargetLocale={() => {}} />);
    expect(html).toContain('checked=""'); expect(html.match(/<option /g)).toHaveLength(12);
    expect(html).toContain("日本語"); expect(html).toContain("Originaux toujours disponibles"); expect(html).toContain('role="status"');
  });
});
