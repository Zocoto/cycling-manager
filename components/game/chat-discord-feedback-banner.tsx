import { appConfig } from "@/lib/app-config";

export function ChatDiscordFeedbackBanner({
  isEnglish = false,
}: {
  isEnglish?: boolean;
}) {
  return (
    <aside className="shrink-0 border-b border-[#5865F2]/15 bg-[#F4F5FF] px-4 py-2 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#33413D]">
        <span className="rounded-full bg-[#5865F2] px-2.5 py-1 font-black text-white">
          Discord officiel
        </span>
        <p className="min-w-0 flex-1 font-semibold leading-5">
          {isEnglish
            ? "To report a bug or suggest an improvement, join the official Cyclo Stratège Discord."
            : "Pour signaler un bug ou proposer une amélioration, rejoignez le Discord officiel Cyclo Stratège."}
        </p>
        <a
          href={appConfig.discordUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="shrink-0 font-black text-[#4652C7] underline decoration-[#4652C7]/35 underline-offset-4 transition hover:text-[#2935A8]"
        >
          {isEnglish ? "Join the server" : "Accéder au serveur"} →
        </a>
      </div>
    </aside>
  );
}
