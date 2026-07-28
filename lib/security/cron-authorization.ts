const MINIMUM_CRON_SECRET_LENGTH = 16;

export function isAuthorizedCronRequest(
  request: Request,
  configuredSecret = process.env.CRON_SECRET,
) {
  const cronSecret = configuredSecret?.trim();
  if (!cronSecret || cronSecret.length < MINIMUM_CRON_SECRET_LENGTH) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}
