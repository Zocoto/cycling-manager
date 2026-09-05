begin;

-- Même réparation idempotente pour le journal de quota : la version dupliquée
-- a également pu être enregistrée sans créer cette table en production.
create table if not exists public.global_chat_translation_requests (
  id uuid primary key default gen_random_uuid(),
  sporting_director_id uuid not null
    references public.sporting_directors(id)
    on delete cascade,
  message_id uuid not null
    references public.global_chat_messages(id)
    on delete cascade,
  target_locale text not null,
  created_at timestamptz not null default now(),

  constraint global_chat_translation_requests_target_locale
    check (target_locale in ('fr', 'en'))
);

create index if not exists global_chat_translation_requests_director_created_idx
  on public.global_chat_translation_requests
  (sporting_director_id, created_at desc);

alter table public.global_chat_translation_requests enable row level security;
revoke all on table public.global_chat_translation_requests
  from public, anon, authenticated;
grant all on table public.global_chat_translation_requests to service_role;

notify pgrst, 'reload schema';

commit;
