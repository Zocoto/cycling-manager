"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { useLocale } from "@/components/i18n/locale-provider";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { PushNotificationControl } from "@/components/pwa/push-notification-control";
import Link from "@/components/ui/app-link";

export function GameUserMenu({ displayName }: { displayName?: string }) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const menuLabel = isEnglish ? "User menu" : "Menu utilisateur";
  const accountLabel = displayName?.trim() || (isEnglish ? "My account" : "Mon compte");

  return (
    <div ref={rootRef} data-game-user-menu="true" className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        title={menuLabel}
        aria-label={open
          ? isEnglish
            ? "Close user menu"
            : "Fermer le menu utilisateur"
          : isEnglish
            ? "Open user menu"
            : "Ouvrir le menu utilisateur"}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className={`relative inline-flex h-8 w-8 items-center justify-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)] sm:h-10 sm:w-10 ${
          open
            ? "border-[var(--game-header-accent)] bg-[var(--game-header-accent)] text-[#071A17]"
            : "border-[#D6DFD2]/25 bg-white/5 text-[#D6DFD2] hover:border-[var(--game-header-accent)] hover:text-[var(--game-header-accent)]"
        }`}
      >
        <UserSilhouetteIcon className="h-5 w-5" />
        <span
          aria-hidden="true"
          className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full border border-[#071A17] bg-[#72D6A2]"
        />
      </button>

      <section
        id={panelId}
        role="dialog"
        aria-label={menuLabel}
        hidden={!open}
        onClickCapture={(event) => {
          if (event.target instanceof Element && event.target.closest("a")) {
            setOpen(false);
          }
        }}
        className="fixed inset-x-3 top-[3.7rem] z-[90] max-h-[calc(100dvh-4.7rem)] overflow-y-auto rounded-2xl border border-[#78947D]/45 bg-[#0B302B] text-[#FFFDF4] shadow-[0_24px_70px_rgba(0,0,0,0.46)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[22rem]"
      >
        <header className="relative overflow-hidden border-b border-white/10 bg-[#071A17] px-4 py-4">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-0.5 bg-[linear-gradient(90deg,var(--game-header-primary),var(--game-header-accent),var(--game-header-secondary))]"
          />
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-[var(--game-header-accent)]">
              <UserSilhouetteIcon className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[9px] font-black uppercase tracking-[0.18em] text-[#9BE0CA]">
                {isEnglish ? "Sports director area" : "Espace Directeur Sportif"}
              </span>
              <span className="mt-1 block truncate text-base font-black">
                {accountLabel}
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              aria-label={isEnglish ? "Close user menu" : "Fermer le menu utilisateur"}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/5 text-lg font-black text-[#D6DFD2] transition hover:border-[var(--game-header-accent)] hover:text-[var(--game-header-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)]"
            >
              ×
            </button>
          </div>
        </header>

        <div className="space-y-2 p-3">
          <UserMenuLink
            href="/jeu/directeur-sportif"
            label={isEnglish ? "Sports director profile" : "Profil du DS"}
            description={
              isEnglish
                ? "Identity, avatar and career progression"
                : "Identité, avatar et progression de carrière"
            }
            icon={<UserSilhouetteIcon className="h-5 w-5" />}
          />

          <UserMenuLink
            href="/jeu/parrainage"
            label={isEnglish ? "Referral programme" : "Parrainage"}
            description={
              isEnglish
                ? "Invite managers and unlock your rewards"
                : "Invitez des DS et débloquez vos récompenses"
            }
            icon={<ReferralIcon />}
          />

          <PushNotificationControl variant="menu" isEnglish={isEnglish} />

          <UserMenuLink
            href="/guide"
            label={isEnglish ? "Game guide" : "Guide du jeu"}
            description={
              isEnglish
                ? "Rules and advice · opens in a new tab"
                : "Règles et conseils · ouverture dans un nouvel onglet"
            }
            icon={<GuideIcon />}
            target="_blank"
          />

          <div
            data-user-menu-language="true"
            className="flex min-h-[4.25rem] items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2.5"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#1B463C] text-[#9BE0CA]">
                <LanguageIcon />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black">
                  {isEnglish ? "Language" : "Langue"}
                </span>
                <span className="mt-0.5 block text-[10px] font-semibold text-[#B9CBC4]">
                  {isEnglish ? "Interface language" : "Langue de l’interface"}
                </span>
              </span>
            </span>
            <LanguageSwitcher compact />
          </div>
        </div>
      </section>
    </div>
  );
}

function UserMenuLink({
  href,
  label,
  description,
  icon,
  target,
}: {
  href: string;
  label: string;
  description: string;
  icon: ReactNode;
  target?: "_blank";
}) {
  return (
    <Link
      href={href}
      target={target}
      rel={target === "_blank" ? "noopener noreferrer" : undefined}
      prefetchOnIntent={target !== "_blank"}
      showPendingIndicator={false}
      className="group flex min-h-[4.25rem] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2.5 transition hover:border-[var(--game-header-accent)]/45 hover:bg-white/[0.075] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)]"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#1B463C] text-[#9BE0CA] transition group-hover:bg-[var(--game-header-accent)] group-hover:text-[#071A17]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black">{label}</span>
        <span className="mt-0.5 block text-[10px] font-semibold leading-4 text-[#B9CBC4]">
          {description}
        </span>
      </span>
      <span aria-hidden="true" className="text-base text-[#78947D] transition group-hover:text-[var(--game-header-accent)]">
        {target === "_blank" ? "↗" : "›"}
      </span>
    </Link>
  );
}

function UserSilhouetteIcon({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="10" cy="6.5" r="3" />
      <path d="M4.5 16c.5-3.3 2.3-5 5.5-5s5 1.7 5.5 5" />
    </svg>
  );
}

function GuideIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 3.5h8.5A2.5 2.5 0 0 1 15 6v10H6.5A2.5 2.5 0 0 1 4 13.5v-10Z" />
      <path d="M4 13.5A2.5 2.5 0 0 1 6.5 11H15M8 6.5h3.5" />
    </svg>
  );
}

function ReferralIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="6.5" cy="7" r="2.5" />
      <circle cx="14" cy="8" r="2" />
      <path d="M2 16c.4-3 2-4.5 4.5-4.5S10.6 13 11 16M11.5 12.5c2.8-.5 4.8.8 5.5 3.5" />
      <path d="m14.5 2 .7 1.3 1.5.2-1.1 1 .3 1.5-1.4-.7-1.3.7.2-1.5-1-1 1.5-.2Z" />
    </svg>
  );
}

function LanguageIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="10" cy="10" r="7" />
      <path d="M3.5 10h13M10 3c2 2 3 4.3 3 7s-1 5-3 7c-2-2-3-4.3-3-7s1-5 3-7Z" />
    </svg>
  );
}
