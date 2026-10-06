import { describe, expect, it } from "vitest";
import { readChatImageSendResponse } from "./chat-image-response";

describe("chat image response failures", () => {
  it.each([404, 500, 502, 504])("does not expose HTML JSON parsing errors for HTTP %i", async (status) => {
    const response = new Response('<!DOCTYPE html><html>Server error</html>', {
      status, headers: { "content-type": "text/html" },
    });
    await expect(readChatImageSendResponse(response)).rejects.toThrow("brouillon est conservé");
  });
  it("preserves API validation messages", async () => {
    await expect(readChatImageSendResponse(Response.json({ error: "Limite atteinte" }, { status: 429 })))
      .rejects.toThrow("Limite atteinte");
  });
  it("handles platform body limits without JSON", async () => {
    await expect(readChatImageSendResponse(new Response("Too large", { status: 413 })))
      .rejects.toThrow("trop volumineuse");
  });
  it("handles expired authentication without JSON", async () => {
    await expect(readChatImageSendResponse(new Response("Unauthorized", { status: 401 })))
      .rejects.toThrow("Reconnectez-vous");
  });
  it.each(["", "null", "{", '{"message":null}', '{"message":{"id":"invalid","message":"caption"}}'])
    ("rejects malformed/empty success payloads without losing the draft: %s", async (body) => {
      await expect(readChatImageSendResponse(new Response(body, { headers: { "content-type": "application/json" } })))
        .rejects.toThrow("brouillon est conservé");
    });
  it("does not mistake a login HTML redirect for a sent message", async () => {
    await expect(readChatImageSendResponse(new Response("<!DOCTYPE html>Login", { headers: { "content-type": "text/html" } })))
      .rejects.toThrow("brouillon est conservé");
  });
  it("returns the confirmed saved message", async () => {
    const message = { id: "12345678-1234-4234-8234-123456789abc", message: "Caption" };
    expect(await readChatImageSendResponse(Response.json({ message }))).toEqual(message);
  });
});
