"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

import Link from "@/components/ui/app-link";
import { notifyDirectorMailboxChanged } from "@/lib/game/director-mailbox-sync";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function DirectorMailboxMessageLink({
  href,
  messageToMarkReadId,
  active,
  className,
  children,
}: {
  href: string;
  messageToMarkReadId: string | null;
  active: boolean;
  className: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  return (
    <Link
      href={href}
      prefetch={false}
      aria-current={active ? "true" : undefined}
      aria-busy={isNavigating || undefined}
      className={className}
      onNavigate={(event) => {
        if (!messageToMarkReadId) return;

        event.preventDefault();
        if (isNavigating) return;

        setIsNavigating(true);
        void markCurrentMessageThenNavigate({
          href,
          messageId: messageToMarkReadId,
          router,
        });
      }}
    >
      {children}
    </Link>
  );
}

async function markCurrentMessageThenNavigate({
  href,
  messageId,
  router,
}: {
  href: string;
  messageId: string;
  router: ReturnType<typeof useRouter>;
}) {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.rpc(
    "mark_current_director_message_read",
    { p_message_id: messageId },
  );

  if (!error) notifyDirectorMailboxChanged();
  router.push(href);
}
