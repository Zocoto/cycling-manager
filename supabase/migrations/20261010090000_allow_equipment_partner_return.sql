-- Allow older partners to return, keeping the two-season term and active contract lock.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '20s';

alter table public.equipment_partner_contracts
  drop constraint if exists equipment_partner_contract_supplier_once;

create or replace function public.sign_equipment_partner_contract(
  p_supplier_key text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_end_season_id uuid;
  v_contract_id uuid;
begin
  select
    director.reputation_points,
    assignment.team_id,
    season.id as season_id
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
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_context.team_id::text));

  if coalesce(v_context.reputation_points, 0) < 200 then
    raise exception 'Une réputation d’au moins 200 points est nécessaire pour signer.';
  end if;

  if not exists (
    select 1
    from public.equipment_suppliers as supplier
    where supplier.supplier_key = p_supplier_key
      and supplier.status = 'active'
      and supplier.supports_team_contract
  ) then
    raise exception 'Cet équipementier ne propose pas de contrat d’équipe.';
  end if;

  if exists (
    select 1
    from public.equipment_partner_contracts as contract
    where contract.team_id = v_context.team_id
      and contract.status = 'active'
  ) then
    raise exception 'Un contrat équipementier est déjà en cours et ne peut pas être rompu.';
  end if;

  -- Only the most recent partner is excluded: A -> B -> A is allowed.
  if p_supplier_key = (
    select contract.supplier_key
    from public.equipment_partner_contracts as contract
    where contract.team_id = v_context.team_id
    order by contract.signed_at desc, contract.id desc
    limit 1
  ) then
    raise exception 'Vous devez changer d’équipementier après chaque contrat de deux saisons. Un ancien partenaire redevient disponible après un contrat avec une autre marque.';
  end if;

  v_end_season_id := public.ensure_transfer_next_season(v_context.season_id);

  insert into public.equipment_partner_contracts (
    team_id,
    supplier_key,
    start_season_id,
    end_season_id
  )
  values (
    v_context.team_id,
    p_supplier_key,
    v_context.season_id,
    v_end_season_id
  )
  returning id into v_contract_id;

  insert into public.equipment_partner_item_effects (
    contract_id,
    equipment_item_id,
    effect_payload
  )
  select
    v_contract_id,
    product.equipment_item_id,
    item.effect_payload
  from public.equipment_partner_products as product
  join public.equipment_catalog_items as item
    on item.id = product.equipment_item_id
  where product.supplier_key = p_supplier_key
    and product.offer_type = 'core';

  return v_contract_id;
end;
$$;

commit;
