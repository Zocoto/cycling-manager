import { z } from "zod";

export const SITE_RELEASE_CACHE_TAG = "active-site-release";
// Shared with the database CHECK; no HTML, whitespace or unbounded identifiers.
export const SITE_RELEASE_VERSION_PATTERN = /^(0|[1-9][0-9]{0,5})[.](0|[1-9][0-9]{0,5})[.](0|[1-9][0-9]{0,5})(-[A-Za-z0-9]+([.][A-Za-z0-9]+)*)?$/;
export const siteReleaseVersionSchema = z.string().trim().max(40).regex(SITE_RELEASE_VERSION_PATTERN);
export const siteReleaseUpdateSchema = z.object({
  version: siteReleaseVersionSchema,
  note: z.string().trim().max(180),
  revision: z.number().int().min(1).max(2_147_483_646),
});
export const siteReleaseSnapshotSchema = z.object({
  version: siteReleaseVersionSchema,
  revision: z.number().int().positive(),
  updated_at: z.string().datetime({ offset: true }),
});
export const siteReleaseManagementSchema = siteReleaseSnapshotSchema.extend({
  history: z.array(z.object({
    version: siteReleaseVersionSchema,
    previous_version: siteReleaseVersionSchema.nullable(),
    revision: z.number().int().positive(),
    note: z.string().max(180),
    recorded_at: z.string().datetime({ offset: true }),
  })).max(10),
});
export type SiteReleaseManagement = z.infer<typeof siteReleaseManagementSchema>;
export type SiteReleaseActionState = {
  status: "idle" | "success" | "error" | "conflict";
  message: string | null;
  management?: SiteReleaseManagement;
};
