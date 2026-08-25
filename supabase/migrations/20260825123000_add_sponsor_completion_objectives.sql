begin;

-- Une seule métrique sert les quatre paliers : get_current_game_objectives
-- la matérialise une fois par requête, quel que soit le nombre de récompenses.
alter function public.calculate_game_objective_progress(text, uuid, uuid, numeric)
  rename to calculate_game_objective_progress_pre_sponsor_completion;

create or replace function public.calculate_game_objective_progress(
  p_metric_key text,
  p_director_id uuid,
  p_current_team_id uuid,
  p_experience_points numeric
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_value integer;
begin
  case p_metric_key
    when 'completed_sponsor_objectives' then
      select count(distinct progress.id)::integer
      into v_value
      from public.team_manager_assignments as assignment
      join public.team_sponsor_contracts as contract
        on contract.team_id = assignment.team_id
      join public.objective_progress as progress
        on progress.team_sponsor_contract_id = contract.id
       and progress.status = 'achieved'
      where assignment.sporting_director_id = p_director_id
        and assignment.role = 'general_manager';

    else
      return public.calculate_game_objective_progress_pre_sponsor_completion(
        p_metric_key,
        p_director_id,
        p_current_team_id,
        p_experience_points
      );
  end case;

  return greatest(coalesce(v_value, 0), 0);
end;
$$;

-- Accélère à la fois la métrique de carrière et les lectures des accomplissements
-- sans alourdir les écritures des objectifs encore en cours ou échoués.
create index if not exists objective_progress_achieved_contract_idx
  on public.objective_progress (team_sponsor_contract_id)
  where status = 'achieved';

insert into public.game_objective_definitions (
  objective_key,
  objective_type,
  objective_group,
  title,
  description,
  metric_key,
  target_value,
  reward_cash,
  reward_experience,
  reward_reputation,
  reward_inventory_item_key,
  reward_equipment_catalog_key,
  reward_random_special_ability,
  display_order,
  is_active
)
values
  (
    'sponsor_objective_1', 'secondary', 'sponsoring',
    'Parole tenue',
    'Valider un premier objectif fixé par un sponsor principal.',
    'completed_sponsor_objectives', 1,
    3000, 15, 0, null, null, false, 920, true
  ),
  (
    'sponsor_objective_5', 'secondary', 'sponsoring',
    'Sponsor convaincu',
    'Valider cinq objectifs de sponsors principaux au cours de sa carrière.',
    'completed_sponsor_objectives', 5,
    10000, 45, 1, null, null, false, 930, true
  ),
  (
    'sponsor_objective_10', 'secondary', 'sponsoring',
    'Dix engagements tenus',
    'Valider dix objectifs de sponsors principaux au cours de sa carrière.',
    'completed_sponsor_objectives', 10,
    25000, 100, 2, null, null, true, 940, true
  ),
  (
    'sponsor_objective_25', 'secondary', 'sponsoring',
    'Partenaire de référence',
    'Valider vingt-cinq objectifs de sponsors principaux au cours de sa carrière.',
    'completed_sponsor_objectives', 25,
    60000, 220, 5, 'potential-spark', null, false, 950, true
  )
on conflict (objective_key) do update set
  objective_type = excluded.objective_type,
  objective_group = excluded.objective_group,
  title = excluded.title,
  description = excluded.description,
  metric_key = excluded.metric_key,
  target_value = excluded.target_value,
  reward_cash = excluded.reward_cash,
  reward_experience = excluded.reward_experience,
  reward_reputation = excluded.reward_reputation,
  reward_inventory_item_key = excluded.reward_inventory_item_key,
  reward_equipment_catalog_key = excluded.reward_equipment_catalog_key,
  reward_random_special_ability = excluded.reward_random_special_ability,
  display_order = excluded.display_order,
  is_active = excluded.is_active,
  updated_at = now();

revoke all
on function public.calculate_game_objective_progress(text, uuid, uuid, numeric)
from public, anon, authenticated;
grant execute
on function public.calculate_game_objective_progress(text, uuid, uuid, numeric)
to service_role;

comment on function public.calculate_game_objective_progress(text, uuid, uuid, numeric) is
  'Calcule les objectifs de carrière, dont le nombre cumulé d’objectifs de sponsors principaux validés par le DS.';

notify pgrst, 'reload schema';

commit;
