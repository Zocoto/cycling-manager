-- Matériel partenaire virtuel pendant le contrat et revente du matériel possédé.

begin;

create or replace function public.calculate_equipment_resale_price(
  p_price numeric,
  p_rarity text,
  p_effect_payload jsonb
)
returns bigint
language sql
immutable
set search_path = public, pg_temp
as $$
  with scores as (
    select
      coalesce((
        select sum(greatest(value::numeric, 0))
        from jsonb_each_text(
          case
            when jsonb_typeof(p_effect_payload -> 'ratingBonuses') = 'object'
              then p_effect_payload -> 'ratingBonuses'
            else '{}'::jsonb
          end
        )
      ), 0) + coalesce((
        select sum(greatest(value::numeric, 0))
        from jsonb_each_text(
          case
            when jsonb_typeof(p_effect_payload -> 'timeTrialRatingBonuses') = 'object'
              then p_effect_payload -> 'timeTrialRatingBonuses'
            else '{}'::jsonb
          end
        )
      ), 0) as rating_power,
      greatest(
        coalesce((p_effect_payload ->> 'injuryRiskReductionPct')::numeric, 0),
        0
      ) as injury_power,
      greatest(
        coalesce((p_effect_payload ->> 'breakawayReputationBonus')::numeric, 0),
        0
      ) + greatest(
        coalesce((p_effect_payload ->> 'victoryReputationBonus')::numeric, 0),
        0
      ) as reputation_power
  )
  select greatest(
    100,
    case
      when coalesce(p_price, 0) > 0 then
        round((p_price * 0.5) / 100) * 100
      else greatest(
        case p_rarity
          when 'premium' then 2500
          when 'performance' then 1000
          else 400
        end,
        round((
          scores.rating_power * 400 +
          scores.injury_power * 50 +
          scores.reputation_power * 4000
        ) / 100) * 100
      )
    end
  )::bigint
  from scores;
$$;

alter table public.equipment_catalog_items
  add column resale_price numeric(12, 2)
  generated always as (
    public.calculate_equipment_resale_price(price, rarity, effect_payload)
  ) stored;

-- Les anciens lots équipementier, dont ceux du compte de Paul, ne sont plus
-- des possessions : les affectations coureurs restent valides pendant le contrat.
delete from public.team_equipment_inventory as inventory
using public.equipment_catalog_items as item
where item.id = inventory.equipment_item_id
  and item.acquisition_channel = 'equipment_partner';

create or replace function public.prevent_physical_partner_equipment_inventory()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
    from public.equipment_catalog_items as item
    where item.id = new.equipment_item_id
      and item.acquisition_channel = 'equipment_partner'
  ) then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_physical_partner_equipment_inventory
  on public.team_equipment_inventory;
create trigger prevent_physical_partner_equipment_inventory
before insert or update on public.team_equipment_inventory
for each row execute function public.prevent_physical_partner_equipment_inventory();

