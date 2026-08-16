const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

export const appConfig = {
  name: "Cyclo Stratège",
  description:
    "Dirigez votre équipe dans Cyclo Stratège, le jeu de management cycliste en ligne : recrutement, entraînement, matériel, stratégie et courses.",
  version: "0.1.0",
  siteUrl: configuredSiteUrl || "https://cyclostratege.fr",
  locale: "fr_FR",
  instagramUrl: "https://www.instagram.com/cyclostratege/",
  discordUrl: "https://discord.gg/Zq9ecPYEF",
} as const;
export function getAbsoluteUrl(pathname = "/"): string {
  return new URL(pathname, appConfig.siteUrl).toString();
}
