export type AmateurTeamField =
  | "teamName"
  | "countryId"
  | "jerseyPattern"
  | "primaryColor"
  | "secondaryColor"
  | "accentColor";

export type AmateurTeamCreationState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors: Partial<Record<AmateurTeamField, string[]>>;
};

export const initialAmateurTeamCreationState: AmateurTeamCreationState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};
