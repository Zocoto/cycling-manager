"use client";

import { useActionState, useState } from "react";

import { updatePassword } from "../../app/(public)/reinitialiser-mot-de-passe/actions";
import {
  initialPasswordUpdateState,
  type PasswordUpdateField,
} from "../../app/(public)/reinitialiser-mot-de-passe/password-update-state";

const passwordFields: PasswordUpdateField[] = [
  "password",
  "passwordConfirmation",
];

export function PasswordUpdateForm() {
  const [state, formAction, pending] = useActionState(
    updatePassword,
    initialPasswordUpdateState
  );

  const [dismissedFields, setDismissedFields] = useState<
    PasswordUpdateField[]
  >([]);

  const hasFieldErrors = passwordFields.some((field) =>
    Boolean(state.fieldErrors[field]?.length)
  );

  const hasVisibleFieldErrors = passwordFields.some(
    (field) =>
      Boolean(state.fieldErrors[field]?.length) &&
      !dismissedFields.includes(field)
  );

  const shouldShowStateMessage =
    Boolean(state.message) &&
    !pending &&
    (!hasFieldErrors || hasVisibleFieldErrors);

  function dismissPasswordErrors() {
    setDismissedFields([
      "password",
      "passwordConfirmation",
    ]);
  }

  function getVisibleErrors(
    field: PasswordUpdateField
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
          role="alert"
          aria-live="polite"
          className="mb-6 rounded-xl border border-[#F2C94C]/45 bg-[#F2C94C]/10 px-4 py-4"
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F2C94C] font-black text-[#071A17]"
            >
              !
            </span>

            <div>
              <p className="text-sm font-bold text-[#F2C94C]">
                Modification impossible
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
        <PasswordField
          id="password"
          label="Nouveau mot de passe"
          placeholder="12 caractères minimum"
          autoComplete="new-password"
          disabled={pending}
          errors={getVisibleErrors("password")}
          helpText="Utilisez au moins 12 caractères difficiles à deviner."
          onChange={dismissPasswordErrors}
        />

        <PasswordField
          id="passwordConfirmation"
          label="Confirmation du nouveau mot de passe"
          placeholder="Saisissez à nouveau le mot de passe"
          autoComplete="new-password"
          disabled={pending}
          errors={getVisibleErrors("passwordConfirmation")}
          onChange={dismissPasswordErrors}
        />

        <button
          type="submit"
          disabled={pending}
          className="min-h-12 w-full rounded-lg bg-[#F2C94C] px-5 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-[#071A17] shadow-lg transition hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFDF4] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B302B] disabled:cursor-not-allowed disabled:bg-[#315B3E] disabled:text-[#9AB0A2] disabled:shadow-none"
        >
          {pending
            ? "Modification en cours..."
            : "Enregistrer le mot de passe"}
        </button>
      </form>
    </div>
  );
}

type PasswordFieldProps = {
  id: PasswordUpdateField;
  label: string;
  placeholder: string;
  autoComplete: string;
  disabled: boolean;
  errors?: string[];
  helpText?: string;
  onChange: () => void;
};

function PasswordField({
  id,
  label,
  placeholder,
  autoComplete,
  disabled,
  errors,
  helpText,
  onChange,
}: PasswordFieldProps) {
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
        type="password"
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        minLength={12}
        maxLength={72}
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