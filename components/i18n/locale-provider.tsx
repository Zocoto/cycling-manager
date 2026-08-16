"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";

import { DEFAULT_LOCALE, type AppLocale } from "@/lib/i18n/config";

const DocumentLocaleBridge = dynamic(
  () =>
    import("@/components/i18n/document-locale-bridge").then(
      (module) => module.DocumentLocaleBridge,
    ),
  { ssr: false },
);

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
};

const DEFAULT_CONTEXT: LocaleContextValue = {
  locale: DEFAULT_LOCALE,
  setLocale: () => undefined,
};

const LocaleContext = createContext<LocaleContextValue>(DEFAULT_CONTEXT);

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: AppLocale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState(initialLocale);
  const setLocale = useCallback((nextLocale: AppLocale) => {
    setLocaleState(nextLocale);
    document.documentElement.lang = nextLocale;
  }, []);
  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return (
    <LocaleContext.Provider value={value}>
      {locale === "en" ? <DocumentLocaleBridge locale={locale} /> : null}
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
