"use client";
import { CHAT_TRANSLATION_LANGUAGES, type ChatTranslationTargetLocale } from "@/lib/game/chat-translation";

export function ChatTranslationSettings({ automatic, targetLocale, paused, isEnglish, setAutomatic, setTargetLocale }: {
  automatic: boolean; targetLocale: ChatTranslationTargetLocale; paused: boolean; isEnglish: boolean;
  setAutomatic: (value: boolean) => void; setTargetLocale: (value: ChatTranslationTargetLocale) => void;
}) {
  return <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-[#60756E]" data-chat-translation-settings="true">
    <label className="flex cursor-pointer items-center gap-1.5">
      <input type="checkbox" checked={automatic} onChange={(event) => setAutomatic(event.target.checked)} className="accent-[#176951]" />
      {isEnglish ? "Auto-translate" : "Traduction auto"}
    </label>
    <select aria-label={isEnglish ? "Translation language" : "Langue de traduction"} value={targetLocale}
      onChange={(event) => setTargetLocale(event.target.value as ChatTranslationTargetLocale)}
      className="min-w-0 max-w-36 rounded-md border border-[#176951]/15 bg-[#F7FBF9] px-1 py-0.5 text-[11px]">
      {Object.entries(CHAT_TRANSLATION_LANGUAGES).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
    </select>
    <span>{isEnglish ? "Originals always available" : "Originaux toujours disponibles"}</span>
    {paused ? <span role="status" className="w-full text-[#8B651D]">{isEnglish ? "Translation paused (limit or temporary unavailability). Original messages remain available." : "Traduction en pause (limite ou indisponibilité temporaire). Les messages originaux restent disponibles."}</span> : null}
  </div>;
}
