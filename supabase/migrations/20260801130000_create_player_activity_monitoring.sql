-- Monitoring alpha des usages : événements minimisés, accès privé et rétention courte.

begin;

create table public.player_activity_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null
    references auth.users(id)
    on delete cascade,
  sporting_director_id uuid
    references public.sporting_directors(id)
    on delete set null,
  team_id uuid
    references public.teams(id)
    on delete set null,
  team_season_id uuid
    references public.team_seasons(id)
    on delete set null,
  event_type text not null,
  route_path text not null,
  section_key text not null,
  action_key text,
  action_label text,
  device_type text not null,
  occurred_at timestamptz not null default now(),

  constraint player_activity_events_event_type_allowed
    check (event_type in ('page_view', 'form_submit', 'interaction')),
  constraint player_activity_events_route_path_valid
    check (
      char_length(route_path) between 4 and 200
      and (route_path = '/jeu' or route_path like '/jeu/%')
    ),
  constraint player_activity_events_section_key_valid
    check (
      char_length(section_key) between 1 and 64
      and section_key ~ '^[a-z0-9-]+$'
    ),
  constraint player_activity_events_action_key_valid
    check (
      action_key is null
      or (
        char_length(action_key) between 1 and 80
        and action_key ~ '^[a-z0-9-]+$'
      )
    ),
  constraint player_activity_events_action_label_length
    check (action_label is null or char_length(action_label) <= 120),
  constraint player_activity_events_device_type_allowed
    check (device_type in ('desktop', 'tablet', 'mobile'))
);

create index player_activity_events_occurred_at_idx
  on public.player_activity_events (occurred_at desc);
create index player_activity_events_actor_recent_idx
  on public.player_activity_events (actor_user_id, occurred_at desc);
create index player_activity_events_section_recent_idx
  on public.player_activity_events (section_key, occurred_at desc);

alter table public.player_activity_events enable row level security;

revoke all on table public.player_activity_events
  from public, anon, authenticated;
revoke all on sequence public.player_activity_events_id_seq
  from public, anon, authenticated;

create or replace function public.record_current_player_activity(
  p_event_type text,
  p_route_path text,
  p_section_key text,
  p_action_key text default null,
  p_action_label text default null,
  p_device_type text default 'desktop'
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_context record;
  v_event_type text := lower(btrim(coalesce(p_event_type, '')));
  v_route_path text := left(btrim(coalesce(p_route_path, '')), 200);
  v_section_key text := left(lower(btrim(coalesce(p_section_key, ''))), 64);
  v_action_key text;
  v_action_label text;
  v_device_type text := lower(btrim(coalesce(p_device_type, '')));
  v_event_id bigint;
  v_deduplication_window interval;
begin
  if v_user_id is null then
    raise exception 'Une session authentifiée est requise.';
  end if;

  if v_event_type not in ('page_view', 'form_submit', 'interaction') then
    raise exception 'Type d’activité invalide.';
  end if;

  if
    v_route_path <> '/jeu'
    and v_route_path not like '/jeu/%'
  then
    raise exception 'La route suivie doit appartenir au jeu.';
  end if;

  if
    v_section_key = ''
    or v_section_key !~ '^[a-z0-9-]+$'
  then
    raise exception 'Rubrique de suivi invalide.';
  end if;

  if v_device_type not in ('desktop', 'tablet', 'mobile') then
    raise exception 'Type d’appareil invalide.';
  end if;

  v_action_key := nullif(
    left(
      regexp_replace(lower(btrim(coalesce(p_action_key, ''))), '[^a-z0-9-]+', '-', 'g'),
      80
    ),
    ''
  );
  v_action_label := nullif(
    left(
      regexp_replace(btrim(coalesce(p_action_label, '')), E'[\\n\\r\\t ]+', ' ', 'g'),
      120
    ),
    ''
  );

  if (
    select count(*)
    from public.player_activity_events as recent_event
    where recent_event.actor_user_id = v_user_id
      and recent_event.occurred_at >= now() - interval '1 minute'
  ) >= 120 then
    return null;
  end if;

  v_deduplication_window := case
    when v_event_type = 'page_view' then interval '5 seconds'
    else interval '1 second'
  end;

  if exists (
    select 1
    from public.player_activity_events as duplicate_event
    where duplicate_event.actor_user_id = v_user_id
      and duplicate_event.event_type = v_event_type
      and duplicate_event.route_path = v_route_path
      and duplicate_event.action_key is not distinct from v_action_key
      and duplicate_event.occurred_at >= now() - v_deduplication_window
  ) then
    return null;
  end if;

  select
    director.id as sporting_director_id,
    assignment.team_id,
    team_season.id as team_season_id
  into v_context
  from public.sporting_directors as director
  left join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  left join public.seasons as season
    on season.status = 'active'
  left join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  where director.auth_user_id = v_user_id
  limit 1;

  insert into public.player_activity_events (
    actor_user_id,
    sporting_director_id,
    team_id,
    team_season_id,
    event_type,
    route_path,
    section_key,
    action_key,
    action_label,
    device_type
  )
  values (
    v_user_id,
    v_context.sporting_director_id,
    v_context.team_id,
    v_context.team_season_id,
    v_event_type,
    v_route_path,
    v_section_key,
    v_action_key,
    v_action_label,
    v_device_type
  )
  returning id into v_event_id;

  -- Rétention volontairement courte pendant l’alpha.
  delete from public.player_activity_events
  where occurred_at < now() - interval '7 days';

  return v_event_id;
end;
$$;

create or replace function public.get_player_activity_monitoring(
  p_event_filter text default null,
  p_section_filter text default null,
  p_page integer default 1,
  p_page_size integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_allowed_email constant text := 'paul.leblanc22@gmail.com';
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_since timestamptz := now() - interval '24 hours';
  v_event_filter text := nullif(lower(btrim(coalesce(p_event_filter, ''))), 'all');
  v_section_filter text := nullif(lower(btrim(coalesce(p_section_filter, ''))), 'all');
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 50), 10), 100);
  v_total_events bigint;
  v_unique_players bigint;
  v_page_views bigint;
  v_actions bigint;
  v_mobile_events bigint;
  v_filtered_count bigint;
  v_sections jsonb;
  v_events jsonb;
