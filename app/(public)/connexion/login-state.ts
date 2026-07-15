export type LoginField = "email" | "password";

export type LoginState = {
  status: "idle" | "error";
  message: string;
  fieldErrors: Partial<Record<LoginField, string[]>>;
};

export const initialLoginState: LoginState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};