begin;

-- La R&D ne facture plus de trésorerie. L'ancien talent de réduction de coût
-- conserve sa valeur en devenant une réduction proportionnelle de durée.
update public.staff_talent_catalog
set display_name = 'Optimisation des ressources'
where code = 'research_cost';

create or replace function public.calculate_equipment_rnd_bonus_total(
  p_effect_payload jsonb
)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  with bonus_values as (
    select bonus.value
    from jsonb_each(
      case
        when jsonb_typeof(p_effect_payload -> 'ratingBonuses') = 'object'
          then p_effect_payload -> 'ratingBonuses'
        else '{}'::jsonb
      end
    ) as bonus(key, value)
    where jsonb_typeof(bonus.value) = 'number'

    union all

    select bonus.value
    from jsonb_each(
      case
        when jsonb_typeof(p_effect_payload -> 'timeTrialRatingBonuses') = 'object'
          then p_effect_payload -> 'timeTrialRatingBonuses'
        else '{}'::jsonb
      end
    ) as bonus(key, value)
    where jsonb_typeof(bonus.value) = 'number'
  )
  select greatest(
    0,
    least(
      1000000,
      floor(coalesce(sum((value #>> '{}')::numeric), 0))
    )
  )::integer
  from bonus_values;
$$;

create or replace function public.calculate_equipment_rnd_base_duration_days(
  p_effect_payload jsonb
)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  with score as (
    select public.calculate_equipment_rnd_bonus_total(p_effect_payload) as value
  )
  select case
    when value = 0 then 1
    when value = 1 then 3
    when value = 2 then 5
    when value >= 17 then 100000
    else least(100000, (5 * power(2::numeric, value - 2))::integer)
  end
  from score;
$$;

create or replace function public.calculate_equipment_rnd_duration_days(
  p_effect_payload jsonb,
  p_engineer_level integer,
  p_has_research_time boolean,
  p_has_research_cost boolean
)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select greatest(
    1,
    ceil(
      public.calculate_equipment_rnd_base_duration_days(p_effect_payload)
      * (
        1 - case
          when coalesce(p_has_research_cost, false)
            then least(90, greatest(0, coalesce(p_engineer_level, 0)) * 5) / 100.0
          else 0
        end
      )
    )::integer
    - case
      when coalesce(p_has_research_time, false)
        then greatest(0, coalesce(p_engineer_level, 0))
      else 0
    end
  );
$$;

drop index if exists public.equipment_rnd_one_active_idx;

create unique index if not exists equipment_rnd_one_active_per_engineer_idx
  on public.equipment_rnd_projects(engineer_contract_id)
  where status = 'active' and engineer_contract_id is not null;

create index if not exists equipment_rnd_active_team_idx
  on public.equipment_rnd_projects(team_id, created_at desc)
  where status = 'active';

create index if not exists equipment_rnd_due_idx
  on public.equipment_rnd_projects(completes_game_day_index, team_id)
  where status = 'active';

create index if not exists equipment_rnd_team_history_idx
  on public.equipment_rnd_projects(team_id, created_at desc)
  where status <> 'cancelled';

alter function public.settle_due_equipment_rnd_projects()
  set statement_timeout = '0';

create or replace function public.start_current_team_equipment_rnd(
  p_equipment_item_id uuid,
  p_engineer_contract_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
set statement_timeout = '0'
as $$
declare
  v_context record;
  v_item record;
  v_level integer;
  v_required integer;
  v_owned integer;
  v_used integer;
  v_pending integer;
  v_engineer_member_id uuid;
  v_engineer_level integer := 0;
  v_engineer_count integer := 0;
  v_active_project_count integer := 0;
  v_has_research_time boolean := false;
  v_has_research_cost boolean := false;
  v_has_research_success boolean := false;
  v_success integer;
  v_duration integer;
  v_game_day integer;
  v_id uuid;
begin
  if p_equipment_item_id is null then
    raise exception 'Sélectionnez un équipement à confier au laboratoire.';
  end if;
  if p_engineer_contract_id is null then
    raise exception 'Sélectionnez un ingénieur R&D disponible.';
  end if;

  perform public.settle_due_equipment_rnd_projects();

  select
    assignment.team_id,
    season.id as season_id,
    season.game_year,
    season.current_day_number,
    team_season.id as team_season_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season
    on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active.';
  end if;

  -- Sérialise les lancements d'une même équipe. L'index par ingénieur reste
  -- la protection finale contre deux requêtes concurrentes identiques.
  perform 1
  from public.team_seasons
  where id = v_context.team_season_id
  for update;

  select coalesce(max(level), 0)
  into v_level
  from public.team_infrastructures
  where team_id = v_context.team_id
    and infrastructure_code = 'research_lab';

  if v_level < 1 then
    raise exception 'Construisez d’abord le Laboratoire R&D.';
  end if;

  select member.id, member.level
  into v_engineer_member_id, v_engineer_level
  from public.staff_contracts as contract
  join public.staff_members as member
    on member.id = contract.staff_member_id
   and member.role = 'research_engineer'
  where contract.id = p_engineer_contract_id
    and contract.team_id = v_context.team_id
    and contract.status = 'active'
  for update of contract;

  if v_engineer_member_id is null then
    raise exception 'Cet ingénieur R&D n’appartient pas au staff actif de votre équipe.';
  end if;

  select
    coalesce(bool_or(talent.talent_code = 'research_time'), false),
    coalesce(bool_or(talent.talent_code = 'research_cost'), false),
    coalesce(bool_or(talent.talent_code = 'research_success'), false)
  into
    v_has_research_time,
    v_has_research_cost,
    v_has_research_success
  from public.staff_member_talents as talent
  where talent.staff_member_id = v_engineer_member_id;

  if exists (
    select 1
    from public.equipment_rnd_projects
    where engineer_contract_id = p_engineer_contract_id
      and status = 'active'
  ) then
    raise exception 'Cet ingénieur pilote déjà une recherche R&D.';
  end if;

  select count(*)::integer
  into v_engineer_count
  from public.staff_contracts as contract
  join public.staff_members as member
    on member.id = contract.staff_member_id
   and member.role = 'research_engineer'
  where contract.team_id = v_context.team_id
    and contract.status = 'active';

  select count(*)::integer
  into v_active_project_count
  from public.equipment_rnd_projects
  where team_id = v_context.team_id
    and status = 'active';

  if v_active_project_count >= v_engineer_count then
    raise exception 'Tous vos ingénieurs R&D pilotent déjà une recherche.';
  end if;

  select *
  into v_item
  from public.equipment_catalog_items
  where id = p_equipment_item_id
    and status = 'active'
    and acquisition_channel <> 'equipment_partner'
    and (owner_team_id is null or owner_team_id = v_context.team_id);

  if v_item is null then
    raise exception 'Cet équipement ne peut pas être soumis à la R&D.';
  end if;

  v_required := case v_item.slot_type
    when 'frame' then 1
    when 'front_wheel' then 2
    when 'rear_wheel' then 2
    when 'helmet' then 3
    when 'shoes' then 4
    when 'bib_shorts' then 5
    when 'gloves' then 6
    when 'glasses' then 7
    else 99
  end;

  if v_level < v_required then
    raise exception 'Le niveau du laboratoire ne débloque pas encore cette catégorie.';
  end if;

  select quantity
  into v_owned
  from public.team_equipment_inventory
  where team_season_id = v_context.team_season_id
    and equipment_item_id = p_equipment_item_id
  for update;

  select count(*)::integer
  into v_used
  from public.rider_equipment_assignments as assignment
  join public.rider_contracts as contract
    on contract.rider_id = assignment.rider_id
   and contract.team_id = v_context.team_id
   and contract.status = 'active'
  where assignment.equipment_item_id = p_equipment_item_id;

  select count(*)::integer
  into v_pending
  from public.rider_equipment_pending_assignments as pending
  where pending.team_season_id = v_context.team_season_id
    and pending.equipment_item_id = p_equipment_item_id;

  if coalesce(v_owned, 0) <= coalesce(v_used, 0) + coalesce(v_pending, 0) then
    raise exception 'Aucun exemplaire libre de cette référence n’est disponible.';
  end if;

  v_success := least(
    95,
    45 + round(
      v_level * 5 * public.get_team_infrastructure_efficiency_multiplier(
        v_context.team_id,
        'research_lab'
      )
    )::integer +
      case when v_has_research_success then v_engineer_level * 3 else 0 end
  );
  v_duration := public.calculate_equipment_rnd_duration_days(
    v_item.effect_payload,
    v_engineer_level,
    v_has_research_time,
    v_has_research_cost
  );

  if v_owned > 1 then
    update public.team_equipment_inventory
    set quantity = quantity - 1
    where team_season_id = v_context.team_season_id
      and equipment_item_id = p_equipment_item_id;
  else
    delete from public.team_equipment_inventory
    where team_season_id = v_context.team_season_id
      and equipment_item_id = p_equipment_item_id;
  end if;

  v_game_day := v_context.game_year * 28 + v_context.current_day_number - 1;

  insert into public.equipment_rnd_projects (
    team_id,
    started_team_season_id,
    input_equipment_item_id,
    engineer_contract_id,
    lab_level,
    success_rate,
    research_cost,
    starts_game_day_index,
    completes_game_day_index
  ) values (
    v_context.team_id,
    v_context.team_season_id,
    p_equipment_item_id,
    p_engineer_contract_id,
    v_level,
    v_success,
    0,
    v_game_day,
    v_game_day + v_duration
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Les recherches actives adoptent immédiatement le barème de la pièce qui a
-- été consommée. Aucun débit historique n'est modifié ou rejoué.
with recalculated as (
  select
    project.id,
    public.calculate_equipment_rnd_duration_days(
      item.effect_payload,
      coalesce(member.level, 0),
      coalesce(talents.has_research_time, false),
      coalesce(talents.has_research_cost, false)
    ) as duration_days
  from public.equipment_rnd_projects as project
  join public.equipment_catalog_items as item
    on item.id = project.input_equipment_item_id
  left join public.staff_contracts as contract
    on contract.id = project.engineer_contract_id
  left join public.staff_members as member
    on member.id = contract.staff_member_id
   and member.role = 'research_engineer'
  left join lateral (
    select
      coalesce(bool_or(talent.talent_code = 'research_time'), false)
        as has_research_time,
      coalesce(bool_or(talent.talent_code = 'research_cost'), false)
        as has_research_cost
    from public.staff_member_talents as talent
    where talent.staff_member_id = member.id
  ) as talents on true
  where project.status = 'active'
)
update public.equipment_rnd_projects as project
set completes_game_day_index =
  project.starts_game_day_index + recalculated.duration_days
from recalculated
where recalculated.id = project.id;

revoke all on function public.calculate_equipment_rnd_bonus_total(jsonb)
from public, anon;
revoke all on function public.calculate_equipment_rnd_base_duration_days(jsonb)
from public, anon;
revoke all on function public.calculate_equipment_rnd_duration_days(jsonb, integer, boolean, boolean)
from public, anon;
revoke all on function public.start_current_team_equipment_rnd(uuid, uuid)
from public, anon;

grant execute on function public.calculate_equipment_rnd_bonus_total(jsonb)
to authenticated, service_role;
grant execute on function public.calculate_equipment_rnd_base_duration_days(jsonb)
to authenticated, service_role;
grant execute on function public.calculate_equipment_rnd_duration_days(jsonb, integer, boolean, boolean)
to authenticated, service_role;
grant execute on function public.start_current_team_equipment_rnd(uuid, uuid)
to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
