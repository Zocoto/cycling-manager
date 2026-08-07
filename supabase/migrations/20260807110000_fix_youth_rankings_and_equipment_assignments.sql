begin;

-- Le classement des jeunes suit le classement général final : un coureur qui
-- ne repart pas sur une étape suivante ne peut plus y figurer.
create temporary table youth_ranking_repairs on commit drop as
with eligible as (
  select
    edition.id as race_edition_id,
    edition.season_id,
    edition.race_category_id,
    result.race_roster_id,
    result.total_time_ms,
    row_number() over (
      partition by edition.id
      order by result.final_rank
    )::integer as rank
  from public.race_editions as edition
  join public.races as race
    on race.id = edition.race_id
   and race.race_format = 'stage_race'
  join public.race_results as result
    on result.race_edition_id = edition.id
   and result.status = 'classified'
   and result.final_rank is not null
  join public.race_rosters as roster
    on roster.id = result.race_roster_id
  join public.rider_season_ratings as rating
    on rating.rider_id = roster.rider_id
   and rating.season_id = edition.season_id
   and rating.age < 25
  where edition.status = 'completed'
)
select
  eligible.*,
  previous.race_roster_id as previous_winner_roster_id
from eligible
left join public.race_secondary_results as previous
  on previous.race_edition_id = eligible.race_edition_id
 and previous.classification_type = 'youth'
 and previous.rank = 1;

create temporary table youth_ranking_winner_corrections on commit drop as
select
  repair.race_edition_id,
  repair.season_id,
  repair.race_category_id,
  repair.previous_winner_roster_id,
  repair.race_roster_id as corrected_winner_roster_id
from youth_ranking_repairs as repair
where repair.rank = 1
  and repair.previous_winner_roster_id is distinct from repair.race_roster_id;

delete from public.race_secondary_results as secondary
using public.race_editions as edition
join public.races as race
  on race.id = edition.race_id
 and race.race_format = 'stage_race'
where secondary.race_edition_id = edition.id
  and edition.status = 'completed'
  and secondary.classification_type = 'youth';

insert into public.race_secondary_results (
  race_edition_id,
  classification_type,
  race_roster_id,
  team_season_id,
  rank,
  points,
  total_time_ms
)
select
  repair.race_edition_id,
  'youth',
  repair.race_roster_id,
  null,
  repair.rank,
  null,
  repair.total_time_ms
from youth_ranking_repairs as repair
order by repair.race_edition_id, repair.rank;

do $$
declare
  correction record;
  reward_values record;
  previous_reward public.reward_events%rowtype;
  final_stage_id uuid;
begin
  for correction in
    select
      winner_correction.*,
      category.code as category_code,
      edition.display_name
    from youth_ranking_winner_corrections as winner_correction
    join public.race_categories as category
      on category.id = winner_correction.race_category_id
    join public.race_editions as edition
      on edition.id = winner_correction.race_edition_id
  loop
    if exists (
      select 1
      from public.reward_events
      where source_reference =
        'youth-ranking-correction:' || correction.race_edition_id::text || ':v1'
    ) then
      continue;
    end if;

    select * into reward_values
    from (
      values
        ('national'::text, 1, 30, 700::numeric, 18),
        ('continental'::text, 2, 55, 1800::numeric, 35),
        ('world'::text, 3, 85, 4500::numeric, 70),
        ('elite'::text, 3, 120, 9000::numeric, 140)
    ) as scale(category_code, reputation_points, experience_points, cash_prize, uci_points)
    where scale.category_code = correction.category_code;

    if reward_values is null then
      raise exception 'Barème jeune introuvable pour la catégorie %.', correction.category_code;
    end if;

    select reward.* into previous_reward
    from public.reward_events as reward
    join public.race_rosters as roster
      on roster.rider_id = reward.rider_id
    where roster.id = correction.previous_winner_roster_id
      and reward.source_reference =
        'official-race:' || correction.race_edition_id::text || ':rider:' || roster.rider_id::text || ':v1'
    for update;

    if previous_reward.id is not null then
      update public.reward_events
      set
        reputation_points = greatest(0, reputation_points - reward_values.reputation_points),
        experience_points = greatest(0, experience_points - reward_values.experience_points),
        cash_prize = greatest(0, cash_prize - reward_values.cash_prize),
        uci_points = greatest(0, uci_points - reward_values.uci_points),
        description = description || ' · prime jeune annulée après correction du classement'
      where id = previous_reward.id;

      update public.sporting_directors
      set
        reputation_points = greatest(0, reputation_points - reward_values.reputation_points),
        experience_points = greatest(0, experience_points - reward_values.experience_points)
      where id = previous_reward.sporting_director_id;

      update public.team_seasons
      set
        points = greatest(0, points - reward_values.uci_points),
        cash_balance = cash_balance - reward_values.cash_prize
      where id = previous_reward.team_season_id;

      update public.rider_season_summaries
      set points = greatest(0, points - reward_values.uci_points), updated_at = now()
      where rider_id = previous_reward.rider_id
        and season_id = correction.season_id;

      update public.team_finance_transactions
      set amount = amount - reward_values.cash_prize
      where team_season_id = previous_reward.team_season_id
        and source_reference = 'reward:' || previous_reward.source_reference;
    end if;

    select stage.id into final_stage_id
    from public.stages as stage
    where stage.race_edition_id = correction.race_edition_id
    order by stage.stage_number desc
    limit 1;

    perform public.apply_race_roster_competition_reward(
      'youth-ranking-correction:' || correction.race_edition_id::text || ':v1',
      'secondary_classification',
      correction.corrected_winner_roster_id,
      final_stage_id,
      reward_values.reputation_points,
      reward_values.experience_points,
      reward_values.cash_prize,
      reward_values.uci_points,
      false,
      correction.display_name || ' · prime du classement des jeunes régularisée'
    );

    perform public.refresh_uci_rankings(correction.season_id);
  end loop;