create or replace function public.equip_current_team_rider(
  p_rider_id uuid,
  p_slot_type text,
  p_equipment_item_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_item record;
  v_owned integer;
  v_used integer;
  v_current_item_id uuid;
  v_effective_at timestamptz;
  v_before_cutoff boolean;
  v_partner_available boolean := false;
begin
  if p_slot_type not in (
    'helmet', 'gloves', 'bib_shorts', 'glasses', 'shoes',
    'front_wheel', 'rear_wheel', 'frame'
  ) then
    raise exception 'Emplacement de matériel invalide.';
  end if;

  select
    team_season.id as team_season_id,
    team_season.team_id,
    season.game_year
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

  perform public.settle_due_equipment_assignments(v_context.team_season_id);

  if not exists (
    select 1
    from public.rider_contracts
    where rider_id = p_rider_id
      and team_id = v_context.team_id
      and status = 'active'
  ) then
    raise exception 'Vous ne pouvez équiper que les coureurs de votre équipe.';
  end if;

  select id, slot_type, acquisition_channel, supplier_key
  into v_item
  from public.equipment_catalog_items
  where id = p_equipment_item_id
    and status = 'active';

  if v_item is null or v_item.slot_type <> p_slot_type then
    raise exception 'Ce matériel ne correspond pas à cet emplacement.';
  end if;

  if v_item.acquisition_channel = 'equipment_partner' then
    select exists (
      select 1
      from public.equipment_partner_contracts as partner_contract
      join public.seasons as start_season
        on start_season.id = partner_contract.start_season_id
      join public.seasons as end_season
        on end_season.id = partner_contract.end_season_id
      join public.equipment_partner_products as product
        on product.supplier_key = partner_contract.supplier_key
       and product.equipment_item_id = p_equipment_item_id
      where partner_contract.team_id = v_context.team_id
        and partner_contract.status = 'active'
        and partner_contract.supplier_key = v_item.supplier_key
        and v_context.game_year between start_season.game_year and end_season.game_year
        and (
          product.offer_type = 'core'
          or exists (
            select 1
            from public.equipment_partner_offers as offer
            where offer.contract_id = partner_contract.id
              and offer.equipment_item_id = p_equipment_item_id
              and offer.status = 'claimed'
          )
        )
    ) into v_partner_available;

    if not v_partner_available then
      raise exception 'Cette référence partenaire n’est pas disponible pour votre équipe.';
    end if;
  else
    select coalesce(quantity, 0)
    into v_owned
    from public.team_equipment_inventory
    where team_season_id = v_context.team_season_id
      and equipment_item_id = p_equipment_item_id;

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
          and not (
            pending.rider_id = p_rider_id
            and pending.slot_type = p_slot_type
          )
      )
    into v_used;

    if coalesce(v_owned, 0) <= coalesce(v_used, 0) then
      raise exception 'Tous les exemplaires de cette référence sont déjà attribués.';
    end if;
  end if;

  select equipment_item_id
  into v_current_item_id
  from public.rider_equipment_assignments
  where rider_id = p_rider_id
    and slot_type = p_slot_type;

  if v_current_item_id = p_equipment_item_id then
    delete from public.rider_equipment_pending_assignments
    where rider_id = p_rider_id and slot_type = p_slot_type;
    return now();
  end if;

  v_before_cutoff := (now() at time zone 'Europe/Paris')::time < time '12:00';

  if v_before_cutoff then
    v_effective_at := now();

    insert into public.rider_equipment_assignments (
      rider_id, slot_type, equipment_item_id, equipped_at
    )
    values (p_rider_id, p_slot_type, p_equipment_item_id, v_effective_at)
    on conflict (rider_id, slot_type) do update set
      equipment_item_id = excluded.equipment_item_id,
      equipped_at = excluded.equipped_at;

    delete from public.rider_equipment_pending_assignments
    where rider_id = p_rider_id and slot_type = p_slot_type;
  else
    v_effective_at := (
      ((now() at time zone 'Europe/Paris')::date + 1) + time '12:00'
    ) at time zone 'Europe/Paris';

    insert into public.rider_equipment_pending_assignments (
      team_season_id, rider_id, slot_type, equipment_item_id, effective_at
    )
    values (
      v_context.team_season_id,
      p_rider_id,
      p_slot_type,
      p_equipment_item_id,
      v_effective_at
    )
    on conflict (rider_id, slot_type) do update set
      team_season_id = excluded.team_season_id,
      equipment_item_id = excluded.equipment_item_id,
      requested_at = now(),
      effective_at = excluded.effective_at;
  end if;

  return v_effective_at;
end;
$$;

