export const LEGAL_DOCUMENT_VERSION = "2026-08-29";

export const legalConfig = {
  effectiveDateLabel: "29 août 2026",
  controllerName:
    process.env.NEXT_PUBLIC_LEGAL_CONTROLLER_NAME?.trim() ||
    "Cyclo Stratège",
  privacyEmail:
    process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL?.trim() ||
    "confidentialite@cyclostratege.fr",
  termsVersion: LEGAL_DOCUMENT_VERSION,
  privacyNoticeVersion: LEGAL_DOCUMENT_VERSION,
} as const;
