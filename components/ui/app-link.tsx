"use client";

import NextLink, {
  type LinkProps,
  useLinkStatus,
} from "next/link";
import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react";

import { RacePreviewLink } from "@/components/game/race-preview-link";
import { RiderPreviewLink } from "@/components/game/rider-preview-link";
import { isRaceRegistrationHref } from "@/lib/game/race-navigation";
import { getRaceQuickPreviewTargetFromHref } from "@/lib/game/race-quick-preview";
import { getRiderIdFromProfileHref } from "@/lib/game/rider-quick-preview";

type AppLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    children?: ReactNode;
  };

/**
 * Drop-in replacement for `next/link`.
 *
 * Route-to-route navigation is handled by the global `ScrollToTop` component.
 * Hash links keep Next.js' native scroll behavior so anchors still work.
 * Pass `scroll` explicitly to override either default on a per-link basis.
 */
const Link = forwardRef<HTMLAnchorElement, AppLinkProps>(function Link(
  { href, scroll, children, ...props },
  ref,
) {
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
      <LinkPendingIndicator />
    </>
  );

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
        data-navigation-mode="document"
      >
        {children}
      </a>
    );
  }

  if (riderId) {
    return (
      <RiderPreviewLink
        ref={ref}
        riderId={riderId}
        href={href}
        scroll={scroll ?? usesAnchor}
        {...props}
      >
        {linkChildren}
      </RiderPreviewLink>
    );
  }

  if (raceTarget) {
    return (
      <RacePreviewLink
        ref={ref}
        previewTarget={raceTarget}
        href={href}
        scroll={scroll ?? usesAnchor}
        {...props}
      >
        {linkChildren}
      </RacePreviewLink>
    );
  }

  return (
    <NextLink
      ref={ref}
      href={href}
      scroll={scroll ?? usesAnchor}
      {...props}
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
