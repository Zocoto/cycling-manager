begin;

-- An official replay can replace an already homologated classification while
-- the race edition remains `completed`. The regular evaluator deliberately
-- keeps terminal objective states stable, so explicitly reopen only the
-- unsettled race objectives that point at the corrected edition before asking
-- the canonical evaluator to calculate them again.
create or replace function public.reconcile_sponsor_race_objectives_for_edition(
  p_race_edition_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_edition record;
  v_contract record;
  v_reopened_count integer := 0;
  v_contract_reopened_count integer;
begin
  select edition.id, edition.race_id, edition.season_id
  into v_edition
  from public.race_editions as edition
  where edition.id = p_race_edition_id;

  if v_edition is null then
    return 0;
  end if;

  for v_contract in
    select distinct progress.team_sponsor_contract_id as contract_id
    from public.sponsor_objectives as objective
    join public.objective_progress as progress
      on progress.sponsor_objective_id = objective.id
     and progress.season_id = objective.season_id
    join public.team_sponsor_contracts as contract
      on contract.id = progress.team_sponsor_contract_id
     and contract.sponsor_offer_id = objective.sponsor_offer_id
    where objective.objective_type = 'race_result'
      and objective.status <> 'cancelled'
      and objective.season_id = v_edition.season_id
      and progress.settled_at is null
      and contract.status in ('active', 'completed')
      and (
        case
          when coalesce(objective.target_details ->> 'raceEditionId', '') ~*
            '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            then (objective.target_details ->> 'raceEditionId')::uuid = v_edition.id
          else
            coalesce(objective.target_details ->> 'raceId', '') ~*
              '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            and (objective.target_details ->> 'raceId')::uuid = v_edition.race_id
        end
      )
  loop
    update public.objective_progress as progress
    set
      status = 'in_progress',
      achieved_at = null,
      updated_at = now()
    from public.sponsor_objectives as objective
    where objective.id = progress.sponsor_objective_id
      and progress.team_sponsor_contract_id = v_contract.contract_id
      and progress.season_id = v_edition.season_id
      and progress.settled_at is null
      and objective.objective_type = 'race_result'
      and objective.status <> 'cancelled'
      and (
        case
          when coalesce(objective.target_details ->> 'raceEditionId', '') ~*
            '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            then (objective.target_details ->> 'raceEditionId')::uuid = v_edition.id
          else
            coalesce(objective.target_details ->> 'raceId', '') ~*
              '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            and (objective.target_details ->> 'raceId')::uuid = v_edition.race_id
        end
      );

    get diagnostics v_contract_reopened_count = row_count;
    v_reopened_count := v_reopened_count + v_contract_reopened_count;

    update public.sponsor_objectives as objective
    set status = 'active', updated_at = now()
    where objective.objective_type = 'race_result'
      and objective.status <> 'cancelled'
      and objective.season_id = v_edition.season_id
      and exists (
        select 1
        from public.objective_progress as progress
        where progress.sponsor_objective_id = objective.id
          and progress.team_sponsor_contract_id = v_contract.contract_id
          and progress.season_id = v_edition.season_id
          and progress.settled_at is null
      )
      and (
        case
          when coalesce(objective.target_details ->> 'raceEditionId', '') ~*
            '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            then (objective.target_details ->> 'raceEditionId')::uuid = v_edition.id
          else
            coalesce(objective.target_details ->> 'raceId', '') ~*
              '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            and (objective.target_details ->> 'raceId')::uuid = v_edition.race_id
        end
      );

    perform public.evaluate_sponsor_objectives_for_contract(
      v_contract.contract_id,
      false
    );
  end loop;

  return v_reopened_count;
end;
$$;

create or replace function private.reconcile_sponsor_objectives_after_official_replay()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.after_summary ->> 'status' = 'applied' then
    perform public.reconcile_sponsor_race_objectives_for_edition(
      new.race_edition_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists reconcile_sponsor_objectives_after_replay_insert
  on public.official_race_historical_corrections;
create trigger reconcile_sponsor_objectives_after_replay_insert
after insert on public.official_race_historical_corrections
for each row
execute function private.reconcile_sponsor_objectives_after_official_replay();

drop trigger if exists reconcile_sponsor_objectives_after_replay_update
  on public.official_race_historical_corrections;
create trigger reconcile_sponsor_objectives_after_replay_update
after update of after_summary on public.official_race_historical_corrections
for each row
when (old.after_summary is distinct from new.after_summary)
execute function private.reconcile_sponsor_objectives_after_official_replay();

revoke all
on function public.reconcile_sponsor_race_objectives_for_edition(uuid)
from public, anon, authenticated;
grant execute
on function public.reconcile_sponsor_race_objectives_for_edition(uuid)
to service_role;

revoke all
on function private.reconcile_sponsor_objectives_after_official_replay()
from public, anon, authenticated;

-- Reconcile repairs that were applied before the automatic hook existed.
do $backfill_applied_official_replays$
declare
  v_correction record;
begin
  for v_correction in
    select distinct correction.race_edition_id
    from public.official_race_historical_corrections as correction
    where correction.after_summary ->> 'status' = 'applied'
  loop
    perform public.reconcile_sponsor_race_objectives_for_edition(
      v_correction.race_edition_id
    );
  end loop;
end;
$backfill_applied_official_replays$;

comment on function public.reconcile_sponsor_race_objectives_for_edition(uuid)
is 'Rouvre puis réévalue de manière idempotente les objectifs sponsor de course non réglés après la correction officielle d un classement.';

notify pgrst, 'reload schema';

commit;
