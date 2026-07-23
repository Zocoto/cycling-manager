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

  return (
    <NextLink
      ref={ref}
      href={href}
      scroll={scroll ?? usesAnchor}
      {...props}
    >
      {children}
      <LinkPendingIndicator />
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
