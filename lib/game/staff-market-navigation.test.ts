import { describe, expect, it } from "vitest";
import { getDirectorMessageActionHref } from "./director-mailbox";
import {
  filterStaffMarketAlertListings,
  getStaffRecruitmentTargetHref,
  normalizeStaffMarketListingId,
} from "./staff-market-navigation";

const id = "d26b943a-10d7-49ba-9674-1feb2a58ad2f";
const secondId = "ab7c2110-3cdd-4f55-b4ad-39cf97277bb3";
const targetedHref = `/jeu/staff?onglet=marche&profil=${id}#staff-${id}`;

describe("staff recruitment alert navigation", () => {
  it("makes existing mail anchors filter the exact listing, overriding unrelated filters", () => {
    const href = `/jeu/staff?onglet=marche&metier=doctor#staff-${id}`;
    expect(getStaffRecruitmentTargetHref(href)).toBe(targetedHref);
    expect(getDirectorMessageActionHref({ type: "system", href, sourceReference: `recruitment-alert:staff:${id}` }))
      .toBe(targetedHref);
    expect(getStaffRecruitmentTargetHref(targetedHref)).toBe(targetedHref);
  });

  it.each([
    null, "/jeu/staff?onglet=marche", "/jeu/staff?onglet=equipe#staff-" + id,
    `/jeu/transferts?onglet=quotidiennes#enchere-${id}`,
    `https://example.com/jeu/staff#staff-${id}`, `//example.com/jeu/staff#staff-${id}`,
    `/jeu/staff#staff-${id}-extra`, "/jeu/staff?profil=not-a-uuid",
  ])("does not retarget unrelated or invalid links: %s", (href) => {
    expect(getStaffRecruitmentTargetHref(href)).toBeNull();
    expect(getDirectorMessageActionHref({ type: "system", href, sourceReference: null })).toBe(href);
  });

  it("normalizes database IDs without accepting query syntax", () => {
    expect(normalizeStaffMarketListingId(id.toUpperCase())).toBe(id);
    expect(normalizeStaffMarketListingId(`${id}&niveau=5`)).toBeUndefined();
  });

  it("shows only the notified profile and no unrelated replacement if it has gone", () => {
    const listings = [{ id }, { id: secondId }];
    expect(filterStaffMarketAlertListings(listings, { listingId: id })).toEqual([{ id }]);
    expect(filterStaffMarketAlertListings([{ id: secondId }], { listingId: id })).toEqual([]);
    expect(listings).toHaveLength(2);
  });

  it("shows the available profiles referenced by grouped alerts and leaves the ordinary market intact", () => {
    const listings = [{ id }, { id: secondId }];
    expect(filterStaffMarketAlertListings(listings, {
      alertSourceReferences: [`recruitment-alert:staff:${secondId}`, `recruitment-alert:rider:${id}`],
    })).toEqual([{ id: secondId }]);
    expect(filterStaffMarketAlertListings(listings, { alertSourceReferences: [] })).toEqual([]);
    expect(filterStaffMarketAlertListings(listings, {})).toBe(listings);
  });
});
