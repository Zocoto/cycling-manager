# Trophy arrival navigation — 23 October 2026

- The private gallery loads up to 100 unread trophy references, scoped to the
  authenticated director and using the existing unread partial index. Two small
  columns, one request parallel to the gallery load, only on the gallery page.
- Existing mailbox source references generate precise gallery links at read
  time. Old and future messages work without rewriting stored mail or changing
  notification triggers. Inventory rewards and non-trophy messages are unchanged.
- An award resolves against every win in a merged trophy, not just the group's
  displayed ID. New awards show their actual season and rider; a previously seen
  award opened from mail is selected, not falsely labeled new.
- The newest unread award is scrolled into view; an explicit mail link takes
  priority. Other newly awarded trophies are also highlighted and linked from
  the gallery summary. Unknown or unavailable references select nothing.
- A small client context retains this visit's arrival snapshot when the existing
  acknowledgement action revalidates server data. Public profiles neither fetch
  private notices nor acknowledge them. Notifications are acknowledged only after
  the private gallery mounts.
- Programmatic focus targets a non-interactive wrapper: focusing AppLink itself
  would inadvertently open the race preview and issue another request.
- No migration, reward backfill, gameplay write, polling, new dependency or
  per-trophy server request. The preview is development-only and uses fictional
  data; production returns 404.

Validation: helper tests cover every notification family, multi-season merging,
old mail, priority, deduplication and invalid/foreign references. Component tests
cover earned/locked presentation. Service contract tests cover ownership, query
bounds and public-profile isolation. Desktop/mobile browser checks verify scroll,
selection, native summary anchors, no overflow and no unwanted race preview.
