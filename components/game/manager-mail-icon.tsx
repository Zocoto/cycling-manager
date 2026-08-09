import Link from "@/components/ui/app-link";

export function ManagerMailIcon({
  unreadCount = 0,
  compact = false,
}: {
  unreadCount?: number;
  compact?: boolean;
}) {
  const hasUnread = unreadCount > 0;

  return (
    <Link
      href="/jeu/boite-mail"
      title={hasUnread ? `${unreadCount} nouveau${unreadCount > 1 ? "x" : ""} message${unreadCount > 1 ? "s" : ""}` : "Ouvrir la boîte mail"}
      aria-label={hasUnread ? `${unreadCount} message${unreadCount > 1 ? "s" : ""} non lu${unreadCount > 1 ? "s" : ""} : ouvrir la boîte mail` : "Ouvrir la boîte mail"}
      className={`group relative inline-flex ${compact ? "h-10 w-10" : "min-w-24 flex-1 sm:min-w-64"} items-center justify-center rounded-2xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C] ${hasUnread ? "border-[#F2C94C] bg-[#FFF8DD] text-[#725611] shadow-[0_0_0_4px_rgba(242,201,76,0.18)]" : "border-[#315B3E]/15 bg-white/75 text-[#176951] hover:border-[#278B70]/35"}`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>
      {!compact ? <span className="ml-2 text-xs font-black sm:text-sm">Messagerie</span> : null}
      {hasUnread ? <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-[#D94F4F] px-1 text-[10px] font-black text-white ring-2 ring-white">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
    </Link>
  );
}