begin
  if v_email <> v_allowed_email then
    raise exception 'Accès réservé au compte administrateur.'
      using errcode = '42501';
  end if;

  if
    v_event_filter is not null
    and v_event_filter not in ('page_view', 'form_submit', 'interaction')
  then
    v_event_filter := null;
  end if;

  if
    v_section_filter is not null
    and v_section_filter !~ '^[a-z0-9-]{1,64}$'
  then
    v_section_filter := null;
  end if;

  select
    count(*),
    count(distinct actor_user_id),
    count(*) filter (where event_type = 'page_view'),
    count(*) filter (where event_type in ('form_submit', 'interaction')),
    count(*) filter (where device_type = 'mobile')
  into
    v_total_events,
    v_unique_players,
    v_page_views,
    v_actions,
    v_mobile_events
  from public.player_activity_events
  where occurred_at >= v_since;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'sectionKey', section_row.section_key,
      'totalEvents', section_row.total_events,
      'pageViews', section_row.page_views,
      'actions', section_row.actions,
      'uniquePlayers', section_row.unique_players,
      'lastActivityAt', section_row.last_activity_at
    )
    order by section_row.page_views desc, section_row.total_events desc
  ), '[]'::jsonb)
  into v_sections
  from (
    select
      section_key,
      count(*) as total_events,
      count(*) filter (where event_type = 'page_view') as page_views,
      count(*) filter (where event_type in ('form_submit', 'interaction')) as actions,
      count(distinct actor_user_id) as unique_players,
      max(occurred_at) as last_activity_at
    from public.player_activity_events
    where occurred_at >= v_since
    group by section_key
  ) as section_row;

  select count(*)
  into v_filtered_count
  from public.player_activity_events as activity
  where activity.occurred_at >= v_since
    and (v_event_filter is null or activity.event_type = v_event_filter)
    and (v_section_filter is null or activity.section_key = v_section_filter);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', event_row.id,
      'actorName', event_row.actor_name,
      'actorUsername', event_row.actor_username,
      'teamName', event_row.team_name,
      'eventType', event_row.event_type,
      'routePath', event_row.route_path,
      'sectionKey', event_row.section_key,
      'actionKey', event_row.action_key,
      'actionLabel', event_row.action_label,
      'deviceType', event_row.device_type,
      'occurredAt', event_row.occurred_at
    )
    order by event_row.occurred_at desc, event_row.id desc
  ), '[]'::jsonb)
  into v_events
  from (
    select
      activity.id,
      coalesce(director.display_name, director.username, 'Joueur') as actor_name,
      director.username as actor_username,
      team_season.display_name as team_name,
      activity.event_type,
      activity.route_path,
      activity.section_key,
      activity.action_key,
      activity.action_label,
      activity.device_type,
      activity.occurred_at
    from public.player_activity_events as activity
    left join public.sporting_directors as director
      on director.id = activity.sporting_director_id
    left join public.team_seasons as team_season
      on team_season.id = activity.team_season_id
    where activity.occurred_at >= v_since
      and (v_event_filter is null or activity.event_type = v_event_filter)
      and (v_section_filter is null or activity.section_key = v_section_filter)
    order by activity.occurred_at desc, activity.id desc
    limit v_page_size
    offset (v_page - 1) * v_page_size
  ) as event_row;

  return jsonb_build_object(
    'windowStartedAt', v_since,
    'generatedAt', now(),
    'summary', jsonb_build_object(
      'totalEvents', coalesce(v_total_events, 0),
      'uniquePlayers', coalesce(v_unique_players, 0),
      'pageViews', coalesce(v_page_views, 0),
      'actions', coalesce(v_actions, 0),
      'mobileEvents', coalesce(v_mobile_events, 0)
    ),
    'sections', v_sections,
    'events', v_events,
    'pagination', jsonb_build_object(
      'page', v_page,
      'pageSize', v_page_size,
      'totalItems', coalesce(v_filtered_count, 0),
      'totalPages', greatest(1, ceil(coalesce(v_filtered_count, 0)::numeric / v_page_size)::integer)
    )
  );
end;
$$;

revoke all on function public.record_current_player_activity(
  text, text, text, text, text, text
) from public, anon;
revoke all on function public.get_player_activity_monitoring(
  text, text, integer, integer
) from public, anon;

grant execute on function public.record_current_player_activity(
  text, text, text, text, text, text
) to authenticated, service_role;
grant execute on function public.get_player_activity_monitoring(
  text, text, integer, integer
) to authenticated, service_role;

comment on table public.player_activity_events is
  'Télémétrie alpha minimisée : routes et interactions du jeu, purgées après sept jours.';
comment on function public.get_player_activity_monitoring(
  text, text, integer, integer
) is
  'Vue privée des dernières 24 heures, protégée par le compte administrateur autorisé.';

notify pgrst, 'reload schema';

commit;
