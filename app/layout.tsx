import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { appConfig } from "../lib/app-config";
import { ScrollToTop } from "../components/layout/scroll-to-top";
import { LocaleProvider } from "../components/i18n/locale-provider";
import { getRequestLocale } from "../lib/i18n/server";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(appConfig.siteUrl),
  title: {
    default: "Cyclo Stratège – Jeu de management cycliste en ligne",
    template: `%s | ${appConfig.name}`,
  },
  description: appConfig.description,
  applicationName: appConfig.name,
  category: "games",
  keywords: [
    "jeu de management cycliste",
    "jeu de cyclisme en ligne",
    "directeur sportif",
    "simulation cycliste",
    "jeu de gestion sportive",
  ],
  authors: [{ name: appConfig.name, url: appConfig.siteUrl }],
  creator: appConfig.name,
  publisher: appConfig.name,
  openGraph: {
    type: "website",
    locale: appConfig.locale,
    siteName: appConfig.name,
    title: "Cyclo Stratège – Jeu de management cycliste en ligne",
    description: appConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: "Cyclo Stratège – Jeu de management cycliste en ligne",
    description: appConfig.description,
  },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? {
        google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
      }
    : undefined,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: appConfig.name,
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#071A17",
  colorScheme: "light",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();
  const inLanguage = locale === "en" ? "en-GB" : "fr-FR";
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${appConfig.siteUrl}/#website`,
        url: appConfig.siteUrl,
        name: appConfig.name,
        description: appConfig.description,
        inLanguage,
        publisher: {
          "@id": `${appConfig.siteUrl}/#organization`,
        },
      },
      {
        "@type": "Organization",
        "@id": `${appConfig.siteUrl}/#organization`,
        name: appConfig.name,
        url: appConfig.siteUrl,
        logo: `${appConfig.siteUrl}/logo-cyclo-stratege.png`,
        sameAs: [appConfig.instagramUrl, appConfig.discordUrl],
      },
      {
        "@type": "VideoGame",
        "@id": `${appConfig.siteUrl}/#game`,
        name: appConfig.name,
        url: appConfig.siteUrl,
        description: appConfig.description,
        image: `${appConfig.siteUrl}/opengraph-image.png`,
        applicationCategory: "GameApplication",
        operatingSystem: "Web Browser",
        genre: ["Cyclisme", "Management sportif", "Stratégie"],
        inLanguage,
        publisher: {
          "@id": `${appConfig.siteUrl}/#organization`,
        },
      },
    ],
  };

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />
        <LocaleProvider initialLocale={locale}>
          <ScrollToTop />
          {children}
        </LocaleProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