end;
$$;

-- Les programmations existantes deviennent actives immédiatement.
insert into public.rider_equipment_assignments (
  rider_id,
  slot_type,
  equipment_item_id,
  equipped_at
)
select
  pending.rider_id,
  pending.slot_type,
  pending.equipment_item_id,
  now()
from public.rider_equipment_pending_assignments as pending
on conflict (rider_id, slot_type) do update set
  equipment_item_id = excluded.equipment_item_id,
  equipped_at = excluded.equipped_at;

delete from public.rider_equipment_pending_assignments;

create or replace function public.equip_current_team_rider(
  p_rider_id uuid,
  p_slot_type text,
  p_equipment_item_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_item record;
  v_owned integer;
  v_used integer;
  v_current_item_id uuid;
  v_effective_at timestamptz := now();
begin
  if p_slot_type not in (
    'helmet', 'gloves', 'bib_shorts', 'glasses', 'shoes',
    'front_wheel', 'rear_wheel', 'frame'
  ) then
    raise exception 'Emplacement de matériel invalide.';
  end if;

  select team_season.id as team_season_id, team_season.team_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
    and team_season.season_id = season.id
  where director.auth_user_id = auth.uid()
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  if not exists (
    select 1
    from public.rider_contracts
    where rider_id = p_rider_id
      and team_id = v_context.team_id
      and status = 'active'
  ) then
    raise exception 'Vous ne pouvez équiper que les coureurs de votre équipe.';
  end if;

  select id, slot_type
  into v_item
  from public.equipment_catalog_items
  where id = p_equipment_item_id
    and status = 'active';

  if v_item is null or v_item.slot_type <> p_slot_type then
    raise exception 'Ce matériel ne correspond pas à cet emplacement.';
  end if;

  select equipment_item_id
  into v_current_item_id
  from public.rider_equipment_assignments
  where rider_id = p_rider_id
    and slot_type = p_slot_type;

  if v_current_item_id = p_equipment_item_id then
    delete from public.rider_equipment_pending_assignments
    where rider_id = p_rider_id and slot_type = p_slot_type;
    return v_effective_at;
  end if;

  select coalesce(quantity, 0)
  into v_owned
  from public.team_equipment_inventory
  where team_season_id = v_context.team_season_id
    and equipment_item_id = p_equipment_item_id;

  select count(*)
  into v_used
  from public.rider_equipment_assignments as equipped
  join public.rider_contracts as contract
    on contract.rider_id = equipped.rider_id
    and contract.team_id = v_context.team_id
    and contract.status = 'active'
  where equipped.equipment_item_id = p_equipment_item_id
    and not (
      equipped.rider_id = p_rider_id
      and equipped.slot_type = p_slot_type
    );

  if coalesce(v_owned, 0) <= coalesce(v_used, 0) then
    raise exception 'Tous les exemplaires de cette référence sont déjà attribués.';
  end if;

  insert into public.rider_equipment_assignments (
    rider_id, slot_type, equipment_item_id, equipped_at
  )
  values (p_rider_id, p_slot_type, p_equipment_item_id, v_effective_at)
  on conflict (rider_id, slot_type) do update set
    equipment_item_id = excluded.equipment_item_id,
    equipped_at = excluded.equipped_at;

  delete from public.rider_equipment_pending_assignments
  where rider_id = p_rider_id and slot_type = p_slot_type;

  return v_effective_at;
end;
$$;

comment on function public.equip_current_team_rider(uuid, text, uuid) is
  'Équipe immédiatement un coureur. Aucun changement de matériel n’est programmé.';

notify pgrst, 'reload schema';

commit;
