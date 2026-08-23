"use client";

import NextLink, {
  type LinkProps,
  useLinkStatus,
} from "next/link";
import {
  forwardRef,
  type AnchorHTMLAttributes,
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  loadRacePreviewLink,
  loadRiderPreviewLink,
  type RacePreviewLinkComponent,
  type RiderPreviewLinkComponent,
} from "@/components/ui/lazy-preview-links";
import { isRaceRegistrationHref } from "@/lib/game/race-navigation";
import { getRaceQuickPreviewTargetFromHref } from "@/lib/game/race-quick-preview";
import { getRiderIdFromProfileHref } from "@/lib/game/rider-quick-preview";

type AppLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    children?: ReactNode;
    showPendingIndicator?: boolean;
    prefetchOnIntent?: boolean;
  };

const PREVIEW_INTENT_DELAY_MS = 220;

/**
 * Drop-in replacement for `next/link`.
 *
 * Route-to-route navigation is handled by the global `ScrollToTop` component.
 * Hash links keep Next.js' native scroll behavior so anchors still work.
 * Pass `scroll` explicitly to override either default on a per-link basis.
 */
const Link = forwardRef<HTMLAnchorElement, AppLinkProps>(function Link(
  {
    href,
    scroll,
    prefetch,
    children,
    showPendingIndicator = true,
    prefetchOnIntent = false,
    onBlur,
    onFocus,
    onPointerDown,
    onPointerEnter,
    onPointerLeave,
    ...props
  },
  ref,
) {
  const [previewIntentOpen, setPreviewIntentOpen] = useState(false);
  const [intentPrefetchActive, setIntentPrefetchActive] = useState(false);
  const previewIntentTimerRef = useRef<number | null>(
    null,
  );
  const [RiderPreviewLink, setRiderPreviewLink] =
    useState<RiderPreviewLinkComponent | null>(null);
  const [RacePreviewLink, setRacePreviewLink] =
    useState<RacePreviewLinkComponent | null>(null);
  const resolvedPrefetch =
    prefetch !== undefined
      ? prefetch
      : prefetchOnIntent && intentPrefetchActive
        ? null
        : false;
  const usesAnchor =
    typeof href === "string"
      ? href.includes("#")
      : typeof href.hash === "string" && href.hash.length > 0;
  const hrefForIntent =
    typeof href === "string"
      ? href
      : typeof href.pathname === "string"
        ? `${href.pathname}${normalizeHash(href.hash)}`
        : "";
  const riderId = getRiderIdFromProfileHref(hrefForIntent);
  const raceTarget = getRaceQuickPreviewTargetFromHref(hrefForIntent);
  const requiresDocumentNavigation =
    typeof href === "string" && isRaceRegistrationHref(href);
  const linkChildren = (
    <>
      {children}
      {showPendingIndicator ? <LinkPendingIndicator /> : null}
    </>
  );

  useEffect(() => {
    return () => {
      if (previewIntentTimerRef.current !== null) {
        window.clearTimeout(previewIntentTimerRef.current);
      }
    };
  }, []);

  function clearPreviewIntentTimer() {
    if (previewIntentTimerRef.current === null) return;

    window.clearTimeout(previewIntentTimerRef.current);
    previewIntentTimerRef.current = null;
  }

  function loadPreview() {
    if (!riderId && !raceTarget) return;

    setPreviewIntentOpen(true);

    if (riderId && !RiderPreviewLink) {
      void loadRiderPreviewLink().then(setRiderPreviewLink);
    } else if (raceTarget && !RacePreviewLink) {
      void loadRacePreviewLink().then(setRacePreviewLink);
    }
  }

  function schedulePreview() {
    clearPreviewIntentTimer();
    if (!riderId && !raceTarget) return;

    previewIntentTimerRef.current = window.setTimeout(() => {
      previewIntentTimerRef.current = null;
      loadPreview();
    }, PREVIEW_INTENT_DELAY_MS);
  }

  function handlePointerEnter(event: PointerEvent<HTMLAnchorElement>) {
    onPointerEnter?.(event);
    if (event.defaultPrevented) return;
    if (event.pointerType === "mouse") {
      if (prefetchOnIntent) setIntentPrefetchActive(true);
      schedulePreview();
    }
  }

  function handlePointerLeave(event: PointerEvent<HTMLAnchorElement>) {
    onPointerLeave?.(event);
    clearPreviewIntentTimer();
    setPreviewIntentOpen(false);
  }

  function handleFocus(event: FocusEvent<HTMLAnchorElement>) {
    onFocus?.(event);
    if (event.defaultPrevented) return;
    if (prefetchOnIntent) setIntentPrefetchActive(true);
    clearPreviewIntentTimer();
    loadPreview();
  }

  function handleBlur(event: FocusEvent<HTMLAnchorElement>) {
    onBlur?.(event);
    clearPreviewIntentTimer();
    setPreviewIntentOpen(false);
  }

  function handlePointerDown(event: PointerEvent<HTMLAnchorElement>) {
    onPointerDown?.(event);
    if (!event.defaultPrevented && prefetchOnIntent) {
      setIntentPrefetchActive(true);
    }
    clearPreviewIntentTimer();
  }

  const intentHandlers = {
    onBlur: handleBlur,
    onFocus: handleFocus,
    onPointerDown: handlePointerDown,
    onPointerEnter: handlePointerEnter,
    onPointerLeave: handlePointerLeave,
  };

  if (requiresDocumentNavigation) {
    /*
     * Registration is a critical action. A native document navigation keeps
     * it on the canonical course route and outside Next.js' client route tree.
     * Do not replace this with next/link: intercepted/parallel calendar routes
     * have caused fatal soft-navigation regressions on desktop and mobile.
     */
    return (
      <a
        ref={ref}
        href={href}
        {...toNativeAnchorProps(props)}
        onBlur={onBlur}
        onFocus={onFocus}
        onPointerDown={onPointerDown}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        data-navigation-mode="document"
      >
        {children}
      </a>
    );
  }

  if (riderId && RiderPreviewLink) {
    return (
      <RiderPreviewLink
        ref={ref}
        riderId={riderId}
        autoOpen={previewIntentOpen}
        href={href}
        prefetch={resolvedPrefetch}
        scroll={scroll ?? usesAnchor}
        {...props}
        {...intentHandlers}
      >
        {linkChildren}
      </RiderPreviewLink>
    );
  }

  if (raceTarget && RacePreviewLink) {
    return (
      <RacePreviewLink
        ref={ref}
        previewTarget={raceTarget}
        autoOpen={previewIntentOpen}
        href={href}
        prefetch={resolvedPrefetch}
        scroll={scroll ?? usesAnchor}
        {...props}
        {...intentHandlers}
      >
        {linkChildren}
      </RacePreviewLink>
    );
  }

  return (
    <NextLink
      ref={ref}
      href={href}
      prefetch={resolvedPrefetch}
      scroll={scroll ?? usesAnchor}
      {...props}
      {...intentHandlers}
    >
      {linkChildren}
    </NextLink>
  );
});

export default Link;

function LinkPendingIndicator() {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden="true"
      className={`app-link-pending-indicator ${pending ? "is-pending" : ""}`}
    />
  );
}

function normalizeHash(hash: unknown) {
  if (typeof hash !== "string" || hash.length === 0) return "";
  return hash.startsWith("#") ? hash : `#${hash}`;
}

const NEXT_LINK_ONLY_PROPS = [
  "as",
  "replace",
  "shallow",
  "passHref",
  "prefetch",
  "locale",
  "legacyBehavior",
  "onNavigate",
  "transitionTypes",
] as const;

function toNativeAnchorProps(
  props: Omit<AppLinkProps, "href" | "children" | "scroll">,
) {
  const anchorProps = { ...props } as Record<string, unknown>;

  for (const prop of NEXT_LINK_ONLY_PROPS) {
    delete anchorProps[prop];
  }

  return anchorProps as AnchorHTMLAttributes<HTMLAnchorElement>;
}
