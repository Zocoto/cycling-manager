"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";

import { updateSportingDirectorProfile } from "../../app/jeu/directeur-sportif/actions";
import {
  initialSportingDirectorProfileState,
  type SportingDirectorProfileField,
} from "../../app/jeu/directeur-sportif/profile-state";
import {
  CountrySelect,
  type CountryOption,
} from "./country-select";
import { SportingDirectorAvatar } from "./sporting-director-avatar";
import { SportingDirectorAvatarEditor } from "./sporting-director-avatar-editor";

type SportingDirectorProfileFormProps = {
  countries: CountryOption[];
  initialDisplayName: string;
  initialCountryId: string | null;
  initialAvatarKey: string | null;
  initialIsEmailVisible: boolean;
};

const profileFields: SportingDirectorProfileField[] = [
  "displayName",
  "avatarKey",
  "countryId",
  "hideEmail",
];

export function SportingDirectorProfileForm({
  countries,
  initialDisplayName,
  initialCountryId,
  initialAvatarKey,
  initialIsEmailVisible,
}: SportingDirectorProfileFormProps) {
  const [state, formAction, pending] = useActionState(
    updateSportingDirectorProfile,
    initialSportingDirectorProfileState
  );

  const [selectedAvatarKey, setSelectedAvatarKey] =
    useState(initialAvatarKey ?? "");

  const [isAvatarModalOpen, setIsAvatarModalOpen] =
    useState(false);

  const [selectedCountryId, setSelectedCountryId] =
    useState(initialCountryId ?? "");

  const [dismissedFields, setDismissedFields] = useState<
    SportingDirectorProfileField[]
  >([]);

  const avatarModalCloseButtonRef =
    useRef<HTMLButtonElement>(null);

  const avatarModalTriggerRef =
    useRef<HTMLButtonElement>(null);

  const isCountryLocked = Boolean(initialCountryId);

  const hasSelectedAvatar = Boolean(selectedAvatarKey);

  const hasFieldErrors = profileFields.some((field) =>
    Boolean(state.fieldErrors[field]?.length)
  );

  const hasVisibleFieldErrors = profileFields.some(
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

  useEffect(() => {
    if (!isAvatarModalOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    const triggerButton =
      avatarModalTriggerRef.current;

    document.body.style.overflow = "hidden";

    avatarModalCloseButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsAvatarModalOpen(false);
      }
    }

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.body.style.overflow = previousOverflow;

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );

      triggerButton?.focus();
    };
  }, [isAvatarModalOpen]);

  function dismissFieldError(
    field: SportingDirectorProfileField
  ) {
    setDismissedFields((currentFields) => [
      ...new Set([...currentFields, field]),
    ]);
  }

  function getVisibleErrors(
    field: SportingDirectorProfileField
  ): string[] | undefined {
    if (pending || dismissedFields.includes(field)) {
      return undefined;
    }

    return state.fieldErrors[field];
  }

  function selectAvatar(avatarKey: string) {
    setSelectedAvatarKey(avatarKey);
    setIsAvatarModalOpen(false);
    dismissFieldError("avatarKey");
  }

  const displayNameErrors =
    getVisibleErrors("displayName");

  const avatarErrors =
    getVisibleErrors("avatarKey");

  const countryErrors =
    getVisibleErrors("countryId");

  const hideEmailErrors =
    getVisibleErrors("hideEmail");

  return (
    <div data-tutorial-id="profile-form">
      {shouldShowStateMessage ? (
        <div
          role={
            state.status === "error"
              ? "alert"
              : "status"
          }
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
                    ? "text-sm font-bold text-[#176951]"
                    : "text-sm font-bold text-[#80640C]"
                }
              >
                {state.status === "success"
                  ? "Profil enregistré"
                  : "Enregistrement impossible"}
              </p>

              <p className="mt-1 text-sm leading-6 text-[#36554E]">
                {state.message}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <form
        action={formAction}
        onSubmit={() => setDismissedFields([])}
        className="space-y-7"
      >
        <div>
          <label
            htmlFor="displayName"
            className="block text-sm font-bold text-[#183F37]"
          >
            Nom affiché du Directeur Sportif
          </label>

          <input
            id="displayName"
            name="displayName"
            type="text"
            defaultValue={initialDisplayName}
            autoComplete="nickname"
            required
            minLength={3}
            maxLength={30}
            disabled={pending}
            aria-invalid={Boolean(
              displayNameErrors?.length
            )}
            aria-describedby={
              displayNameErrors?.length
                ? "displayName-error"
                : "displayName-help"
            }
            onChange={() =>
              dismissFieldError("displayName")
            }
            className="mt-2 min-h-12 w-full rounded-lg border border-[#315B3E]/25 bg-white px-4 text-[#082A2A] outline-none transition placeholder:text-[#789087] focus:border-[#42B99A] focus:ring-2 focus:ring-[#42B99A]/25 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-[#D5B13E] aria-invalid:ring-2 aria-invalid:ring-[#D5B13E]/20"
          />

          <p
            id="displayName-help"
            className="mt-2 text-xs leading-5 text-[#60756E]"
          >
            Ce nom sera visible dans l’univers de
            Cyclostratège. Votre identifiant public reste
            inchangé.
          </p>

          {displayNameErrors?.length ? (
            <div id="displayName-error">
              {displayNameErrors.map((error) => (
                <p
                  key={error}
                  className="mt-2 text-sm font-semibold text-[#80640C]"
                >
                  {error}
                </p>
              ))}
            </div>
          ) : null}
        </div>

        <fieldset>
          <legend className="text-sm font-bold text-[#183F37]">
            Avatar du Directeur Sportif
          </legend>

          <p
            id="avatarKey-help"
            className="mt-2 text-xs leading-5 text-[#60756E]"
          >
            Composez le portrait qui vous représentera dans
            votre bureau : carnation, traits du visage, regard,
            coiffure et accessoires. Vous pourrez le modifier à
            tout moment.
          </p>

          <div
            className={[
              "mt-4 flex flex-col gap-5 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between",
              avatarErrors?.length
                ? "border-[#D5B13E] bg-[#FFF9DE]"
                : "border-[#315B3E]/15 bg-[#F8FBF9]",
            ].join(" ")}
          >
            <div className="flex items-center gap-4">
              {hasSelectedAvatar ? (
                <SportingDirectorAvatar
                  avatarKey={selectedAvatarKey}
                  size="large"
                  label="Avatar actuellement sélectionné"
                />
              ) : (
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-2 border-white bg-[#D7EEE8] text-[#278B70] shadow-md">
                  <AvatarPlaceholderIcon />
                </div>
              )}

              <div>
                <p className="font-extrabold text-[#183F37]">
                  {hasSelectedAvatar
                    ? "Avatar sélectionné"
                    : "Aucun avatar sélectionné"}
                </p>

                <p className="mt-1 max-w-md text-xs leading-5 text-[#60756E]">
                  Ce portrait apparaîtra dans votre bureau, sur
                  votre carte et dans les classements publics.
                </p>
              </div>
            </div>

            <button
              ref={avatarModalTriggerRef}
              type="button"
              disabled={pending}
              aria-haspopup="dialog"
              aria-expanded={isAvatarModalOpen}
              aria-describedby={
                avatarErrors?.length
                  ? "avatarKey-error"
                  : "avatarKey-help"
              }
              onClick={() =>
                setIsAvatarModalOpen(true)
              }
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#278B70]/30 bg-white px-4 py-2 text-sm font-extrabold text-[#176951] transition hover:border-[#278B70] hover:bg-[#DFF4EC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <AvatarChangeIcon />

              {hasSelectedAvatar
                ? "Modifier l’avatar"
                : "Créer mon avatar"}
            </button>
          </div>

          <input
            type="hidden"
            name="avatarKey"
            value={selectedAvatarKey}
          />

          {avatarErrors?.length ? (
            <div id="avatarKey-error">
              {avatarErrors.map((error) => (
                <p
                  key={error}
                  className="mt-2 text-sm font-semibold text-[#80640C]"
                >
                  {error}
                </p>
              ))}
            </div>
          ) : null}
        </fieldset>

        <div data-tutorial-id="profile-nationality">
          <label
            htmlFor="countryId"
            className="block text-sm font-bold text-[#183F37]"
          >
            Nationalité
          </label>

          <div className="mt-2">
            <CountrySelect
              id="countryId"
              countries={countries}
              value={selectedCountryId}
              onChange={(countryId) => {
                setSelectedCountryId(countryId);
                dismissFieldError("countryId");
              }}
              placeholder="Sélectionnez votre nationalité"
              listAriaLabel="Liste des nationalités"
              describedBy={
                countryErrors?.length
                  ? "countryId-error"
                  : "countryId-help"
              }
              disabled={pending}
              invalid={Boolean(countryErrors?.length)}
              locked={isCountryLocked}
            />
          </div>

          <input
            type="hidden"
            name="countryId"
            value={
              isCountryLocked && initialCountryId
                ? initialCountryId
                : selectedCountryId
            }
          />

          <p
            id="countryId-help"
            className="mt-2 text-xs leading-5 text-[#60756E]"
          >
            Cette nationalité représente uniquement votre
            Directeur Sportif. Le pays de l’équipe et de vos 7
            premiers coureurs sera choisi à l’étape suivante.
            Après validation, elle ne pourra plus être modifiée.
          </p>

          {countryErrors?.length ? (
            <div id="countryId-error">
              {countryErrors.map((error) => (
                <p
                  key={error}
                  className="mt-2 text-sm font-semibold text-[#80640C]"
                >
                  {error}
                </p>
              ))}
            </div>
          ) : null}
        </div>

        {!isCountryLocked ? (
          <div className="rounded-xl border border-[#D5B13E]/35 bg-[#FFF9DE] px-4 py-4">
            <p className="text-sm font-bold text-[#493B0B]">
              Choix définitif
            </p>

            <p className="mt-1 text-sm leading-6 text-[#705E23]">
              Vérifiez bien votre nationalité avant de
              l’enregistrer. Elle restera l’identité personnelle
              définitive de votre Directeur Sportif.
            </p>
          </div>
        ) : null}

        <div className="rounded-xl border border-[#315B3E]/15 bg-[#F5F9F7] p-4 sm:p-5">
          <label className="flex cursor-pointer items-start gap-4">
            <input
              type="checkbox"
              name="hideEmail"
              value="true"
              defaultChecked={!initialIsEmailVisible}
              disabled={pending}
              aria-invalid={Boolean(
                hideEmailErrors?.length
              )}
              aria-describedby={
                hideEmailErrors?.length
                  ? "hideEmail-error"
                  : "hideEmail-help"
              }
              onChange={() =>
                dismissFieldError("hideEmail")
              }
              className="mt-1 h-5 w-5 shrink-0 cursor-pointer rounded border-[#315B3E]/30 accent-[#278B70] disabled:cursor-not-allowed"
            />

            <span>
              <span className="block text-sm font-bold text-[#183F37]">
                Cacher mon adresse e-mail
              </span>

              <span
                id="hideEmail-help"
                className="mt-1 block text-xs leading-5 text-[#60756E]"
              >
                Votre adresse restera utilisée pour votre
                connexion, mais elle ne sera pas affichée sur
                votre profil public.
              </span>
            </span>
          </label>

          {hideEmailErrors?.length ? (
            <div id="hideEmail-error">
              {hideEmailErrors.map((error) => (
                <p
                  key={error}
                  className="mt-3 text-sm font-semibold text-[#80640C]"
                >
                  {error}
                </p>
              ))}
            </div>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={
            pending ||
            !selectedAvatarKey ||
            (!isCountryLocked && !selectedCountryId)
          }
          className="min-h-12 w-full rounded-lg bg-[#F2C94C] px-5 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-[#071A17] shadow-lg transition hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#B8C5BE] disabled:text-[#60756E] disabled:shadow-none"
        >
          {pending
            ? "Enregistrement..."
            : isCountryLocked
              ? "Enregistrer les modifications"
              : "Valider mon profil"}
        </button>
      </form>

      {isAvatarModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#071A17]/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsAvatarModalOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="avatar-modal-title"
            aria-describedby="avatar-modal-description"
            className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-white/15 bg-[#F8FBF9] shadow-[0_30px_100px_rgba(7,26,23,0.45)]"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-5 border-b border-[#315B3E]/10 bg-[#F8FBF9] px-5 py-5 sm:px-7">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#278B70]">
                  Directeur Sportif
                </p>

                <h2
                  id="avatar-modal-title"
                  className="mt-2 text-2xl font-black text-[#082A2A]"
                >
                  Créer votre avatar
                </h2>

                <p
                  id="avatar-modal-description"
                  className="mt-2 text-sm leading-6 text-[#60756E]"
                >
                  Composez un portrait unique en ajustant
                  chaque détail de votre Directeur Sportif.
                </p>
              </div>

              <button
                ref={avatarModalCloseButtonRef}
                type="button"
                aria-label="Fermer l’éditeur d’avatar"
                onClick={() =>
                  setIsAvatarModalOpen(false)
                }
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#315B3E]/15 bg-white text-[#48665F] transition hover:border-[#278B70] hover:bg-[#DFF4EC] hover:text-[#176951] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
              >
                <CloseIcon />
              </button>
            </div>

            <SportingDirectorAvatarEditor
              avatarKey={selectedAvatarKey || null}
              onCancel={() => setIsAvatarModalOpen(false)}
              onConfirm={selectAvatar}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AvatarPlaceholderIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-10 w-10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21c.6-5 3.1-7.5 7.5-7.5s6.9 2.5 7.5 7.5" />
    </svg>
  );
}

function AvatarChangeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3.5 19c.5-4.1 2.3-6.2 5.5-6.2 1.2 0 2.2.3 3 .8" />
      <path d="M15 16h6" />
      <path d="M18 13v6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="m5 5 10 10" />
      <path d="m15 5-10 10" />
    </svg>
  );
}
