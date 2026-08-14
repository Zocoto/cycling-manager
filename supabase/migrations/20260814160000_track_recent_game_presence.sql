begin;

alter table public.player_daily_activity
  add column last_seen_at timestamptz;

create index player_daily_activity_last_seen_idx
  on public.player_daily_activity (last_seen_at desc)
  where last_seen_at is not null;

create or replace function public.record_current_game_presence()
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_last_seen_at timestamptz := pg_catalog.clock_timestamp();
  v_recorded_at timestamptz;
begin
  if v_auth_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Vous devez être connecté pour enregistrer votre présence.';
  end if;

  insert into public.player_daily_activity (
    auth_user_id,
    activity_on,
    last_seen_at
  )
  select
    v_auth_user_id,
    (v_last_seen_at at time zone 'Europe/Paris')::date,
    v_last_seen_at
  from public.sporting_directors as director
  where director.auth_user_id = v_auth_user_id
    and director.status = 'active'
    and not exists (
      select 1
      from public.alpha_bot_managers as bot
      where bot.sporting_director_id = director.id
    )
  on conflict (auth_user_id, activity_on) do update
  set last_seen_at = excluded.last_seen_at
  returning last_seen_at into v_recorded_at;

  if v_recorded_at is null then
    raise exception using
      errcode = '42501',
      message = 'Aucun Directeur Sportif actif ne correspond à ce compte.';
  end if;

  return v_recorded_at;
end;
$$;

create or replace function public.get_online_global_chat_directors()
returns table (
  sporting_director_id uuid,
  display_name text,
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
    where activity.last_seen_at >= pg_catalog.now() - interval '20 minutes'
    group by activity.auth_user_id
  )
  select
    director.id,
    director.display_name,
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

revoke all on function public.record_current_game_presence()
  from public, anon;
revoke all on function public.get_online_global_chat_directors()
  from public, anon;

grant execute on function public.record_current_game_presence()
  to authenticated, service_role;
grant execute on function public.get_online_global_chat_directors()
  to authenticated, service_role;

comment on column public.player_daily_activity.last_seen_at is
  'Dernier heartbeat authentifié reçu depuis une page du jeu.';

comment on function public.record_current_game_presence() is
  'Actualise la présence récente du Directeur Sportif connecté depuis toute page du jeu.';

comment on function public.get_online_global_chat_directors() is
  'Liste les Directeurs Sportifs actifs vus dans le jeu au cours des vingt dernières minutes.';

notify pgrst, 'reload schema';

commit;
