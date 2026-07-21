-- ============================================================
-- Repos automatique sous le seuil de forme du Directeur Sportif
-- ============================================================

begin;

-- Le moteur d'entraînement crée déjà une séance skipped_low_form de manière
-- idempotente. Cette fonction crédite la récupération une seule fois en
-- s'appuyant sur le registre quotidien partagé avec les autres effets de forme.
create or replace function public.apply_low_form_training_recovery(
  p_training_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_effect_id uuid;
  v_form_delta integer;
  v_form_after integer;
begin
  select session.*
  into v_session
  from public.rider_training_sessions as session
  where session.id = p_training_session_id
  for update;

  if v_session is null
    or v_session.status <> 'skipped_low_form'
    or v_session.form_delta <> 0
  then
    return;
  end if;

  v_form_delta := least(2, 100 - v_session.form_before);
  v_form_after := v_session.form_before + v_form_delta;

  insert into public.rider_daily_condition_effects (
    rider_id,
    season_day_id,
    effect_type,
    form_delta,
    form_before,
    form_after
  ) values (
    v_session.rider_id,
    v_session.season_day_id,
    'training',
    v_form_delta,
    v_session.form_before,
    v_form_after
  )
  on conflict (rider_id, season_day_id) do nothing
  returning id into v_effect_id;

  if v_effect_id is null then
    return;
  end if;

  update public.rider_training_sessions
  set
    form_delta = v_form_delta,
    form_after = v_form_after
  where id = v_session.id;

  insert into public.rider_condition_states (
    rider_id,
    season_day_id,
    form,
    fatigue,
    source
  ) values (
    v_session.rider_id,
    v_session.season_day_id,
    v_form_after,
    0,
    'training'
  )
  on conflict (rider_id, season_day_id)
  do update set
    form = greatest(
      0,
      least(100, public.rider_condition_states.form + v_form_delta)
    ),
    fatigue = 0,
    source = 'training',
    updated_at = now();
end;
$$;

create or replace function public.apply_low_form_training_recovery_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.apply_low_form_training_recovery(new.id);
  return null;
end;
$$;

create trigger apply_low_form_training_recovery_after_insert
after insert on public.rider_training_sessions
for each row
when (new.status = 'skipped_low_form')
execute function public.apply_low_form_training_recovery_after_insert();

-- Rattrapage limité à la journée active : il corrige les séances de 8 h déjà
-- réglées aujourd'hui sans réécrire l'historique des jours précédents.
do $$
declare
  v_session record;
begin
  for v_session in
    select session.id
    from public.rider_training_sessions as session
    join public.seasons as season
      on season.id = session.season_id
     and season.status = 'active'
    join public.season_days as day
      on day.id = session.season_day_id
     and day.day_number = coalesce(season.current_day_number, 1)
    where session.status = 'skipped_low_form'
      and session.form_delta = 0
  loop
    perform public.apply_low_form_training_recovery(v_session.id);
  end loop;
end;
$$;

revoke all on function public.apply_low_form_training_recovery(uuid) from public;
grant execute on function public.apply_low_form_training_recovery(uuid) to service_role;

revoke all on function public.apply_low_form_training_recovery_after_insert() from public;

comment on function public.apply_low_form_training_recovery(uuid) is
  'Crédite une seule fois jusqu’à 2 points de forme lorsqu’une séance est annulée par le seuil du DS.';

notify pgrst, 'reload schema';

commit;
