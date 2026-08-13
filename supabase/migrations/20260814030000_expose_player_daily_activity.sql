begin;

create table public.player_daily_activity (
  auth_user_id uuid not null
    references auth.users(id)
    on delete cascade,
  activity_on date not null,
  primary key (auth_user_id, activity_on)
);

alter table public.player_daily_activity enable row level security;

grant all privileges on public.player_daily_activity to service_role;

insert into public.player_daily_activity (auth_user_id, activity_on)
select
  director.auth_user_id,
  (attendance.attended_at at time zone 'Europe/Paris')::date
from public.sporting_director_daily_attendance as attendance
join public.sporting_directors as director
  on director.id = attendance.sporting_director_id
where director.auth_user_id is not null
on conflict (auth_user_id, activity_on) do nothing;

create or replace function public.record_current_sporting_director_attendance()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_director_id uuid;
  v_season_id uuid;
  v_season_day_id uuid;
  v_day_number integer;
  v_inserted_count integer := 0;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Vous devez être connecté pour enregistrer votre présence.';
  end if;

  insert into public.player_daily_activity (auth_user_id, activity_on)
  values (
    auth.uid(),
    (now() at time zone 'Europe/Paris')::date
  )
  on conflict (auth_user_id, activity_on) do nothing;

  select
    director.id,
    season.id,
    season_day.id,
    season_day.day_number
  into
    v_director_id,
    v_season_id,
    v_season_day_id,
    v_day_number
  from public.sporting_directors as director
  cross join public.seasons as season
  join public.season_days as season_day
    on season_day.season_id = season.id
   and season_day.day_number = coalesce(season.current_day_number, 1)
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
    and season.status = 'active'
    and not exists (
      select 1
      from public.alpha_bot_managers as bot
      where bot.sporting_director_id = director.id
    )
  order by season.game_year desc
  limit 1;

  if v_director_id is null or v_season_day_id is null then
    return jsonb_build_object('status', 'unavailable');
  end if;

  insert into public.sporting_director_daily_attendance (
    sporting_director_id,
    season_day_id
  )
  values (
    v_director_id,
    v_season_day_id
  )
  on conflict (sporting_director_id, season_day_id) do nothing;

  get diagnostics v_inserted_count = row_count;

  return jsonb_build_object(
    'status',
    case when v_inserted_count = 1 then 'recorded' else 'already-recorded' end,
    'season_id', v_season_id,
    'day_number', v_day_number
  );
end;
$$;

revoke all on function public.record_current_sporting_director_attendance()
  from public, anon;
grant execute on function public.record_current_sporting_director_attendance()
  to authenticated;

create or replace function public.get_player_tracking_last_activity()
returns table (
  auth_user_id uuid,
  last_activity_on date
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    activity.auth_user_id,
    max(activity.activity_on) as last_activity_on
  from public.player_daily_activity as activity
  group by activity.auth_user_id;
$$;

revoke all on function public.get_player_tracking_last_activity()
  from public, anon, authenticated;
grant execute on function public.get_player_tracking_last_activity()
  to service_role;

comment on table public.player_daily_activity is
  'Une activite authentifiee au maximum par compte et par date civile de Paris.';

comment on function public.get_player_tracking_last_activity() is
  'Expose uniquement au service interne la derniere date civile d activite par compte.';

notify pgrst, 'reload schema';

commit;
