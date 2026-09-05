begin;

-- Le doublon historique de version 20260905170000 a pu marquer la migration
-- comme appliquée sans créer le cache de traduction. Cette réparation est
-- volontairement idempotente et ne touche ni au chat ni aux messages existants.
create table if not exists public.global_chat_message_translations (
  message_id uuid not null
    references public.global_chat_messages(id)
    on delete cascade,
  target_locale text not null,
  source_fingerprint text not null,
  translated_message text not null,
  detected_source_locale text,
  provider text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (message_id, target_locale),
  constraint global_chat_message_translations_target_locale
    check (target_locale in ('fr', 'en')),
  constraint global_chat_message_translations_fingerprint
    check (source_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint global_chat_message_translations_message_not_empty
    check (btrim(translated_message) <> ''),
  constraint global_chat_message_translations_provider_not_empty
    check (btrim(provider) <> '')
);

alter table public.global_chat_message_translations enable row level security;
revoke all on table public.global_chat_message_translations
  from public, anon, authenticated;
grant all on table public.global_chat_message_translations to service_role;

notify pgrst, 'reload schema';

commit;
