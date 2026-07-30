export type SportingDirectorProfileField =
  | "displayName"
  | "countryId"
  | "avatarKey"
  | "alphaTesterFrameEnabled"
  | "hideEmail";

export type SportingDirectorProfileState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors: Partial<
    Record<SportingDirectorProfileField, string[]>
  >;
};

export const initialSportingDirectorProfileState: SportingDirectorProfileState =
  {
    status: "idle",
    message: "",
    fieldErrors: {},
  };