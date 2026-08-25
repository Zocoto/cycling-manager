begin;

-- Les messages du chat ne peuvent contenir que des liens de fiches internes.
-- Le trigger protège aussi les écritures futures qui ne passeraient pas par
-- l'interface Next.js.
create or replace function public.validate_global_chat_message_links()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_without_allowed_links text;
begin
  v_without_allowed_links := regexp_replace(
    new.message,
    '((https://(www\.)?|www\.)?cyclostratege\.fr)?/jeu/(equipes|coureurs)/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}([^[:space:]<]*)?',
    ' ',
    'gi'
  );

  if v_without_allowed_links ~* '(https?://|www\.)'
    or v_without_allowed_links ~* '(^|[[:space:]<(])([[:alnum:]-]+\.)+[[:alpha:]]{2,}(/[^[:space:]<]*)?'
  then
    raise exception
      'Seuls les liens Cyclo Stratège vers une fiche coureur ou équipe sont autorisés.';
  end if;

  return new;
end;
$$;

drop trigger if exists global_chat_messages_validate_links
  on public.global_chat_messages;
create trigger global_chat_messages_validate_links
before insert or update of message on public.global_chat_messages
for each row execute function public.validate_global_chat_message_links();

revoke all on function public.validate_global_chat_message_links()
  from public, anon, authenticated;

create or replace function public.validate_direct_message_links()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_without_allowed_links text;
begin
  v_without_allowed_links := regexp_replace(
    new.body,
    '((https://(www\.)?|www\.)?cyclostratege\.fr)?/jeu/(equipes|coureurs)/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}([^[:space:]<]*)?',
    ' ',
    'gi'
  );

  if v_without_allowed_links ~* '(https?://|www\.)'
    or v_without_allowed_links ~* '(^|[[:space:]<(])([[:alnum:]-]+\.)+[[:alpha:]]{2,}(/[^[:space:]<]*)?'
  then
    raise exception
      'Seuls les liens Cyclo Stratège vers une fiche coureur ou équipe sont autorisés.';
  end if;

  return new;
end;
$$;

create trigger direct_messages_validate_links
before insert or update of body on public.direct_messages
for each row execute function public.validate_direct_message_links();

revoke all on function public.validate_direct_message_links()
  from public, anon, authenticated;

-- Cette identité enrichie évite une lecture supplémentaire pour l'avatar du
-- membre connecté. L'ancienne fonction reste disponible pour les RPC métier.
create or replace function public.get_current_global_chat_identity_v2()
returns table (
  sporting_director_id uuid,
  username text,
  display_name text,
  avatar_key text,
  avatar_frame_key text,
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

create or replace function public.get_global_chat_director_avatars(
  p_sporting_director_ids uuid[]
)
returns table (
  sporting_director_id uuid,
  avatar_key text,
  avatar_frame_key text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    director.id,
    director.avatar_key,
    director.avatar_frame_key
  from public.sporting_directors as director
  where (select auth.uid()) is not null
    and director.id = any(coalesce(p_sporting_director_ids, array[]::uuid[]));
$$;

-- La liste enrichie conserve le heartbeat global récent déployé en
-- production, tout en fournissant les avatars sans requête par membre.
create or replace function public.get_online_global_chat_directors_v2()
returns table (
  sporting_director_id uuid,
  username text,
  display_name text,
  avatar_key text,
  avatar_frame_key text,
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
    where activity.last_seen_at >= pg_catalog.now() - interval '3 minutes'
    group by activity.auth_user_id
  )
  select
    director.id,
    director.username,
    director.display_name,
    director.avatar_key,
    director.avatar_frame_key,
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

revoke all on function public.get_current_global_chat_identity_v2()
  from public, anon;
revoke all on function public.get_global_chat_director_avatars(uuid[])
  from public, anon;
revoke all on function public.get_online_global_chat_directors_v2()
  from public, anon;
grant execute on function public.get_current_global_chat_identity_v2()
  to authenticated, service_role;
grant execute on function public.get_global_chat_director_avatars(uuid[])
  to authenticated, service_role;
grant execute on function public.get_online_global_chat_directors_v2()
  to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
