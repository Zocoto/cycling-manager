export type ResetRequestField = "email";

export type ResetRequestState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors: Partial<
    Record<ResetRequestField, string[]>
  >;
};

export const initialResetRequestState: ResetRequestState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};