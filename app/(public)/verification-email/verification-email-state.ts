export type VerificationEmailState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors: {
    email?: string[];
  };
};

export const initialVerificationEmailState: VerificationEmailState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};
