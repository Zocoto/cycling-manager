begin;

-- Le cache est partagé entre les lecteurs d'un même message. Il n'est jamais
-- exposé directement au client : seules les routes serveur peuvent le lire.
create table public.global_chat_message_translations (
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

-- Les cache hits ne consomment pas la limite. Cette table ne journalise que
-- les appels réels au fournisseur afin de protéger le quota de traduction.
create table public.global_chat_translation_requests (
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

create index global_chat_translation_requests_director_created_idx
  on public.global_chat_translation_requests
  (sporting_director_id, created_at desc);

alter table public.global_chat_translation_requests enable row level security;
revoke all on table public.global_chat_translation_requests
  from public, anon, authenticated;
grant all on table public.global_chat_translation_requests to service_role;

-- V3 ajoute la nationalité comme indice visuel sans l'utiliser pour deviner
-- la langue du message. La langue est détectée par le moteur de traduction.
create or replace function public.get_current_global_chat_identity_v3()
returns table (
  sporting_director_id uuid,
  username text,
  display_name text,
  avatar_key text,
  avatar_frame_key text,
  country_name text,
  country_code text,
  team_id uuid,
  team_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    director.id,
    director.username,
    director.display_name,
    director.avatar_key,
    director.avatar_frame_key,
    country.name,
    country.iso_alpha2,
    assignment.team_id,
    coalesce(
      current_team_season.display_name,
      nullif(btrim(team.amateur_name), ''),
      team.internal_name
    )
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.teams as team
    on team.id = assignment.team_id
   and team.status = 'active'
  left join public.countries as country
    on country.id = director.country_id
  left join lateral (
    select team_season.display_name
    from public.team_seasons as team_season
    where team_season.team_id = team.id
      and team_season.status in ('planned', 'active')
    order by
      case when team_season.status = 'active' then 0 else 1 end,
      team_season.created_at desc
    limit 1
  ) as current_team_season on true
  where director.auth_user_id = (select auth.uid())
    and director.status = 'active'
  limit 1;
$$;

create or replace function public.get_online_global_chat_directors_v3()
returns table (
  sporting_director_id uuid,
  username text,
  display_name text,
  avatar_key text,
  avatar_frame_key text,
  country_name text,
  country_code text,
  team_id uuid,
  team_name text,
  last_seen_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with recent_presence as (
    select
      activity.auth_user_id,
      max(activity.last_seen_at) as last_seen_at
    from public.player_daily_activity as activity
    where activity.last_seen_at >= pg_catalog.now() - interval '15 minutes'
    group by activity.auth_user_id
  )
  select
    director.id,
    director.username,
    director.display_name,
    director.avatar_key,
    director.avatar_frame_key,
    country.name,
    country.iso_alpha2,
    assignment.team_id,
    coalesce(
      current_team_season.display_name,
      nullif(btrim(team.amateur_name), ''),
      team.internal_name
    ),
    presence.last_seen_at
  from recent_presence as presence
  join public.sporting_directors as director
    on director.auth_user_id = presence.auth_user_id
   and director.status = 'active'
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.teams as team
    on team.id = assignment.team_id
   and team.status = 'active'
  left join public.countries as country
    on country.id = director.country_id
  left join lateral (
    select team_season.display_name
    from public.team_seasons as team_season
    where team_season.team_id = team.id
      and team_season.status in ('planned', 'active')
    order by
      case when team_season.status = 'active' then 0 else 1 end,
      team_season.created_at desc
    limit 1
  ) as current_team_season on true
  where (select auth.uid()) is not null
    and not exists (
      select 1
      from public.alpha_bot_managers as bot
      where bot.sporting_director_id = director.id
    )
  order by
    (director.auth_user_id = (select auth.uid())) desc,
    director.display_name,
    director.id;
$$;

create or replace function public.get_global_chat_director_profiles(
  p_sporting_director_ids uuid[]
)
returns table (
  sporting_director_id uuid,
  avatar_key text,
  avatar_frame_key text,
  country_name text,
  country_code text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    director.id,
    director.avatar_key,
    director.avatar_frame_key,
    country.name,
    country.iso_alpha2
  from public.sporting_directors as director
  left join public.countries as country
    on country.id = director.country_id
  where (select auth.uid()) is not null
    and director.id = any(coalesce(p_sporting_director_ids, array[]::uuid[]));
$$;

revoke all on function public.get_current_global_chat_identity_v3()
  from public, anon;
revoke all on function public.get_online_global_chat_directors_v3()
  from public, anon;
revoke all on function public.get_global_chat_director_profiles(uuid[])
  from public, anon;
grant execute on function public.get_current_global_chat_identity_v3()
  to authenticated, service_role;
grant execute on function public.get_online_global_chat_directors_v3()
  to authenticated, service_role;
grant execute on function public.get_global_chat_director_profiles(uuid[])
  to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
