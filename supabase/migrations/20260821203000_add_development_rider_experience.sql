begin;

alter table public.youth_academy_riders
  add column if not exists career_race_days integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'youth_academy_riders_career_race_days_non_negative'
      and conrelid = 'public.youth_academy_riders'::regclass
  ) then
    alter table public.youth_academy_riders
      add constraint youth_academy_riders_career_race_days_non_negative
      check (career_race_days >= 0);
  end if;
end;
$$;

-- Une ligne de résultat d'étape correspond à un départ réel, y compris sur
-- une course d'un jour. Ce recalcul crédite également les courses déjà jouées.
update public.youth_academy_riders as academy
set career_race_days = (
  select count(*)::integer
  from public.development_race_results as result
  where result.academy_rider_id = academy.id
    and result.result_scope = 'stage'
);

-- Les juniors déjà passés professionnels récupèrent leur vécu en Devteam.
update public.riders as rider
set career_race_days = rider.career_race_days + academy.career_race_days
from public.youth_academy_riders as academy
where academy.promoted_rider_id = rider.id
  and academy.career_race_days > 0;

create or replace function public.sync_promoted_rider_from_youth_experience()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta integer;
begin
  if old.promoted_rider_id is distinct from new.promoted_rider_id then
    if old.promoted_rider_id is not null and old.career_race_days > 0 then
      update public.riders
      set career_race_days = greatest(0, career_race_days - old.career_race_days)
      where id = old.promoted_rider_id;
    end if;

    if new.promoted_rider_id is not null and new.career_race_days > 0 then
      update public.riders
      set career_race_days = career_race_days + new.career_race_days
      where id = new.promoted_rider_id;
    end if;
  elsif new.promoted_rider_id is not null
    and old.career_race_days is distinct from new.career_race_days
  then
    v_delta := new.career_race_days - old.career_race_days;
    update public.riders
    set career_race_days = greatest(0, career_race_days + v_delta)
    where id = new.promoted_rider_id;
  end if;

  return new;
end;
$$;

drop trigger if exists youth_experience_syncs_promoted_rider
on public.youth_academy_riders;

create trigger youth_experience_syncs_promoted_rider
after update of promoted_rider_id, career_race_days
on public.youth_academy_riders
for each row
execute function public.sync_promoted_rider_from_youth_experience();

create or replace function public.sync_youth_race_days_from_development_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_counts boolean := false;
  v_new_counts boolean := false;
begin
  if tg_op <> 'INSERT' then
    v_old_counts := old.result_scope = 'stage'
      and old.academy_rider_id is not null;
  end if;

  if tg_op <> 'DELETE' then
    v_new_counts := new.result_scope = 'stage'
      and new.academy_rider_id is not null;
  end if;

  if tg_op = 'UPDATE'
    and v_old_counts = v_new_counts
    and old.academy_rider_id is not distinct from new.academy_rider_id
  then
    return new;
  end if;

  if v_old_counts then
    update public.youth_academy_riders
    set career_race_days = greatest(0, career_race_days - 1),
        updated_at = now()
    where id = old.academy_rider_id;
  end if;

  if v_new_counts then
    update public.youth_academy_riders
    set career_race_days = career_race_days + 1,
        updated_at = now()
    where id = new.academy_rider_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists development_result_syncs_youth_race_days
on public.development_race_results;

create trigger development_result_syncs_youth_race_days
after insert or update or delete
on public.development_race_results
for each row
execute function public.sync_youth_race_days_from_development_result();

revoke all on function public.sync_promoted_rider_from_youth_experience()
from public, anon, authenticated;

revoke all on function public.sync_youth_race_days_from_development_result()
from public, anon, authenticated;

grant select, update on table public.youth_academy_riders to service_role;

comment on column public.youth_academy_riders.career_race_days is
  'Nombre total de jours de course disputés avec une Development Team. Chaque classique ou étape compte une fois.';

comment on function public.sync_youth_race_days_from_development_result() is
  'Maintient de façon idempotente l’expérience des juniors à partir des résultats d’étape Devteam.';

comment on function public.sync_promoted_rider_from_youth_experience() is
  'Transfère et maintient l’expérience acquise en junior sur la fiche professionnelle issue de l’académie.';

commit;
