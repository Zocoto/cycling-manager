export type RegistrationField =
  | "managerName"
  | "email"
  | "password"
  | "passwordConfirmation";

export type RegistrationState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors: Partial<Record<RegistrationField, string[]>>;
};

export const initialRegistrationState: RegistrationState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};