begin;

-- Le nom choisi par le DS accompagne le projet jusqu'à la création du
-- prototype. Les projets historiques restent valides grâce à la valeur nulle.
alter table public.equipment_rnd_projects
  add column if not exists prototype_name text;

alter table public.equipment_rnd_projects
  drop constraint if exists equipment_rnd_projects_prototype_name_check;

alter table public.equipment_rnd_projects
  add constraint equipment_rnd_projects_prototype_name_check
  check (
    prototype_name is null
    or (
      prototype_name = btrim(prototype_name)
      and char_length(prototype_name) between 3 and 60
    )
  );

-- Cette surcharge conserve toute la logique transactionnelle existante
-- (inventaire, ingénieur, durée, concurrence), puis associe le nom normalisé
-- au projet dans la même transaction.
create or replace function public.start_current_team_equipment_rnd(
  p_equipment_item_id uuid,
  p_engineer_contract_id uuid,
  p_prototype_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
set statement_timeout = '0'
as $$
declare
  v_prototype_name text;
  v_project_id uuid;
begin
  v_prototype_name := regexp_replace(
    btrim(coalesce(p_prototype_name, '')),
    '[[:space:]]+',
    ' ',
    'g'
  );

  if char_length(v_prototype_name) < 3
    or char_length(v_prototype_name) > 60 then
    raise exception 'Le nom du prototype doit contenir entre 3 et 60 caractères.';
  end if;

  v_project_id := public.start_current_team_equipment_rnd(
    p_equipment_item_id,
    p_engineer_contract_id
  );

  update public.equipment_rnd_projects
  set prototype_name = v_prototype_name
  where id = v_project_id;

  return v_project_id;
end;
$$;

-- Un projet peut être relancé sur la même référence aussi souvent que le DS
-- possède un exemplaire libre. Un prototype, propriété de l'équipe, reste une
-- entrée valide et peut donc repasser au laboratoire jusqu'au plafond de +10.
comment on function public.start_current_team_equipment_rnd(uuid, uuid, text) is
  'Lance une R&D nommée. Une référence ou un prototype peut être recherché plusieurs fois tant qu’un exemplaire libre existe.';

-- Les projets nommés créent exactement le prototype demandé. Les anciens
-- projets en cours gardent le nom généré historique en solution de repli.
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
      coalesce(
        nullif(btrim(v_project.prototype_name), ''),
        v_item.name || ' · Prototype ' || upper(substr(v_project.id::text, 1, 4))
      ),
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

-- Barème dédié aux prototypes : la somme est volontairement signée afin
-- qu'un malus de R&D réduise effectivement leur valeur de reprise.
create or replace function public.calculate_research_prototype_resale_price(
  p_effect_payload jsonb
)
returns bigint
language sql
immutable
set search_path = public, pg_temp
as $$
  with rating_values as (
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
  ), scores as (
    select coalesce(sum((value #>> '{}')::numeric), 0) as rating_power
    from rating_values
  )
  select greatest(
    100,
    round((
      5000
      + scores.rating_power * 1000
      + case
          when jsonb_typeof(p_effect_payload -> 'injuryRiskReductionPct') = 'number'
            then (p_effect_payload ->> 'injuryRiskReductionPct')::numeric * 50
          else 0
        end
      + (
          case
            when jsonb_typeof(p_effect_payload -> 'breakawayReputationBonus') = 'number'
              then (p_effect_payload ->> 'breakawayReputationBonus')::numeric
            else 0
          end
          + case
              when jsonb_typeof(p_effect_payload -> 'victoryReputationBonus') = 'number'
                then (p_effect_payload ->> 'victoryReputationBonus')::numeric
              else 0
            end
        ) * 4000
    ) / 100) * 100
  )::bigint
  from scores;
$$;

create or replace function public.sell_current_team_equipment(
  p_equipment_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_item record;
  v_inventory record;
  v_used integer;
  v_resale_price bigint;
  v_sale_id uuid := gen_random_uuid();
begin
  perform public.settle_current_team_finances();

  select
    team_season.id as team_season_id,
    team_season.team_id,
    team_season.currency,
    season.current_day_number,
    season_day.id as season_day_id
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
  join public.season_days as season_day
    on season_day.season_id = season.id
   and season_day.day_number = coalesce(season.current_day_number, 1)
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1
  for update of team_season;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  select
    id,
    name,
    acquisition_channel,
    owner_team_id,
    resale_price,
    effect_payload
  into v_item
  from public.equipment_catalog_items
  where id = p_equipment_item_id
    and status = 'active'
  for share;

  if v_item is null
    or not (
      v_item.acquisition_channel = 'commercial'
      or (
        v_item.acquisition_channel = 'research_prototype'
        and v_item.owner_team_id = v_context.team_id
      )
    ) then
    raise exception 'Seul le matériel réellement possédé peut être revendu.';
  end if;

  v_resale_price := case
    when v_item.acquisition_channel = 'research_prototype' then
      public.calculate_research_prototype_resale_price(v_item.effect_payload)
    else v_item.resale_price
  end;

  select inventory.id, inventory.quantity
  into v_inventory
  from public.team_equipment_inventory as inventory
  where inventory.team_season_id = v_context.team_season_id
    and inventory.equipment_item_id = p_equipment_item_id
  for update;

  if v_inventory is null then
    raise exception 'Aucun exemplaire de ce matériel n’est présent dans votre inventaire.';
  end if;

  select
    (
      select count(*)
      from public.rider_equipment_assignments as equipped
      join public.rider_contracts as contract
        on contract.rider_id = equipped.rider_id
       and contract.team_id = v_context.team_id
       and contract.status = 'active'
      where equipped.equipment_item_id = p_equipment_item_id
    ) + (
      select count(*)
      from public.rider_equipment_pending_assignments as pending
      where pending.team_season_id = v_context.team_season_id
        and pending.equipment_item_id = p_equipment_item_id
    )
  into v_used;

  if v_inventory.quantity <= coalesce(v_used, 0) then
    raise exception 'Tous les exemplaires sont équipés ou programmés et ne peuvent pas être revendus.';
  end if;

  if v_resale_price <= 0 then
    raise exception 'Ce matériel ne dispose pas encore d’une valeur de reprise.';
  end if;

  if v_inventory.quantity = 1 then
    delete from public.team_equipment_inventory
    where id = v_inventory.id;
  else
    update public.team_equipment_inventory
    set
      quantity = quantity - 1,
      updated_at = now()
    where id = v_inventory.id;
  end if;

  update public.team_seasons
  set cash_balance = cash_balance + v_resale_price
  where id = v_context.team_season_id;

  insert into public.team_finance_transactions (
    team_season_id,
    season_day_id,
    day_number,
    amount,
    category,
    status,
    description,
    source_reference,
    posted_at
  ) values (
    v_context.team_season_id,
    v_context.season_day_id,
    coalesce(v_context.current_day_number, 1),
    v_resale_price,
    'equipment',
    'posted',
    'Revente matériel : ' || v_item.name,
    'equipment-resale:' || v_sale_id::text,
    now()
  );

  return jsonb_build_object(
    'itemName', v_item.name,
    'resalePrice', v_resale_price,
    'currency', v_context.currency
  );
end;
$$;

revoke all on function public.start_current_team_equipment_rnd(uuid, uuid, text)
from public, anon;
revoke all on function public.calculate_research_prototype_resale_price(jsonb)
from public, anon;
revoke all on function public.settle_due_equipment_rnd_projects()
from public, anon;
revoke all on function public.sell_current_team_equipment(uuid)
from public, anon;

grant execute on function public.start_current_team_equipment_rnd(uuid, uuid, text)
to authenticated, service_role;
grant execute on function public.calculate_research_prototype_resale_price(jsonb)
to authenticated, service_role;
grant execute on function public.settle_due_equipment_rnd_projects()
to authenticated, service_role;
grant execute on function public.sell_current_team_equipment(uuid)
to authenticated, service_role;

comment on function public.calculate_research_prototype_resale_price(jsonb) is
  'Calcule la reprise signée d’un prototype R&D : 5000 € + 1000 € par point net, avec un plancher de 100 €.';
comment on function public.sell_current_team_equipment(uuid) is
  'Revends un exemplaire commercial ou un prototype R&D propriétaire libre, crédite sa reprise et journalise la transaction.';

notify pgrst, 'reload schema';

commit;
