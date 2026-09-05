export const TERMS_DOCUMENT_VERSION = "2026-08-29";
export const PRIVACY_NOTICE_VERSION = "2026-09-05";

export const legalConfig = {
  effectiveDateLabel: "29 août 2026",
  termsEffectiveDateLabel: "29 août 2026",
  privacyEffectiveDateLabel: "5 septembre 2026",
  controllerName:
    process.env.NEXT_PUBLIC_LEGAL_CONTROLLER_NAME?.trim() ||
    "Cyclo Stratège",
  privacyEmail:
    process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL?.trim() ||
    "confidentialite@cyclostratege.fr",
  termsVersion: TERMS_DOCUMENT_VERSION,
  privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
} as const;
