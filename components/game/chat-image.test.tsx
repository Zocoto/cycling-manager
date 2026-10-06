import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChatImage, ChatImageDraftPreview } from "./chat-image";

describe("chat image UI", () => {
  it("has an explicit removable preview, not an auto-send", () => {
    const html = renderToStaticMarkup(<ChatImageDraftPreview src="blob:local" disabled={false} onRemove={vi.fn()} />);
    expect(html).toContain('type="button"'); expect(html).toContain("Retirer l’image");
    expect(html).toContain("Aperçu"); expect(html).not.toContain('type="submit"');
  });
  it("loads thumbnails lazily with reserved dimensions and safe enlargement", () => {
    const html = renderToStaticMarkup(<ChatImage image={{ href: "/api/game/chat/images/id", width: 800, height: 400 }} author="Roger" />);
    expect(html).toContain('loading="lazy"'); expect(html).toContain('decoding="async"');
    expect(html).toContain('width="800"'); expect(html).toContain('height="400"');
    expect(html).toContain('rel="noopener noreferrer"'); expect(html).toContain("Agrandir");
  });
});
