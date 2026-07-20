"use client";

import { useActionState, useState } from "react";

import { registerAccount } from "../../app/(public)/inscription/actions";
import {
  initialRegistrationState,
  type RegistrationField,
} from "../../app/(public)/inscription/registration-state";

const registrationFields: RegistrationField[] = [
  "managerName",
  "email",
  "password",
  "passwordConfirmation",
];

export function RegistrationForm() {
  const [state, formAction, pending] = useActionState(
    registerAccount,
    initialRegistrationState
  );

  const [dismissedFields, setDismissedFields] = useState<
    RegistrationField[]
  >([]);

  const registrationSucceeded = state.status === "success";

  const hasFieldErrors = registrationFields.some(
    (field) => Boolean(state.fieldErrors[field]?.length)
  );

  const hasVisibleFieldErrors = registrationFields.some(
    (field) =>
      Boolean(state.fieldErrors[field]?.length) &&
      !dismissedFields.includes(field)
  );

  const shouldShowStateMessage =
    Boolean(state.message) &&
    !pending &&
    (state.status !== "error" ||
      !hasFieldErrors ||
      hasVisibleFieldErrors);

  function dismissFieldError(field: RegistrationField) {
    const fieldsToDismiss: RegistrationField[] =
      field === "password" ||
      field === "passwordConfirmation"
        ? ["password", "passwordConfirmation"]
        : [field];

    setDismissedFields((currentFields) => [
      ...new Set([...currentFields, ...fieldsToDismiss]),
    ]);
  }

  function getVisibleErrors(
    field: RegistrationField
  ): string[] | undefined {
    if (pending || dismissedFields.includes(field)) {
      return undefined;
    }

    return state.fieldErrors[field];
  }

  return (
    <div>
      {shouldShowStateMessage ? (
        <div
          role={state.status === "error" ? "alert" : "status"}
          aria-live="polite"
          className={
            state.status === "success"
              ? "mb-6 rounded-xl border border-[#42CDA8]/45 bg-[#42CDA8]/12 px-4 py-4"
              : "mb-6 rounded-xl border border-[#F2C94C]/45 bg-[#F2C94C]/10 px-4 py-4"
          }
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className={
                state.status === "success"
                  ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#42CDA8] font-black text-[#07302A]"
                  : "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F2C94C] font-black text-[#071A17]"
              }
            >
              {state.status === "success" ? "✓" : "!"}
            </span>

            <div>
              <p
                className={
                  state.status === "success"
                    ? "text-sm font-bold text-[#7FE0C0]"
                    : "text-sm font-bold text-[#F2C94C]"
                }
              >
                {state.status === "success"
                  ? "Compte créé"
                  : "Inscription impossible"}
              </p>

              <p className="mt-1 text-sm leading-6 text-[#D6DFD2]">
                {state.message}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <form
        action={formAction}
        onSubmit={() => setDismissedFields([])}
        className="space-y-5"
      >
        <FormField
          id="managerName"
          label="Nom du directeur sportif"
          type="text"
          placeholder="Votre nom dans le jeu"
          autoComplete="nickname"
          minLength={3}
          maxLength={30}
          disabled={pending || registrationSucceeded}
          errors={getVisibleErrors("managerName")}
          helpText="Entre 3 et 30 caractères. Ce nom sera visible dans le jeu."
          onChange={() => dismissFieldError("managerName")}
        />

        <FormField
          id="email"
          label="Adresse e-mail"
          type="email"
          placeholder="directeur@cycling-manager.fr"
          autoComplete="email"
          disabled={pending || registrationSucceeded}
          errors={getVisibleErrors("email")}
          onChange={() => dismissFieldError("email")}
        />

        <FormField
          id="password"
          label="Mot de passe"
          type="password"
          placeholder="12 caractères minimum"
          autoComplete="new-password"
          minLength={12}
          maxLength={72}
          disabled={pending || registrationSucceeded}
          errors={getVisibleErrors("password")}
          helpText="Utilisez au moins 12 caractères difficiles à deviner."
          onChange={() => dismissFieldError("password")}
        />

        <FormField
          id="passwordConfirmation"
          label="Confirmation du mot de passe"
          type="password"
          placeholder="Saisissez à nouveau votre mot de passe"
          autoComplete="new-password"
          minLength={12}
          maxLength={72}
          disabled={pending || registrationSucceeded}
          errors={getVisibleErrors("passwordConfirmation")}
          onChange={() =>
            dismissFieldError("passwordConfirmation")
          }
        />

        <button
          type="submit"
          disabled={pending || registrationSucceeded}
          className="min-h-12 w-full rounded-lg bg-[#F2C94C] px-5 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-[#071A17] shadow-lg transition hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFDF4] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B302B] disabled:cursor-not-allowed disabled:bg-[#315B3E] disabled:text-[#9AB0A2] disabled:shadow-none"
        >
          {registrationSucceeded
            ? "Compte créé"
            : pending
              ? "Création en cours..."
              : "Créer mon compte"}
        </button>
      </form>

      <p className="mt-4 text-center text-xs leading-5 text-[#9FB5A8]">
        En créant votre compte, vous acceptez que votre nom de directeur
        sportif soit utilisé comme identité publique dans Cyclo
        Stratège.
      </p>
    </div>
  );
}

type FormFieldProps = {
  id: RegistrationField;
  label: string;
  type: "email" | "password" | "text";
  placeholder: string;
  autoComplete: string;
  disabled: boolean;
  errors?: string[];
  helpText?: string;
  minLength?: number;
  maxLength?: number;
  onChange: () => void;
};

function FormField({
  id,
  label,
  type,
  placeholder,
  autoComplete,
  disabled,
  errors,
  helpText,
  minLength,
  maxLength,
  onChange,
}: FormFieldProps) {
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;

  const describedBy = [
    helpText ? helpId : null,
    errors?.length ? errorId : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-bold text-[#FFFDF4]"
      >
        {label}
      </label>

      <input
        id={id}
        name={id}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        minLength={minLength}
        maxLength={maxLength}
        disabled={disabled}
        aria-invalid={Boolean(errors?.length)}
        aria-describedby={describedBy || undefined}
        onChange={onChange}
        className="mt-2 min-h-12 w-full rounded-lg border border-white/20 bg-[#071A17]/70 px-4 text-[#FFFDF4] outline-none transition placeholder:text-[#78947D] focus:border-[#42CDA8] focus:ring-2 focus:ring-[#42CDA8]/30 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-[#F2C94C] aria-invalid:ring-2 aria-invalid:ring-[#F2C94C]/20"
      />

      {helpText ? (
        <p
          id={helpId}
          className="mt-2 text-xs leading-5 text-[#9FB5A8]"
        >
          {helpText}
        </p>
      ) : null}

      {errors?.length ? (
        <div id={errorId}>
          {errors.map((error) => (
            <p
              key={error}
              className="mt-2 text-sm font-semibold text-[#F7D96B]"
            >
              {error}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}