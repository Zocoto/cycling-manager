begin;

-- Les jours de course correspondent uniquement aux jours réellement disputés.
-- Supprime le socle artificiel auparavant déduit de l'âge du coureur.
drop trigger if exists rider_first_rating_initializes_experience
on public.rider_season_ratings;

drop function if exists public.initialize_rider_experience_from_first_rating();
drop function if exists public.estimate_initial_rider_race_days(integer);

-- Recalcule toute la base depuis les résultats officiels. COUNT renvoie zéro
-- pour les juniors et coureurs d'enchères qui n'ont encore pris aucun départ.
update public.riders as rider
set career_race_days = (
  select count(*)::integer
  from public.stage_results as result
  join public.race_rosters as roster
    on roster.id = result.race_roster_id
  where roster.rider_id = rider.id
    and result.status <> 'did_not_start'
);

-- Les fiches historiques conservent le même total corrigé.
update public.rider_history_archives as archive
set career_race_days = rider.career_race_days
from public.riders as rider
where rider.id = archive.rider_id;

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

  update public.rider_history_archives as archive
  set career_race_days = rider.career_race_days
  from public.riders as rider
  where rider.id = archive.rider_id
    and rider.id in (v_old_rider_id, v_new_rider_id);

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_rider_race_days_from_stage_result()
from public, anon, authenticated;

comment on column public.riders.career_race_days is
  'Nombre total de jours de course réellement disputés. Chaque classique ou étape commencée compte une fois ; les non-partants sont exclus.';

comment on function public.sync_rider_race_days_from_stage_result() is
  'Maintient les jours de course après chaque changement de résultat et synchronise les fiches historiques.';

commit;
