import React, { use } from "react";
import { renderToReadableStream } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./dashboard-assistant", () => ({ DashboardAssistantSkeleton: () => <p>assistant-loading</p> }));
import { DashboardAssistantBoundary } from "./dashboard-assistant-boundary";

function deferred() {
  let resolve!: (value: string) => void;
  const promise = new Promise<string>((done) => { resolve = done; });
  return { promise, resolve };
}
function Content({ value }: { value: Promise<string> }) {
  return <p>{use(value)}</p>;
}

describe("assistant progressive rendering", () => {
  it("streams essential alerts before a slow calendar, then preserves supplemental alerts", async () => {
    const essential = deferred();
    const supplemental = deferred();
    const stream = await renderToReadableStream(
      <main><p>bureau-ready</p><DashboardAssistantBoundary ready={essential.promise} initial={<Content value={essential.promise} />}>
        <Content value={supplemental.promise} />
      </DashboardAssistantBoundary></main>,
    );
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let html = "";
    async function readUntil(text: string) {
      while (!html.includes(text)) {
        const chunk = await reader.read();
        if (chunk.done) throw new Error(`Stream ended before ${text}`);
        html += decoder.decode(chunk.value);
      }
    }
    try {
      await readUntil("assistant-loading");
      essential.resolve("essential-alerts-ready");
      await readUntil("essential-alerts-ready");
      expect(html).not.toContain("calendar-and-weight-alerts-ready");
      supplemental.resolve("calendar-and-weight-alerts-ready");
      await readUntil("calendar-and-weight-alerts-ready");
    } finally {
      essential.resolve("essential-alerts-ready");
      supplemental.resolve("calendar-and-weight-alerts-ready");
      await reader.cancel();
    }
  });
});