create or replace function public.start_equipment_partner_rnd(
  p_equipment_item_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_contract record;
  v_product record;
  v_effect record;
  v_project_id uuid;
begin
  perform public.sync_current_team_equipment_partner();

  select
    assignment.team_id,
    season.game_year,
    team_season.id as team_season_id,
    season_day.calendar_date
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
  limit 1;

  select contract.id, contract.supplier_key, end_season.ends_on as contract_ends_on
  into v_contract
  from public.equipment_partner_contracts as contract
  join public.seasons as start_season on start_season.id = contract.start_season_id
  join public.seasons as end_season on end_season.id = contract.end_season_id
  where contract.team_id = v_context.team_id
    and contract.status = 'active'
    and v_context.game_year between start_season.game_year and end_season.game_year
  limit 1
  for update of contract;

  if v_contract is null then
    raise exception 'Aucun contrat équipementier actif ne permet de lancer une recherche.';
  end if;

  select product.research_rating_key
  into v_product
  from public.equipment_partner_products as product
  where product.supplier_key = v_contract.supplier_key
    and product.equipment_item_id = p_equipment_item_id
    and (
      product.offer_type = 'core'
      or exists (
        select 1
        from public.equipment_partner_offers as offer
        where offer.contract_id = v_contract.id
          and offer.equipment_item_id = p_equipment_item_id
          and offer.status = 'claimed'
      )
    );

  if v_product is null then
    raise exception 'Ce matériel n’est pas disponible dans la gamme active de votre équipementier.';
  end if;

  select effect.*
  into v_effect
  from public.equipment_partner_item_effects as effect
  where effect.contract_id = v_contract.id
    and effect.equipment_item_id = p_equipment_item_id;

  if v_effect is null then
    raise exception 'Les données de recherche de ce matériel sont indisponibles.';
  end if;

  if exists (
    select 1
    from public.equipment_partner_rnd_projects
    where contract_id = v_contract.id
      and status = 'in_progress'
  ) then
    raise exception 'Un seul projet R&D peut être mené à la fois.';
  end if;

  if v_context.calendar_date + 3 > v_contract.contract_ends_on then
    raise exception 'Le contrat se termine avant la fin de ce cycle R&D.';
  end if;

  insert into public.equipment_partner_rnd_projects (
    contract_id,
    equipment_item_id,
    research_rating_key,
    started_on,
    completes_on,
    before_effect_payload
  )
  values (
    v_contract.id,
    p_equipment_item_id,
    v_product.research_rating_key,
    v_context.calendar_date,
    v_context.calendar_date + 3,
    v_effect.effect_payload
  )
  returning id into v_project_id;

  return v_project_id;
end;
$$;

create or replace function public.claim_equipment_partner_offer(
  p_offer_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_offer record;
begin
  perform public.sync_current_team_equipment_partner();

  select
    assignment.team_id,
    season_day.calendar_date
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.season_days as season_day
    on season_day.season_id = season.id
   and season_day.day_number = coalesce(season.current_day_number, 1)
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  select offer.*
  into v_offer
  from public.equipment_partner_offers as offer
  join public.equipment_partner_contracts as contract
    on contract.id = offer.contract_id
   and contract.team_id = v_context.team_id
   and contract.status = 'active'
  where offer.id = p_offer_id
  for update of offer;

  if v_offer is null then
    raise exception 'Cette proposition de matériel est introuvable.';
  end if;

  if v_offer.status <> 'open' or v_offer.expires_on < v_context.calendar_date then
    raise exception 'Cette proposition n’est plus disponible.';
  end if;

  update public.equipment_partner_offers
  set
    status = 'claimed',
    claimed_at = now()
  where id = v_offer.id;

  return v_offer.equipment_item_id;
end;
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

  select id, name, acquisition_channel, resale_price
  into v_item
  from public.equipment_catalog_items
  where id = p_equipment_item_id
    and status = 'active'
  for share;

  if v_item is null or v_item.acquisition_channel <> 'commercial' then
    raise exception 'Seul le matériel réellement possédé peut être revendu.';
  end if;

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

  if v_item.resale_price <= 0 then
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
  set cash_balance = cash_balance + v_item.resale_price
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
  )
  values (
    v_context.team_season_id,
    v_context.season_day_id,
    coalesce(v_context.current_day_number, 1),
    v_item.resale_price,
    'equipment',
    'posted',
    'Revente matériel : ' || v_item.name,
    'equipment-resale:' || v_sale_id::text,
    now()
  );

  return jsonb_build_object(
    'itemName', v_item.name,
    'resalePrice', v_item.resale_price,
    'currency', v_context.currency
  );
end;
$$;

revoke all on function public.calculate_equipment_resale_price(numeric, text, jsonb)
  from public, anon;
revoke all on function public.prevent_physical_partner_equipment_inventory()
  from public, anon;
revoke all on function public.sell_current_team_equipment(uuid)
  from public, anon;

grant execute on function public.calculate_equipment_resale_price(numeric, text, jsonb)
  to authenticated, service_role;
grant execute on function public.sell_current_team_equipment(uuid)
  to authenticated, service_role;

comment on function public.sell_current_team_equipment(uuid) is
  'Revends un exemplaire commercial libre, crédite sa valeur de reprise et journalise la transaction.';
comment on trigger prevent_physical_partner_equipment_inventory
  on public.team_equipment_inventory is
  'Le matériel équipementier est un droit d’usage temporaire et ne doit jamais charger l’inventaire.';

notify pgrst, 'reload schema';

commit;
