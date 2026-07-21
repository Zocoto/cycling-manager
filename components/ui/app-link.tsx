import NextLink, { type LinkProps } from "next/link";
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
 * Defaults `scroll` to `false` so navigating between pages keeps the current
 * scroll position instead of jumping back to the top. Pass `scroll` explicitly
 * to override on a per-link basis.
 */
const Link = forwardRef<HTMLAnchorElement, AppLinkProps>(function Link(
  { scroll = false, ...props },
  ref,
) {
  return <NextLink ref={ref} scroll={scroll} {...props} />;
});

export default Link;
