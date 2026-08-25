begin;

-- Une pièce peu développée reste rapide à traiter. La durée progresse ensuite
-- de façon linéaire jusqu'à +6, puis plus fortement jusqu'au plafond +10 :
-- +5 = 10 jours, +6 = 12 jours et +10 = 28 jours.
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
    when value <= 6 then value * 2
    else least(28, 12 + (value - 6) * 4)
  end
  from score;
$$;

-- Le plafond est contrôlé au plus près des données afin qu'aucun autre client
-- ou ancien écran ne puisse lancer une recherche au-delà de +10.
create or replace function public.enforce_equipment_rnd_bonus_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bonus_total integer;
begin
  if new.status <> 'active' then
    return new;
  end if;

  select public.calculate_equipment_rnd_bonus_total(item.effect_payload)
  into v_bonus_total
  from public.equipment_catalog_items as item
  where item.id = new.input_equipment_item_id;

  if coalesce(v_bonus_total, 0) >= 10 then
    raise exception 'Cet équipement a atteint le plafond R&D de +10.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_equipment_rnd_bonus_cap
on public.equipment_rnd_projects;

create trigger enforce_equipment_rnd_bonus_cap
before insert or update of status, input_equipment_item_id
on public.equipment_rnd_projects
for each row
execute function public.enforce_equipment_rnd_bonus_cap();

-- Un résultat exceptionnel de +2 sur une pièce déjà à +9 est ramené à +1.
-- Le prototype ne peut donc jamais dépasser le plafond, même au règlement
-- asynchrone du projet.
create or replace function public.settle_due_equipment_rnd_projects()
returns integer
language plpgsql
security definer
set search_path = public
set statement_timeout = '0'
as $$
declare
  v_game_day integer;
  v_project record;
  v_item record;
  v_key text;
  v_delta integer;
  v_payload jsonb;
  v_current numeric;
  v_bonus_total integer;
  v_successful boolean;
  v_new_item uuid;
  v_team_season uuid;
  v_count integer := 0;
begin
  perform public.sync_active_season_day();

  select season.game_year * 28 + season.current_day_number - 1
  into v_game_day
  from public.seasons as season
  where season.status = 'active'
  limit 1;

  for v_project in
    select project.*
    from public.equipment_rnd_projects as project
    where project.status = 'active'
      and project.completes_game_day_index <= v_game_day
    order by project.completes_game_day_index
    for update skip locked
  loop
    select item.*
    into v_item
    from public.equipment_catalog_items as item
    where item.id = v_project.input_equipment_item_id;

    select team_season.id
    into v_team_season
    from public.seasons as season
    join public.team_seasons as team_season
      on team_season.season_id = season.id
    where season.status = 'active'
      and team_season.team_id = v_project.team_id
    limit 1;

    v_key := (
      array[
        'mountain', 'hills', 'flat', 'timeTrial', 'cobbles', 'sprint',
        'acceleration', 'downhill', 'endurance', 'resistance', 'recovery',
        'breakaway', 'prologue'
      ]
    )[1 + floor(random() * 13)::integer];
    v_successful := floor(random() * 100) < v_project.success_rate;
    v_bonus_total := public.calculate_equipment_rnd_bonus_total(
      v_item.effect_payload
    );

    if v_successful then
      v_delta := case
        when v_project.lab_level >= 6 and random() < 0.12 then 2
        else 1
      end;
      v_delta := least(v_delta, greatest(0, 10 - v_bonus_total));
    else
      v_delta := -1;
    end if;

    v_current := coalesce(
      (v_item.effect_payload -> 'ratingBonuses' ->> v_key)::numeric,
      0
    );
    v_payload := v_item.effect_payload || jsonb_build_object(
      'ratingBonuses',
      coalesce(v_item.effect_payload -> 'ratingBonuses', '{}'::jsonb)
        || jsonb_build_object(v_key, v_current + v_delta)
    );

    insert into public.equipment_catalog_items (
      catalog_key,
      name,
      slot_type,
      status,
      supplier_key,
      supplier_name,
      description,
      price,
      rarity,
      image_path,
      effect_summary,
      effect_payload,
      acquisition_channel,
      owner_team_id
    ) values (
      'rnd-' || v_project.id::text,
      v_item.name || ' · Prototype ' || upper(substr(v_project.id::text, 1, 4)),
      v_item.slot_type,
      'active',
      v_item.supplier_key,
      v_item.supplier_name,
      'Prototype unique issu du Laboratoire R&D.',
      0,
      'premium',
      v_item.image_path,
      v_item.effect_summary || ' · R&D '
        || case when v_delta > 0 then '+' else '' end
        || v_delta::text || ' ' || v_key,
      v_payload,
      'research_prototype',
      v_project.team_id
    )
    returning id into v_new_item;

    insert into public.team_equipment_inventory (
      team_season_id,
      equipment_item_id,
      quantity,
      last_purchase_price
    ) values (
      v_team_season,
      v_new_item,
      1,
      0
    );

    update public.equipment_rnd_projects
    set prototype_equipment_item_id = v_new_item,
        rating_key = v_key,
        outcome = case
          when v_successful then 'improvement'
          else 'setback'
        end,
        rating_delta = v_delta,
        status = 'completed',
        completed_at = now()
    where id = v_project.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Les projets déjà en cours adoptent immédiatement la nouvelle durée.
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

revoke all on function public.enforce_equipment_rnd_bonus_cap()
from public, anon, authenticated;
revoke all on function public.settle_due_equipment_rnd_projects()
from public, anon;

grant execute on function public.settle_due_equipment_rnd_projects()
to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
