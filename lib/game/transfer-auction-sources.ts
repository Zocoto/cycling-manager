export const TRANSFER_AUCTION_SOURCES = [
  { id: "director", label: "Offres des DS" },
  { id: "daily", label: "Offres quotidiennes" },
  { id: "national-day", label: "Offres des fêtes nationales" },
] as const;

export type TransferAuctionSource = (typeof TRANSFER_AUCTION_SOURCES)[number]["id"];
export type TransferAuctionSourceSelection = Record<TransferAuctionSource, boolean>;

export const ALL_TRANSFER_AUCTION_SOURCES: TransferAuctionSourceSelection = {
  director: true,
  daily: true,
  "national-day": true,
};

export function getTransferAuctionSource(listing: {
  type: "daily" | "director";
  isNationalDayBonus: boolean;
}): TransferAuctionSource {
  if (listing.type === "director") return "director";
  return listing.isNationalDayBonus ? "national-day" : "daily";
}
