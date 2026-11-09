"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { registerAccount } from "../../app/(public)/inscription/actions";
import {
  initialRegistrationState,
  type RegistrationField,
} from "../../app/(public)/inscription/registration-state";
import {
  MARKETING_FIELD_NAMES,
  type MarketingAttribution,
} from "../../lib/marketing/attribution";
import Link from "@/components/ui/app-link";
import { EmailVerificationResendForm } from "./email-verification-resend-form";

const registrationFields: RegistrationField[] = [
  "managerName",
  "email",
  "password",
  "passwordConfirmation",
  "legalAcceptance",
  "referralCode",
];

const REFERRAL_SESSION_STORAGE_KEY =
  "cyclostratege:referral-invitation:v1";

const subscribeToReferralSession = () => () => undefined;

type RegistrationFormProps = {
  referralCode?: string;
  referrerName?: string;
  marketingAttribution?: MarketingAttribution;
  welcomeCoachOfferExpiresAt?: number;
};

export function RegistrationForm({
  referralCode,
  referrerName,
  marketingAttribution = {},
  welcomeCoachOfferExpiresAt,
}: RegistrationFormProps) {
  const [state, formAction, pending] = useActionState(
    registerAccount,
    initialRegistrationState
  );

  const referralSnapshot = useSyncExternalStore(
    subscribeToReferralSession,
    () => readReferralSessionSnapshot(referralCode, referrerName),
    () => serializeReferral(referralCode, referrerName),
  );
  const invitation = parseReferralSnapshot(referralSnapshot);
  const [removedReferralCode, setRemovedReferralCode] = useState("");
  const hasReferral = Boolean(invitation.code && invitation.code !== removedReferralCode);
  const formRef = useRef<HTMLFormElement>(null);
  const [dismissedFields, setDismissedFields] = useState<RegistrationField[]>([]);

  const registrationSucceeded = state.status === "success";
  const [welcomeCoachOfferExpired, setWelcomeCoachOfferExpired] = useState(false);

  useEffect(() => {
    if (welcomeCoachOfferExpiresAt === undefined) return;

    const timeout = window.setTimeout(
      () => setWelcomeCoachOfferExpired(true),
      Math.max(0, welcomeCoachOfferExpiresAt - Date.now()),
    );
    return () => window.clearTimeout(timeout);
  }, [welcomeCoachOfferExpiresAt]);

  useEffect(() => {
    try {
      if (registrationSucceeded || removedReferralCode) {
        window.sessionStorage.removeItem(REFERRAL_SESSION_STORAGE_KEY);
        return;
      }

      if (referralCode && referrerName) {
        window.sessionStorage.setItem(
          REFERRAL_SESSION_STORAGE_KEY,
          serializeReferral(referralCode, referrerName),
        );
      }
    } catch {
      // An invitation remains usable when the browser blocks session storage.
    }
  }, [referralCode, referrerName, registrationSucceeded, removedReferralCode]);

  useEffect(() => {
    const form = formRef.current;
    if (!form || registrationSucceeded) return;

    // React resets action forms even when the returned state asks for a correction.
    // Keep the native field values for a retry. The form is replaced on success.
    function preserveFormValues(event: Event) {
      event.preventDefault();
    }

    form.addEventListener("reset", preserveFormValues);
    return () => form.removeEventListener("reset", preserveFormValues);
  }, [registrationSucceeded]);

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
                  ? "Confirmation par e-mail"
                  : "Inscription impossible"}
              </p>

              <p className="mt-1 text-sm leading-6 text-[#D6DFD2]">
                {state.message}
              </p>
              {registrationSucceeded ? (
                <p className="mt-1 text-sm leading-6 text-[#D6DFD2]">
                  Pensez à vérifier vos courriers indésirables.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <form
        key={registrationSucceeded ? "completed" : "registration"}
        ref={formRef}
        hidden={registrationSucceeded}
        action={formAction}
        autoComplete="on"
        data-form-type="signup"
        onSubmit={() => setDismissedFields([])}
        className="space-y-4"
      >
        {hasReferral ? (
          <div className="flex flex-wrap items-center gap-x-3 text-sm text-[#BFD1C6]">
            <span className="font-semibold">Invitation de {invitation.referrerName}</span>
            <button
              type="button"
              disabled={pending || registrationSucceeded}
              onClick={() => {
                setRemovedReferralCode(invitation.code);
                dismissFieldError("referralCode");
              }}
              className="rounded py-1 underline underline-offset-2 hover:text-[#FFFDF4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2C94C]"
            >
              Retirer le parrainage
            </button>
            <input type="hidden" name="referralCode" value={invitation.code} />
          </div>
        ) : null}

        {MARKETING_FIELD_NAMES.map((field) => (
          <input
            key={field}
            type="hidden"
            name={field}
            value={marketingAttribution[field] ?? ""}
          />
        ))}

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
          placeholder="vous@exemple.fr"
          autoComplete="username"
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

        {!hasReferral ? (
          <details open={Boolean(state.fieldErrors.referralCode?.length) || undefined}>
            <summary className="w-fit cursor-pointer rounded py-2 text-sm font-medium text-[#BFD1C6] hover:text-[#FFFDF4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2C94C]">
              J’ai un code parrain
            </summary>
            <div className="mt-2">
              <FormField
                id="referralCode"
                label="Code de parrainage (facultatif)"
                type="text"
                placeholder="DS-XXXXXXXXXXXX"
                autoComplete="off"
                required={false}
                disabled={pending || registrationSucceeded}
                errors={getVisibleErrors("referralCode")}
                onChange={() => dismissFieldError("referralCode")}
              />
            </div>
          </details>
        ) : null}

        <div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/15 bg-white/[0.04] p-3 text-sm leading-6 text-[#D6DFD2] transition hover:border-[#7CCF9C]/45">
            <input
              type="checkbox"
              name="legalAcceptance"
              value="accepted"
              required
              disabled={pending || registrationSucceeded}
              aria-invalid={Boolean(
                getVisibleErrors("legalAcceptance")?.length,
              )}
              aria-describedby={
                getVisibleErrors("legalAcceptance")?.length
                  ? "legalAcceptance-error"
                  : undefined
              }
              onChange={() => dismissFieldError("legalAcceptance")}
              className="mt-1 h-4 w-4 shrink-0 accent-[#F2C94C]"
            />
            <span>
              J’accepte les{" "}
              <Link
                href="/conditions-utilisation"
                target="_blank"
                className="font-extrabold text-[#F2C94C] underline decoration-[#F2C94C]/45 underline-offset-3 hover:text-[#FFD968]"
              >
                conditions d’utilisation
              </Link>{" "}
              et je reconnais avoir pris connaissance de la{" "}
              <Link
                href="/confidentialite"
                target="_blank"
                className="font-extrabold text-[#F2C94C] underline decoration-[#F2C94C]/45 underline-offset-3 hover:text-[#FFD968]"
              >
                politique de confidentialité
              </Link>
              .
            </span>
          </label>
          {getVisibleErrors("legalAcceptance")?.map((error) => (
            <p
              id="legalAcceptance-error"
              key={error}
              className="mt-2 text-sm font-semibold text-[#F7D96B]"
            >
              {error}
            </p>
          ))}
        </div>

        <label className="flex cursor-pointer items-start gap-3 px-3 text-xs leading-5 text-[#BFD1C6]">
          <input
            type="checkbox"
            name="marketingEmailConsent"
            value="accepted"
            disabled={pending || registrationSucceeded}
            className="mt-1 h-4 w-4 shrink-0 accent-[#F2C94C]"
          />
          <span>
            Je souhaite recevoir les nouveautés par e-mail. Ce choix est facultatif.{" "}
            <Link
              href="/confidentialite"
              target="_blank"
              className="font-extrabold text-[#F2C94C] underline decoration-[#F2C94C]/45 underline-offset-3 hover:text-[#FFD968]"
            >
              En savoir plus
            </Link>
            .
          </span>
        </label>

        {welcomeCoachOfferExpiresAt !== undefined && !welcomeCoachOfferExpired ? (
          <p className="text-center text-xs font-semibold leading-5 text-[#FFE6A0]">
            Un membre du staff offert à la création de votre équipe pour tout nouveau compte créé avant le 14 novembre à 12 h 44, heure de Paris.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending || registrationSucceeded}
          className="min-h-12 w-full rounded-lg bg-[#F2C94C] px-5 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-[#071A17] shadow-lg transition hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFDF4] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B302B] disabled:cursor-not-allowed disabled:bg-[#315B3E] disabled:text-[#9AB0A2] disabled:shadow-none"
        >
          {pending ? "Création en cours..." : "Créer mon compte gratuit"}
        </button>
      </form>

      {registrationSucceeded ? (
        <div className="mt-5">
          <EmailVerificationResendForm
            initialEmail={state.email}
          />
        </div>
      ) : null}

      <p className="mt-4 text-center text-xs leading-5 text-[#9FB5A8]">
        Votre adresse e-mail reste privée. Votre nom de directeur sportif
        et vos contenus publiés dans les espaces communautaires sont visibles
        par les autres membres. Consultez également les{" "}
        <Link
          href="/mentions-legales"
          target="_blank"
          className="font-bold text-[#D6DFD2] underline underline-offset-3 hover:text-white"
        >
          mentions légales
        </Link>
        .
      </p>
    </div>
  );
}

function readReferralSessionSnapshot(
  referralCode?: string,
  referrerName?: string,
): string {
  const invitation = serializeReferral(referralCode, referrerName);
  if (invitation) return invitation;

  try {
    return window.sessionStorage.getItem(REFERRAL_SESSION_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function serializeReferral(
  referralCode?: string,
  referrerName?: string,
): string {
  return referralCode && referrerName
    ? JSON.stringify({ code: referralCode, referrerName })
    : "";
}

function parseReferralSnapshot(value: string): {
  code: string;
  referrerName: string;
} {
  try {
    const invitation = JSON.parse(value) as {
      code?: unknown;
      referrerName?: unknown;
    };
    const code =
      typeof invitation.code === "string"
        ? invitation.code.trim().toUpperCase()
        : "";
    const storedReferrerName =
      typeof invitation.referrerName === "string"
        ? invitation.referrerName.trim()
        : "";

    return /^DS-[A-F0-9]{12}$/.test(code) && storedReferrerName
      ? { code, referrerName: storedReferrerName }
      : { code: "", referrerName: "" };
  } catch {
    return { code: "", referrerName: "" };
  }
}

type FormFieldProps = {
  id: RegistrationField;
  label: string;
  type: "email" | "password" | "text";
  placeholder: string;
  autoComplete: string;
  disabled: boolean;
  required?: boolean;
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
  required = true,
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
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        disabled={disabled}
        autoCapitalize="none"
        spellCheck={false}
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
