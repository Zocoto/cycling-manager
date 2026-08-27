begin;

-- Les changements différés doivent mûrir même si aucun DS ne rouvre la page.
-- L'index historique commence par l'équipe et ne couvre pas efficacement le
-- balayage global du job de maintenance.
create index if not exists rider_equipment_pending_effective_idx
  on public.rider_equipment_pending_assignments (effective_at, id);

-- Le règlement d'une équipe passe d'une boucle ligne par ligne à deux écritures
-- ensemblistes. L'upsert et la suppression restent dans la même transaction.
create or replace function public.settle_due_equipment_assignments(
  p_team_season_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
set statement_timeout = '15s'
as $$
declare
  v_settled integer := 0;
begin
  if p_team_season_id is null then
    return 0;
  end if;

  with due as materialized (
    select
      pending.id,
      pending.rider_id,
      pending.slot_type,
      pending.equipment_item_id,
      pending.effective_at
    from public.rider_equipment_pending_assignments as pending
    where pending.team_season_id = p_team_season_id
      and pending.effective_at <= now()
    order by pending.effective_at, pending.requested_at, pending.id
    for update
  ),
  applied as (
    insert into public.rider_equipment_assignments (
      rider_id,
      slot_type,
      equipment_item_id,
      equipped_at
    )
    select
      due.rider_id,
      due.slot_type,
      due.equipment_item_id,
      due.effective_at
    from due
    on conflict (rider_id, slot_type) do update set
      equipment_item_id = excluded.equipment_item_id,
      equipped_at = excluded.equipped_at
    returning rider_id, slot_type
  ),
  removed as (
    delete from public.rider_equipment_pending_assignments as pending
    using due
    where pending.id = due.id
      and exists (
        select 1
        from applied
        where applied.rider_id = due.rider_id
          and applied.slot_type = due.slot_type
      )
    returning pending.id
  )
  select count(*)::integer into v_settled from removed;

  return coalesce(v_settled, 0);
end;
$$;

-- Le job global ignore les rares lignes déjà verrouillées par une action en
-- cours : elles seront reprises au passage suivant sans bloquer les autres clubs.
create or replace function public.settle_all_due_equipment_assignments()
returns integer
language plpgsql
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  v_settled integer := 0;
begin
  with due as materialized (
    select
      pending.id,
      pending.rider_id,
      pending.slot_type,
      pending.equipment_item_id,
      pending.effective_at
    from public.rider_equipment_pending_assignments as pending
    where pending.effective_at <= now()
    order by pending.effective_at, pending.requested_at, pending.id
    for update skip locked
  ),
  applied as (
    insert into public.rider_equipment_assignments (
      rider_id,
      slot_type,
      equipment_item_id,
      equipped_at
    )
    select
      due.rider_id,
      due.slot_type,
      due.equipment_item_id,
      due.effective_at
    from due
    on conflict (rider_id, slot_type) do update set
      equipment_item_id = excluded.equipment_item_id,
      equipped_at = excluded.equipped_at
    returning rider_id, slot_type
  ),
  removed as (
    delete from public.rider_equipment_pending_assignments as pending
    using due
    where pending.id = due.id
      and exists (
        select 1
        from applied
        where applied.rider_id = due.rider_id
          and applied.slot_type = due.slot_type
      )
    returning pending.id
  )
  select count(*)::integer into v_settled from removed;

  return coalesce(v_settled, 0);
end;
$$;

revoke all on function public.settle_due_equipment_assignments(uuid)
  from public, anon, authenticated;
grant execute on function public.settle_due_equipment_assignments(uuid)
  to service_role;

revoke all on function public.settle_all_due_equipment_assignments()
  from public, anon, authenticated;
grant execute on function public.settle_all_due_equipment_assignments()
  to service_role;

-- Une réservation interactive n'a besoin que de connaître la journée active.
-- Le règlement global est déjà idempotent et surveillé par les crons dédiés ;
-- le relancer ici faisait monter un simple enregistrement jusqu'à sept secondes.
do $remove_interactive_health_settlements$
declare
  v_signature regprocedure;
  v_definition text;
  v_patched_definition text;
begin
  foreach v_signature in array array[
    'public.apply_current_team_injury_protocol(uuid,text)'::regprocedure,
    'public.book_current_team_form_camps(uuid[],text,integer,integer)'::regprocedure,
    'public.book_current_team_stage_reconnaissance(uuid,uuid[],uuid)'::regprocedure,
    'public.book_current_team_stage_reconnaissance(uuid,uuid[],integer,uuid)'::regprocedure,
    'public.redeem_injury_care_reward(uuid,uuid)'::regprocedure
  ]
  loop
    select pg_get_functiondef(v_signature) into v_definition;

    if position(
      'perform public.settle_current_health_and_form();' in v_definition
    ) = 0 then
      continue;
    end if;

    v_patched_definition := replace(
      v_definition,
      'perform public.settle_current_health_and_form();',
      'perform public.sync_active_season_day();'
    );
    v_patched_definition := replace(
      v_patched_definition,
      E'perform public.sync_active_season_day();\n  perform public.sync_active_season_day();',
      'perform public.sync_active_season_day();'
    );

    if v_patched_definition = v_definition
      or position(
        'perform public.settle_current_health_and_form();'
        in v_patched_definition
      ) > 0 then
      raise exception 'La fonction % conserve un règlement global interactif.',
        v_signature;
    end if;

    execute v_patched_definition;
  end loop;
end;
$remove_interactive_health_settlements$;

alter table public.game_maintenance_runs
  drop constraint if exists game_maintenance_runs_task_allowed;
alter table public.game_maintenance_runs
  add constraint game_maintenance_runs_task_allowed check (
    task_key in (
      'training',
      'health',
      'staff-academy',
      'infrastructure',
      'equipment',
      'elite-wildcards',
      'development'
    )
  );

insert into public.game_maintenance_runs (task_key)
values ('equipment')
on conflict (task_key) do nothing;

create or replace function public.run_game_maintenance_task(p_task_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '240s'
as $$
declare
  v_result jsonb;
  v_count integer;
  v_processed boolean;
begin
  case p_task_key
    when 'training' then
      select to_jsonb(settlement)
      into v_result
      from public.settle_due_training_sessions_throttled() as settlement;

    when 'health' then
      select to_jsonb(settlement)
      into v_result
      from public.settle_current_health_and_form_throttled() as settlement;

    when 'staff-academy' then
      select public.settle_due_staff_academy_trainings_throttled()
      into v_processed;
      v_result := jsonb_build_object('processed', coalesce(v_processed, false));

    when 'infrastructure' then
      select public.settle_due_infrastructure_projects() into v_count;
      v_result := jsonb_build_object('completedProjects', coalesce(v_count, 0));

    when 'equipment' then
      select public.settle_all_due_equipment_assignments() into v_count;
      v_result := jsonb_build_object(
        'completedAssignments',
        coalesce(v_count, 0)
      );

    when 'elite-wildcards' then
      select to_jsonb(settlement)
      into v_result
      from public.settle_due_elite_wildcards() as settlement;

    when 'development' then
      select public.settle_due_development_races() into v_count;
      v_result := jsonb_build_object('completedRaces', coalesce(v_count, 0));

    else
      raise exception 'Tâche de maintenance inconnue : %', p_task_key;
  end case;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

revoke all on function public.run_game_maintenance_task(text)
  from public, anon, authenticated;
grant execute on function public.run_game_maintenance_task(text)
  to service_role;

comment on function public.settle_due_equipment_assignments(uuid) is
  'Applique par lot les montages échus d’une équipe, sans boucle SQL.';
comment on function public.settle_all_due_equipment_assignments() is
  'Régularise automatiquement tous les montages échus sans bloquer une action interactive en cours.';

notify pgrst, 'reload schema';

commit;
