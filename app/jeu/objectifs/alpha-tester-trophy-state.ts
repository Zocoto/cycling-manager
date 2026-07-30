export type ClaimAlphaTesterTrophyState = {
  status: "idle" | "error" | "success";
  message: string;
};

export const initialClaimAlphaTesterTrophyState: ClaimAlphaTesterTrophyState = {
  status: "idle",
  message: "",
};