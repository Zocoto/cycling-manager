import { describe, expect, it } from "vitest";
import { claimSitePresenceRefresh, includeChatPlayers, normalizeSitePresence, readSitePresenceSnapshot, releaseFailedSitePresenceRefresh, SITE_PRESENCE_REFRESH_MS, SITE_PRESENCE_SNAPSHOT_KEY, storeSitePresenceSnapshot } from "./site-presence-polling";

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
const DATA = { total: 2, visitors: 1, players: [{ id: "player", name: "Player" }] };

describe("browser-wide public presence polling", () => {
  it("counts all four chat players and the visitor when the header cache only has two players", () => {
    const gouille = { id: "gouille", name: "Gouille" };
    const ujik = { id: "ujik", name: "Ujik" };
    const self = { id: "self", name: "Zocoto" };
    const giorgos = { id: "giorgos", name: "Giorgos Gopoulos" };
    const cached = { total: 3, visitors: 1, players: [gouille, ujik] };
    const chatPlayers = [self, giorgos, gouille, ujik];
    expect(includeChatPlayers(cached, chatPlayers)).toEqual({
      total: 5, visitors: 1, players: [giorgos, gouille, ujik, self],
    });
    expect(cached).toEqual({ total: 3, visitors: 1, players: [gouille, ujik] });
    expect(includeChatPlayers(cached, [self, gouille])).toEqual({
      total: 4, visitors: 1, players: [gouille, ujik, self],
    });
  });

  it("bounds a continuously visible browser to 30 calls/hour across repeated mounts and tabs", () => {
    const storage = memoryStorage();
    let calls = 0;
    for (let second = 0; second < 3600; second += 1) {
      for (let tab = 0; tab < 4; tab += 1) {
        if (claimSitePresenceRefresh(storage, second * 1000)) calls += 1;
      }
    }
    expect(calls).toBe(30);
    expect(SITE_PRESENCE_REFRESH_MS).toBe(120_000);
  });
  it("shares a fresh public snapshot and expires it at the next interval", () => {
    const storage = memoryStorage();
    storeSitePresenceSnapshot(storage, 100, DATA);
    expect(readSitePresenceSnapshot(storage, 101)).toEqual(DATA);
    expect(readSitePresenceSnapshot(storage, 120100)).toBeNull();
    expect(readSitePresenceSnapshot(storage, 99)).toBeNull();
  });
  it("releases only the failed attempt's own lease", () => {
    const storage = memoryStorage();
    expect(claimSitePresenceRefresh(storage, 0)).toBe(true);
    expect(claimSitePresenceRefresh(storage, 120000)).toBe(true);
    releaseFailedSitePresenceRefresh(storage, 0);
    expect(claimSitePresenceRefresh(storage, 120001)).toBe(false);
    releaseFailedSitePresenceRefresh(storage, 120000);
    expect(claimSitePresenceRefresh(storage, 120001)).toBe(true);
  });
  it("ignores corrupt cached data and continues if storage is unavailable", () => {
    const storage = memoryStorage();
    storage.setItem(SITE_PRESENCE_SNAPSHOT_KEY, "{");
    expect(readSitePresenceSnapshot(storage, 1)).toBeNull();
    const unavailable = { getItem: () => { throw Error("disabled"); }, setItem: () => { throw Error("disabled"); }, removeItem: () => { throw Error("disabled"); } };
    expect(claimSitePresenceRefresh(unavailable, 1)).toBe(true);
    expect(readSitePresenceSnapshot(unavailable, 1)).toBeNull();
    expect(() => storeSitePresenceSnapshot(unavailable, 1, DATA)).not.toThrow();
  });
  it("stores only the public shape and rejects malformed player entries", () => {
    expect(normalizeSitePresence({ ...DATA, privateToken: "must not be cached" })).toEqual(DATA);
    expect(normalizeSitePresence({ ...DATA, players: [{ id: "player" }] })).toBeNull();
    expect(normalizeSitePresence({ ...DATA, total: -1 })).toBeNull();
  });
});
