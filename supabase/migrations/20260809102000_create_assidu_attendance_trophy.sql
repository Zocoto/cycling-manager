begin;

create table public.sporting_director_daily_attendance (
  id uuid primary key default gen_random_uuid(),
  sporting_director_id uuid not null
    references public.sporting_directors(id)
    on delete cascade,
  season_day_id uuid not null
    references public.season_days(id)
    on delete cascade,
  attended_at timestamptz not null default now(),
  unique (sporting_director_id, season_day_id)
);

create index sporting_director_daily_attendance_day_idx
  on public.sporting_director_daily_attendance (season_day_id, sporting_director_id);

create table public.sporting_director_attendance_trophies (
  id uuid primary key default gen_random_uuid(),
  sporting_director_id uuid not null
    references public.sporting_directors(id)
    on delete cascade,
  season_id uuid not null
    references public.seasons(id)
    on delete cascade,
  awarded_at timestamptz not null default now(),
  unique (sporting_director_id, season_id)
);

create index sporting_director_attendance_trophies_director_idx
  on public.sporting_director_attendance_trophies (
    sporting_director_id,
    awarded_at desc
  );

alter table public.sporting_director_daily_attendance enable row level security;
alter table public.sporting_director_attendance_trophies enable row level security;

create policy sporting_director_daily_attendance_select_own
  on public.sporting_director_daily_attendance
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.sporting_directors as director
      where director.id = sporting_director_id
        and director.auth_user_id = (select auth.uid())
    )
  );

create policy sporting_director_attendance_trophies_select_own
  on public.sporting_director_attendance_trophies
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.sporting_directors as director
      where director.id = sporting_director_id
        and director.auth_user_id = (select auth.uid())
    )
  );

grant select on public.sporting_director_daily_attendance
  to authenticated;
grant select on public.sporting_director_attendance_trophies
  to authenticated;
grant all privileges on public.sporting_director_daily_attendance
  to service_role;
grant all privileges on public.sporting_director_attendance_trophies
  to service_role;

create or replace function public.award_assidu_trophies_for_season(
  p_season_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_awarded_count integer := 0;
begin
  if not exists (
    select 1
    from public.seasons as season
    where season.id = p_season_id
      and season.status = 'completed'
  ) then
    return 0;
  end if;

  with season_size as (
    select count(*)::integer as day_count
    from public.season_days as day
    where day.season_id = p_season_id
  ),
  eligible_directors as (
    select attendance.sporting_director_id
    from public.sporting_director_daily_attendance as attendance
    join public.season_days as attended_day
      on attended_day.id = attendance.season_day_id
    cross join season_size
    where attended_day.season_id = p_season_id
      and season_size.day_count > 0
      and not exists (
        select 1
        from public.alpha_bot_managers as bot
        where bot.sporting_director_id = attendance.sporting_director_id
      )
    group by attendance.sporting_director_id, season_size.day_count
    having count(distinct attendance.season_day_id) = season_size.day_count
  )
  insert into public.sporting_director_attendance_trophies (
    sporting_director_id,
    season_id
  )
  select eligible.sporting_director_id, p_season_id
  from eligible_directors as eligible
  on conflict (sporting_director_id, season_id) do nothing;

  get diagnostics v_awarded_count = row_count;
  return v_awarded_count;
end;
$$;

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

create or replace function public.award_assidu_trophies_after_season_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed'
     and old.status is distinct from 'completed' then
    perform public.award_assidu_trophies_for_season(new.id);
  end if;

  return new;
end;
$$;

create trigger award_assidu_trophies_after_season_completion
after update of status on public.seasons
for each row
execute function public.award_assidu_trophies_after_season_completion();

create or replace function public.validate_assidu_avatar_glasses()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_glasses_key text;
begin
  if new.avatar_key is null
     or new.avatar_key not like 'director_custom_v1:%' then
    return new;
  end if;

  v_glasses_key := split_part(
    substring(
      new.avatar_key
      from char_length('director_custom_v1:') + 1
    ),
    '.',
    13
  );

  if v_glasses_key <> 'honor-roll' then
    return new;
  end if;

  if not exists (
    select 1
    from public.sporting_director_attendance_trophies as trophy
    where trophy.sporting_director_id = new.id
  ) then
    raise exception
      'Le trophée Assidu est requis pour porter les lunettes Premier de la classe.';
  end if;

  return new;
end;
$$;

create trigger validate_assidu_avatar_glasses_before_write
before insert or update of avatar_key on public.sporting_directors
for each row
execute function public.validate_assidu_avatar_glasses();

insert into public.sporting_director_daily_attendance (
  sporting_director_id,
  season_day_id,
  attended_at
)
select
  claim.sporting_director_id,
  claim.season_day_id,
  min(claim.claimed_at)
from public.daily_reward_claims as claim
group by claim.sporting_director_id, claim.season_day_id
on conflict (sporting_director_id, season_day_id) do nothing;

do $$
declare
  completed_season record;
begin
  for completed_season in
    select season.id
    from public.seasons as season
    where season.status = 'completed'
  loop
    perform public.award_assidu_trophies_for_season(completed_season.id);
  end loop;
end;
$$;

revoke all on function public.record_current_sporting_director_attendance()
  from public, anon;
grant execute on function public.record_current_sporting_director_attendance()
  to authenticated;

revoke all on function public.award_assidu_trophies_for_season(uuid)
  from public, anon, authenticated;
revoke all on function public.award_assidu_trophies_after_season_completion()
  from public, anon, authenticated;
revoke all on function public.validate_assidu_avatar_glasses()
  from public, anon, authenticated;

comment on table public.sporting_director_daily_attendance is
  'Une présence idempotente par Directeur Sportif et par journée de saison visitée.';
comment on table public.sporting_director_attendance_trophies is
  'Trophée Assidu attribué après une présence sur toutes les journées d’une saison terminée.';
comment on function public.record_current_sporting_director_attendance() is
  'Enregistre la visite authentifiée du Directeur Sportif pour la journée de jeu active.';
comment on function public.award_assidu_trophies_for_season(uuid) is
  'Attribue le trophée Assidu aux Directeurs Sportifs présents tous les jours de la saison terminée.';

notify pgrst, 'reload schema';

commit;
