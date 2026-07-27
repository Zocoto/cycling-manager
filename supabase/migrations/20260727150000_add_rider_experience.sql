begin;

alter table public.riders
  add column if not exists career_race_days integer not null default 0;

alter table public.riders
  add constraint riders_career_race_days_non_negative
  check (career_race_days >= 0);

create or replace function public.estimate_initial_rider_race_days(
  p_age integer
)
returns integer
language sql
immutable
strict
set search_path = ''
as $$
  select least(540, greatest(0, p_age - 18) * 18)::integer;
$$;

-- Les carrières créées avant le suivi des résultats disposent d'un historique
-- initial comprimé. Les résultats officiels déjà enregistrés sont ajoutés à ce
-- socle afin que les coureurs expérimentés le soient dès le déploiement.
with first_rating as (
  select distinct on (rating.rider_id)
    rating.rider_id,
    rating.age
  from public.rider_season_ratings as rating
  join public.seasons as season
    on season.id = rating.season_id
  order by
    rating.rider_id,
    season.game_year,
    rating.created_at
),
recorded_race_days as (
  select
    roster.rider_id,
    count(*)::integer as race_days
  from public.stage_results as result
  join public.race_rosters as roster
    on roster.id = result.race_roster_id
  where result.status <> 'did_not_start'
  group by roster.rider_id
)
update public.riders as rider
set career_race_days = greatest(
  rider.career_race_days,
  coalesce(
    public.estimate_initial_rider_race_days(first_rating.age),
    0
  ) + coalesce(recorded_race_days.race_days, 0)
)
from first_rating
left join recorded_race_days
  on recorded_race_days.rider_id = first_rating.rider_id
where first_rating.rider_id = rider.id;

create or replace function public.initialize_rider_experience_from_first_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.rider_season_ratings as existing
    where existing.rider_id = new.rider_id
      and existing.id <> new.id
  ) then
    update public.riders
    set career_race_days = greatest(
      career_race_days,
      public.estimate_initial_rider_race_days(new.age)
    )
    where id = new.rider_id
      and career_race_days = 0;
  end if;

  return new;
end;
$$;

drop trigger if exists rider_first_rating_initializes_experience
on public.rider_season_ratings;

create trigger rider_first_rating_initializes_experience
after insert on public.rider_season_ratings
for each row
execute function public.initialize_rider_experience_from_first_rating();

create or replace function public.sync_rider_race_days_from_stage_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_rider_id uuid;
  v_new_rider_id uuid;
  v_old_counts boolean := false;
  v_new_counts boolean := false;
begin
  if tg_op <> 'INSERT' then
    v_old_counts := old.status <> 'did_not_start';

    if v_old_counts then
      select roster.rider_id
      into v_old_rider_id
      from public.race_rosters as roster
      where roster.id = old.race_roster_id;
    end if;
  end if;

  if tg_op <> 'DELETE' then
    v_new_counts := new.status <> 'did_not_start';

    if v_new_counts then
      select roster.rider_id
      into v_new_rider_id
      from public.race_rosters as roster
      where roster.id = new.race_roster_id;
    end if;
  end if;

  if tg_op = 'UPDATE'
    and v_old_counts = v_new_counts
    and old.race_roster_id = new.race_roster_id
  then
    return new;
  end if;

  if v_old_counts and v_old_rider_id is not null then
    update public.riders
    set career_race_days = greatest(0, career_race_days - 1)
    where id = v_old_rider_id;
  end if;

  if v_new_counts and v_new_rider_id is not null then
    update public.riders
    set career_race_days = career_race_days + 1
    where id = v_new_rider_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists stage_result_syncs_rider_race_days
on public.stage_results;

create trigger stage_result_syncs_rider_race_days
after insert or update or delete on public.stage_results
for each row
execute function public.sync_rider_race_days_from_stage_result();

revoke all on function public.initialize_rider_experience_from_first_rating()
from public, anon, authenticated;

revoke all on function public.sync_rider_race_days_from_stage_result()
from public, anon, authenticated;

grant select, update on table public.riders to service_role;

comment on column public.riders.career_race_days is
  'Nombre total d''étapes effectivement disputées dans la carrière du coureur. Les non-partants sont exclus.';

comment on function public.estimate_initial_rider_race_days(integer) is
  'Estime le passé sportif comprimé d''un coureur créé sans historique de résultats antérieur.';

comment on function public.sync_rider_race_days_from_stage_result() is
  'Maintient de façon idempotente les jours de course à partir des résultats d''étape officiels.';

commit;
