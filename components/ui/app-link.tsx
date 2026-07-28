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
  const hrefPathname =
    typeof href === "string"
      ? href
      : typeof href.pathname === "string"
        ? href.pathname
        : "";
  const riderId = getRiderIdFromProfileHref(hrefPathname);
  const raceTarget = getRaceQuickPreviewTargetFromHref(hrefPathname);
  const linkChildren = (
    <>
      {children}
      <LinkPendingIndicator />
    </>
  );

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
