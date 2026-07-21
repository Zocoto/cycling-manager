import type { AmateurJerseyConfig } from "@/lib/amateur-team";

export type JerseyEditorField =
  | "jerseyPattern"
  | "primaryColor"
  | "secondaryColor"
  | "accentColor";

export type JerseyEditorState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors: Partial<Record<JerseyEditorField, string[]>>;
  savedJersey: AmateurJerseyConfig | null;
};

export const initialJerseyEditorState: JerseyEditorState = {
  status: "idle",
  message: "",
  fieldErrors: {},
  savedJersey: null,
};
