export type PasswordUpdateField =
  | "password"
  | "passwordConfirmation";

export type PasswordUpdateState = {
  status: "idle" | "error";
  message: string;
  fieldErrors: Partial<
    Record<PasswordUpdateField, string[]>
  >;
};

export const initialPasswordUpdateState: PasswordUpdateState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};