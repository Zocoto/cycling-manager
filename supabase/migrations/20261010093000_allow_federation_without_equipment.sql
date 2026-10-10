-- An explicit no-equipment decision clears the seasonal president alert.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '20s';

alter table public.national_federation_equipment_contracts
  alter column offer_key drop not null,
  alter column supplier_key drop not null,
  drop constraint if exists national_federation_equipment_contracts_price_paid_check,
  drop constraint if exists federation_equipment_choice_consistent;

alter table public.national_federation_equipment_contracts
  add constraint federation_equipment_choice_consistent check (
    (offer_key is null and supplier_key is null and price_paid = 0)
    or (offer_key is not null and supplier_key is not null and price_paid > 0)
  );

create or replace function public.choose_national_federation_equipment_offer(
  p_country_code text,
  p_offer_key text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_context record;
  v_offer public.national_federation_equipment_offers%rowtype;
  v_account public.national_federation_accounts%rowtype;
  v_contract_id uuid;
begin
  select
    director.id as director_id,
    assignment.team_id,
    season.id as season_id,
    season.game_year,
    coalesce(season.current_day_number, 1)::integer as day_number,
    team_season.registration_country_id as country_id,
    country.iso_alpha2 as country_code
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
  join public.countries as country
    on country.id = team_season.registration_country_id
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null or upper(v_context.country_code) <> upper(btrim(p_country_code)) then
    raise exception 'Cette fédération ne correspond pas à votre équipe.';
  end if;
  if v_context.game_year < 3 then
    raise exception 'Les contrats fédéraux ouvrent à partir de la saison 3.';
  end if;
  if not exists (
    select 1 from public.national_federation_terms as term
    where term.country_id = v_context.country_id
      and term.start_game_year <= v_context.game_year
      and term.end_game_year >= v_context.game_year
      and term.president_director_id = v_context.director_id
  ) then
    raise exception 'Seul le président de la fédération peut engager ce budget.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'federation-equipment:' || v_context.country_id::text || ':' || v_context.season_id::text,
      0
    )
  );

  if exists (
    select 1 from public.national_federation_equipment_contracts
    where country_id = v_context.country_id and season_id = v_context.season_id
  ) then
    raise exception 'L’équipementier de cette saison a déjà été choisi et ne peut plus être remplacé.';
  end if;

  -- An explicit free choice counts as a seasonal decision, without equipment.
  if p_offer_key = 'sans-equipement' then
    insert into public.national_federation_equipment_contracts (
      country_id, season_id, offer_key, supplier_key, offer_name,
      price_paid, signed_by_director_id
    ) values (
      v_context.country_id, v_context.season_id, null, null,
      'Sans équipement', 0, v_context.director_id
    ) returning id into v_contract_id;

    insert into public.national_federation_journal_entries (
      country_id, season_id, day_number, category, title, detail,
      source_reference, metadata
    ) values (
      v_context.country_id, v_context.season_id, v_context.day_number,
      'finance', 'Sans équipement fédéral',
      'Les sélections ne recevront aucune dotation ni bonus d’équipement fédéral cette saison. Choix gratuit et définitif.',
      'federation-equipment-contract:' || v_contract_id::text,
      jsonb_build_object('choice', 'sans-equipement', 'price', 0)
    );

    return v_contract_id;
  end if;

  select * into v_offer
  from public.national_federation_equipment_offers
  where offer_key = p_offer_key and status = 'active';
  if v_offer.offer_key is null then
    raise exception 'Cette offre équipementier n’est plus disponible.';
  end if;

  select * into v_account
  from public.national_federation_accounts
  where country_id = v_context.country_id and season_id = v_context.season_id
  for update;
  if v_account.id is null then
    raise exception 'La trésorerie fédérale de la saison n’est pas initialisée.';
  end if;
  if v_account.balance < v_offer.season_price then
    raise exception 'La trésorerie fédérale ne permet pas de financer cette offre.';
  end if;

  insert into public.national_federation_equipment_contracts (
    country_id, season_id, offer_key, supplier_key, offer_name,
    price_paid, signed_by_director_id
  ) values (
    v_context.country_id, v_context.season_id, v_offer.offer_key,
    v_offer.supplier_key, v_offer.name, v_offer.season_price,
    v_context.director_id
  ) returning id into v_contract_id;

  insert into public.national_federation_equipment_contract_items (
    contract_id, slot_type, equipment_name, effect_summary,
    effect_payload, display_order
  )
  select v_contract_id, item.slot_type, item.equipment_name,
    item.effect_summary, item.effect_payload, item.display_order
  from public.national_federation_equipment_offer_items as item
  where item.offer_key = v_offer.offer_key
  order by item.display_order, item.id;

  update public.national_federation_accounts
  set balance = balance - v_offer.season_price, updated_at = now()
  where id = v_account.id;

  insert into public.national_federation_transactions (
    account_id, day_number, amount, category, description,
    source_reference, metadata
  ) values (
    v_account.id, v_context.day_number, -v_offer.season_price, 'equipment',
    'Contrat équipementier international · ' || v_offer.name,
    'federation-equipment-contract:' || v_contract_id::text,
    jsonb_build_object(
      'contractId', v_contract_id,
      'offerKey', v_offer.offer_key,
      'supplierKey', v_offer.supplier_key
    )
  );

  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail,
    source_reference, metadata
  ) values (
    v_context.country_id, v_context.season_id, v_context.day_number,
    'finance', 'Équipementier national choisi',
    v_offer.name || ' équipera toutes les sélections internationales professionnelles et juniors cette saison.',
    'federation-equipment-contract:' || v_contract_id::text,
    jsonb_build_object('offerKey', v_offer.offer_key, 'price', v_offer.season_price)
  );

  return v_contract_id;
end;
$$;

commit;
