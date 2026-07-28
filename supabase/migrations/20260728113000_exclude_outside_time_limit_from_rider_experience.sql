begin;

-- Un coureur hors délais a bien pris le départ, mais cette étape ne valide
-- aucun jour de course pour l'expérience. Corrige une seule fois les lignes
-- historiques éventuellement comptées par la migration initiale.
with outside_time_limit_days as (
  select
    roster.rider_id,
    count(*)::integer as race_days
  from public.stage_results as result
  join public.race_rosters as roster
    on roster.id = result.race_roster_id
  where result.status = 'outside_time_limit'
  group by roster.rider_id
)
update public.riders as rider
set career_race_days = greatest(
  0,
  rider.career_race_days - outside_time_limit_days.race_days
)
from outside_time_limit_days
where outside_time_limit_days.rider_id = rider.id;

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
    v_old_counts := old.status not in (
      'did_not_start',
      'outside_time_limit'
    );

    if v_old_counts then
      select roster.rider_id
      into v_old_rider_id
      from public.race_rosters as roster
      where roster.id = old.race_roster_id;
    end if;
  end if;

  if tg_op <> 'DELETE' then
    v_new_counts := new.status not in (
      'did_not_start',
      'outside_time_limit'
    );

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

revoke all on function public.sync_rider_race_days_from_stage_result()
from public, anon, authenticated;

comment on column public.riders.career_race_days is
  'Nombre total d''étapes validées dans la carrière du coureur. Les non-partants et coureurs hors délais sont exclus.';

comment on function public.sync_rider_race_days_from_stage_result() is
  'Maintient les jours de course à partir des résultats officiels, sans compter les non-partants ni les coureurs hors délais.';

commit;
