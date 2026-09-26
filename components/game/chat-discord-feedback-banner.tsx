import { appConfig } from "@/lib/app-config";

export function ChatDiscordFeedbackBanner({
  isEnglish = false,
}: {
  isEnglish?: boolean;
}) {
  return (
    <aside
      data-chat-discord-banner="true"
      className="shrink-0 border-b border-[#5865F2]/15 bg-[#F4F5FF] px-3 py-1.5 sm:px-6 sm:py-2"
    >
      <div className="flex items-center gap-2 text-[10px] text-[#33413D] sm:flex-wrap sm:gap-x-3 sm:gap-y-1 sm:text-[11px]">
        <span className="shrink-0 rounded-full bg-[#5865F2] px-2 py-0.5 font-black text-white sm:px-2.5 sm:py-1">
          Discord
        </span>
        <p className="hidden min-w-0 flex-1 font-semibold leading-5 sm:block">
          {isEnglish
            ? "To report a bug or suggest an improvement, join the official Cyclo Stratège Discord."
            : "Pour signaler un bug ou proposer une amélioration, rejoignez le Discord officiel Cyclo Stratège."}
        </p>
        <p className="min-w-0 flex-1 truncate font-bold text-[#4652C7] sm:hidden">
          {isEnglish ? "Feedback and bug reports" : "Retours et signalements"}
        </p>
        <a
          href={appConfig.discordUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="shrink-0 rounded-full bg-white px-2 py-1 font-black text-[#4652C7] shadow-sm transition hover:text-[#2935A8] sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none sm:underline sm:decoration-[#4652C7]/35 sm:underline-offset-4"
        >
          <span className="sm:hidden" aria-hidden="true">
            ↗
          </span>
          <span className="sr-only sm:not-sr-only">
            {isEnglish ? "Join the server" : "Accéder au serveur"}
            <span aria-hidden="true"> →</span>
          </span>
        </a>
      </div>
    </aside>
  );
}
