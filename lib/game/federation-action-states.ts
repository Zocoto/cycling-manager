export type FederationFormActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export type NationalJerseyFormActionState = FederationFormActionState & {
  publishedDesign: null;
  version: number | null;
  activationGameYear: number | null;
};

export const initialFederationGovernanceActionState: FederationFormActionState = {
  status: "idle",
  message: "",
};

export const initialAmateurTeamAffiliationActionState: FederationFormActionState = {
  status: "idle",
  message: "",
};

export const initialFederationFinanceActionState: FederationFormActionState = {
  status: "idle",
  message: "",
};

export const initialFederationInfrastructureActionState: FederationFormActionState = {
  status: "idle",
  message: "",
};

export const initialFederationSelectionActionState: FederationFormActionState = {
  status: "idle",
  message: "",
};

export const initialNationalJerseyPublishState: NationalJerseyFormActionState = {
  status: "idle",
  message: "",
  publishedDesign: null,
  version: null,
  activationGameYear: null,
};
