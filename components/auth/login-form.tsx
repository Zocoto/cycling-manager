"use client";

import { useActionState, useState } from "react";

import { loginAccount } from "../../app/(public)/connexion/actions";
import {
  initialLoginState,
  type LoginField,
} from "../../app/(public)/connexion/login-state";

const loginFields: LoginField[] = ["email", "password"];

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    loginAccount,
    initialLoginState
  );

  const [dismissedFields, setDismissedFields] = useState<
    LoginField[]
  >([]);

  const hasFieldErrors = loginFields.some((field) =>
    Boolean(state.fieldErrors[field]?.length)
  );

  const hasVisibleFieldErrors = loginFields.some(
    (field) =>
      Boolean(state.fieldErrors[field]?.length) &&
      !dismissedFields.includes(field)
  );

  const shouldShowStateMessage =
    Boolean(state.message) &&
    !pending &&
    (!hasFieldErrors || hasVisibleFieldErrors);

  function dismissFieldError(field: LoginField) {
    setDismissedFields((currentFields) => [
      ...new Set([...currentFields, field]),
    ]);
  }

  function getVisibleErrors(
    field: LoginField
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
                Connexion impossible
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
          id="email"
          label="Adresse e-mail"
          type="email"
          placeholder="directeur@cyclostratege.fr"
          autoComplete="email"
          disabled={pending}
          errors={getVisibleErrors("email")}
          onChange={() => dismissFieldError("email")}
        />

        <FormField
          id="password"
          label="Mot de passe"
          type="password"
          placeholder="Votre mot de passe"
          autoComplete="current-password"
          disabled={pending}
          errors={getVisibleErrors("password")}
          onChange={() => dismissFieldError("password")}
        />

        <button
          type="submit"
          disabled={pending}
          className="min-h-12 w-full rounded-lg bg-[#F2C94C] px-5 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-[#071A17] shadow-lg transition hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFDF4] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B302B] disabled:cursor-not-allowed disabled:bg-[#315B3E] disabled:text-[#9AB0A2] disabled:shadow-none"
        >
          {pending ? "Connexion en cours..." : "Me connecter"}
        </button>
      </form>
    </div>
  );
}

type FormFieldProps = {
  id: LoginField;
  label: string;
  type: "email" | "password";
  placeholder: string;
  autoComplete: string;
  disabled: boolean;
  errors?: string[];
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
  onChange,
}: FormFieldProps) {
  const errorId = `${id}-error`;

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
        disabled={disabled}
        aria-invalid={Boolean(errors?.length)}
        aria-describedby={
          errors?.length ? errorId : undefined
        }
        onChange={onChange}
        className="mt-2 min-h-12 w-full rounded-lg border border-white/20 bg-[#071A17]/70 px-4 text-[#FFFDF4] outline-none transition placeholder:text-[#78947D] focus:border-[#42CDA8] focus:ring-2 focus:ring-[#42CDA8]/30 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-[#F2C94C] aria-invalid:ring-2 aria-invalid:ring-[#F2C94C]/20"
      />

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