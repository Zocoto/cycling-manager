begin;

-- Direct negotiations are durable records so that both the pending inbox and
-- the complete received-offer history can be rendered without rebuilding it
-- from finance transactions or mailbox messages.
create table public.direct_transfer_offers (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete restrict,
  rider_id uuid not null references public.riders(id) on delete restrict,
  buyer_team_id uuid not null references public.teams(id) on delete restrict,
  seller_team_id uuid not null references public.teams(id) on delete restrict,
  submitted_by_director_id uuid not null
    references public.sporting_directors(id) on delete restrict,
  responded_by_director_id uuid
    references public.sporting_directors(id) on delete set null,
  offered_amount numeric(14, 2) not null,
  salary_per_season numeric(12, 2) not null,
  currency_code text not null default 'EUR',
  status text not null default 'pending',
  response_note text,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint direct_transfer_offers_teams_differ
    check (buyer_team_id <> seller_team_id),
  constraint direct_transfer_offers_amount_range
    check (offered_amount between 500 and 100000000),
  constraint direct_transfer_offers_salary_non_negative
    check (salary_per_season >= 0),
  constraint direct_transfer_offers_currency_format
    check (char_length(currency_code) = 3 and currency_code = upper(currency_code)),
  constraint direct_transfer_offers_status_allowed
    check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  constraint direct_transfer_offers_response_shape
    check (
      (status = 'pending' and responded_at is null and responded_by_director_id is null)
      or (status <> 'pending' and responded_at is not null)
    )
);

create unique index direct_transfer_offers_one_pending_per_buyer_rider_idx
  on public.direct_transfer_offers (buyer_team_id, rider_id)
  where status = 'pending';

create index direct_transfer_offers_received_idx
  on public.direct_transfer_offers (seller_team_id, season_id, status, created_at desc);

create index direct_transfer_offers_sent_idx
  on public.direct_transfer_offers (buyer_team_id, season_id, status, created_at desc);

alter table public.direct_transfer_offers enable row level security;

create policy direct_transfer_offers_select_managed_teams
on public.direct_transfer_offers
for select
to authenticated
using (
  exists (
    select 1
    from public.sporting_directors as director
    join public.team_manager_assignments as assignment
      on assignment.sporting_director_id = director.id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    where director.auth_user_id = auth.uid()
      and director.status = 'active'
      and assignment.team_id in (
        direct_transfer_offers.buyer_team_id,
        direct_transfer_offers.seller_team_id
      )
  )
);

grant select on table public.direct_transfer_offers to authenticated;
grant all privileges on table public.direct_transfer_offers to service_role;

alter table public.rider_contracts
  drop constraint if exists rider_contracts_acquisition_type_allowed;
alter table public.rider_contracts
  add constraint rider_contracts_acquisition_type_allowed
    check (acquisition_type in (
      'initial', 'daily_auction', 'director_auction', 'free_agent', 'renewal',
      'academy', 'direct_offer'
    ));

create or replace function public.calculate_rider_dismissal_compensation(
  p_team_id uuid,
  p_rider_id uuid,
  p_active_season_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  with clock as (
    select season.game_year, coalesce(season.current_day_number, 1) as day_number
    from public.seasons as season
    where season.id = p_active_season_id
  ), covered_contract_seasons as (
    select
      contract.id,
      contract.salary_per_season,
      covered_season.game_year
    from public.rider_contracts as contract
    join public.seasons as start_season on start_season.id = contract.start_season_id
    join public.seasons as end_season on end_season.id = contract.end_season_id
    join public.seasons as covered_season
      on covered_season.game_year between start_season.game_year and end_season.game_year
    where contract.team_id = p_team_id
      and contract.rider_id = p_rider_id
      and contract.status in ('active', 'planned')
  )
  select coalesce(sum(
    case
      when covered.game_year < clock.game_year then 0
      when covered.game_year > clock.game_year then covered.salary_per_season
      else (
        select coalesce(sum(
          case
            when installment.number * 7 <= clock.day_number then 0
            when installment.number < 4
              then round(covered.salary_per_season / 4, 2)
            else covered.salary_per_season
              - round(covered.salary_per_season / 4, 2) * 3
          end
        ), 0)
        from pg_catalog.generate_series(1, 4) as installment(number)
      )
    end
  ), 0)
  from covered_contract_seasons as covered
  cross join clock;
$$;

create or replace function public.get_team_transfer_reserved_budget(
  p_team_id uuid,
  p_excluded_offer_id uuid default null,
  p_excluded_listing_id uuid default null
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  with listing_leaders as (
    select distinct on (bid.listing_id)
      bid.listing_id,
      bid.team_id,
      bid.amount + listing.salary_per_season as reserved_amount
    from public.transfer_market_bids as bid
    join public.transfer_market_listings as listing on listing.id = bid.listing_id
    where listing.status = 'open'
      and (p_excluded_listing_id is null or listing.id <> p_excluded_listing_id)
    order by bid.listing_id, bid.amount desc, bid.created_at asc, bid.id asc
  ), reservations as (
    select leader.reserved_amount
    from listing_leaders as leader
    where leader.team_id = p_team_id
    union all
    select offer.offered_amount + offer.salary_per_season
    from public.direct_transfer_offers as offer
    where offer.buyer_team_id = p_team_id
      and offer.status = 'pending'
      and (p_excluded_offer_id is null or offer.id <> p_excluded_offer_id)
  )
  select coalesce(sum(reserved_amount), 0) from reservations;
$$;

create or replace function public.cancel_pending_direct_transfer_offers(
  p_rider_id uuid,
  p_seller_team_id uuid,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.direct_transfer_offers%rowtype;
  v_rider_name text;
  v_buyer_team_season_id uuid;
  v_cancelled integer := 0;
begin
  select concat_ws(' ', rider.first_name, rider.last_name)
  into v_rider_name
  from public.riders as rider
  where rider.id = p_rider_id;

  for v_offer in
    select *
    from public.direct_transfer_offers as offer
    where offer.rider_id = p_rider_id
      and offer.seller_team_id = p_seller_team_id
      and offer.status = 'pending'
    order by offer.created_at, offer.id
    for update
  loop
    update public.direct_transfer_offers
    set status = 'cancelled', responded_at = now(),
        response_note = left(coalesce(nullif(btrim(p_reason), ''),
          'Le coureur n’est plus disponible.'), 500)
    where id = v_offer.id;

    select team_season.id
    into v_buyer_team_season_id
    from public.team_seasons as team_season
    where team_season.team_id = v_offer.buyer_team_id
      and team_season.season_id = v_offer.season_id;

    insert into public.sporting_director_messages (
      sporting_director_id, season_id, team_season_id, message_type,
      sender_name, subject, preview, body, action_href, action_label,
      source_reference, is_important
    ) values (
      v_offer.submitted_by_director_id, v_offer.season_id,
      v_buyer_team_season_id, 'system', 'Bureau des transferts',
      'Offre devenue caduque pour ' || v_rider_name,
      coalesce(nullif(btrim(p_reason), ''), 'Le coureur n’est plus disponible.'),
      coalesce(nullif(btrim(p_reason), ''), 'Le coureur n’est plus disponible.'),
      '/jeu/transferts?onglet=offres', 'Voir le bureau des transferts',
      'direct-transfer-offer:' || v_offer.id::text || ':cancelled', false
    )
    on conflict (sporting_director_id, source_reference) do nothing;

    v_cancelled := v_cancelled + 1;
  end loop;

  return v_cancelled;
end;
$$;

create or replace function public.submit_direct_transfer_offer(
  p_rider_id uuid,
  p_amount numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_contract public.rider_contracts%rowtype;
  v_seller_director_id uuid;
  v_seller_team_season_id uuid;
  v_seller_name text;
  v_rider_name text;
  v_amount numeric(14, 2);
  v_salary numeric(12, 2);
  v_available numeric(14, 2);
  v_offer_id uuid;
begin
  perform public.settle_current_team_finances();
  perform public.settle_transfer_market();

  select
    director.id as director_id,
    assignment.team_id,
    season.id as season_id,
    season.game_year,
    team_season.id as team_season_id,
    team_season.display_name,
    team_season.currency
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
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  v_amount := round(p_amount / 100) * 100;
  if p_amount is null or v_amount < 500 or v_amount > 100000000 then
    raise exception 'Le montant de l’offre doit être compris entre 500 € et 100 000 000 €.';
  end if;

  select * into v_contract
  from public.rider_contracts as contract
  where contract.rider_id = p_rider_id
    and contract.status = 'active'
  for update;

  if v_contract is null then
    raise exception 'Ce coureur n’est plus sous contrat avec une équipe.';
  end if;
  if v_contract.team_id = v_context.team_id then
    raise exception 'Vous ne pouvez pas faire une offre pour votre propre coureur.';
  end if;
  if v_contract.transfer_locked_season_id = v_context.season_id then
    raise exception 'Ce coureur recruté cette saison ne peut pas encore être transféré.';
  end if;

  select
    director.id,
    team_season.id,
    team_season.display_name
  into v_seller_director_id, v_seller_team_season_id, v_seller_name
  from public.team_manager_assignments as assignment
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id
   and director.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = v_context.season_id
  where assignment.team_id = v_contract.team_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  limit 1;

  if v_seller_director_id is null then
    raise exception 'Aucun Directeur Sportif actif ne peut répondre pour l’équipe vendeuse.';
  end if;
  if exists (
    select 1 from public.direct_transfer_offers as offer
    where offer.buyer_team_id = v_context.team_id
      and offer.rider_id = p_rider_id
      and offer.status = 'pending'
  ) then
    raise exception 'Votre équipe a déjà une offre en attente pour ce coureur.';
  end if;
  if public.get_team_roster_commitment_count(v_context.team_id, v_context.game_year) >= 35 then
    raise exception 'Votre effectif est déjà complet pour la saison actuelle.';
  end if;

  v_salary := public.calculate_rider_season_salary(p_rider_id, v_context.season_id);
  v_available := public.get_projected_transfer_budget(v_context.team_season_id)
    - public.get_team_transfer_reserved_budget(v_context.team_id);
  if v_available < v_amount + v_salary then
    raise exception 'Votre budget disponible ne couvre pas l’offre et la première saison de salaire.';
  end if;

  insert into public.direct_transfer_offers (
    season_id, rider_id, buyer_team_id, seller_team_id,
    submitted_by_director_id, offered_amount, salary_per_season, currency_code
  ) values (
    v_context.season_id, p_rider_id, v_context.team_id, v_contract.team_id,
    v_context.director_id, v_amount, v_salary, v_context.currency
  ) returning id into v_offer_id;

  select concat_ws(' ', rider.first_name, rider.last_name)
  into v_rider_name
  from public.riders as rider
  where rider.id = p_rider_id;

  insert into public.sporting_director_messages (
    sporting_director_id, season_id, team_season_id, message_type,
    sender_name, subject, preview, body, action_href, action_label,
    source_reference, is_important
  ) values (
    v_seller_director_id, v_context.season_id, v_seller_team_season_id, 'system',
    v_context.display_name,
    'Nouvelle offre pour ' || v_rider_name,
    v_context.display_name || ' propose ' || v_amount::text || ' ' || v_context.currency || '.',
    format('%s souhaite recruter %s pour %s %s. Vous pouvez accepter ou refuser cette offre depuis le bureau des transferts.',
      v_context.display_name, v_rider_name, v_amount, v_context.currency),
    '/jeu/transferts?onglet=offres', 'Répondre à l’offre',
    'direct-transfer-offer:' || v_offer_id::text || ':received', true
  );

  return v_offer_id;
end;
$$;

create or replace function public.respond_to_direct_transfer_offer(
  p_offer_id uuid,
  p_accept boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_offer public.direct_transfer_offers%rowtype;
  v_contract public.rider_contracts%rowtype;
  v_buyer_team_season_id uuid;
  v_buyer_team_name text;
  v_rider_name text;
  v_new_contract_id uuid;
  v_available numeric(14, 2);
begin
  perform public.settle_current_team_finances();
  perform public.settle_transfer_market();

  select
    director.id as director_id,
    assignment.team_id,
    season.id as season_id,
    season.game_year,
    coalesce(season.current_day_number, 1) as day_number,
    team_season.id as team_season_id,
    team_season.display_name,
    team_season.currency
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
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;
  if p_accept is null then
    raise exception 'La décision transmise est invalide.';
  end if;

  select * into v_offer
  from public.direct_transfer_offers as offer
  where offer.id = p_offer_id
  for update;

  if v_offer is null or v_offer.seller_team_id <> v_context.team_id then
    raise exception 'Cette offre ne concerne pas votre équipe.';
  end if;
  if v_offer.status <> 'pending' then
    raise exception 'Cette offre a déjà reçu une réponse.';
  end if;

  select concat_ws(' ', rider.first_name, rider.last_name)
  into v_rider_name
  from public.riders as rider
  where rider.id = v_offer.rider_id;

  select team_season.id, team_season.display_name
  into v_buyer_team_season_id, v_buyer_team_name
  from public.team_seasons as team_season
  where team_season.team_id = v_offer.buyer_team_id
    and team_season.season_id = v_context.season_id
  for update;

  if not p_accept then
    update public.direct_transfer_offers
    set status = 'rejected', responded_by_director_id = v_context.director_id,
        responded_at = now()
    where id = v_offer.id;

    insert into public.sporting_director_messages (
      sporting_director_id, season_id, team_season_id, message_type,
      sender_name, subject, preview, body, action_href, action_label,
      source_reference, is_important
    ) values (
      v_offer.submitted_by_director_id, v_context.season_id,
      v_buyer_team_season_id, 'system', v_context.display_name,
      'Offre refusée pour ' || v_rider_name,
      v_context.display_name || ' a refusé votre proposition.',
      format('%s a refusé votre offre de %s %s pour %s.',
        v_context.display_name, v_offer.offered_amount,
        v_offer.currency_code, v_rider_name),
      '/jeu/transferts?onglet=offres', 'Voir le bureau des transferts',
      'direct-transfer-offer:' || v_offer.id::text || ':rejected', false
    );
    return null;
  end if;

  select * into v_contract
  from public.rider_contracts as contract
  where contract.rider_id = v_offer.rider_id
    and contract.team_id = v_context.team_id
    and contract.status = 'active'
  for update;

  if v_contract is null then
    raise exception 'Le coureur n’appartient plus à votre équipe.';
  end if;
  if v_contract.transfer_locked_season_id = v_context.season_id then
    raise exception 'Ce coureur recruté cette saison ne peut pas encore être transféré.';
  end if;
  if v_buyer_team_season_id is null then
    raise exception 'L’équipe acheteuse ne participe plus à la saison active.';
  end if;
  if public.get_team_roster_commitment_count(v_offer.buyer_team_id, v_context.game_year) >= 35 then
    raise exception 'L’effectif de l’équipe acheteuse est désormais complet.';
  end if;

  v_available := public.get_projected_transfer_budget(v_buyer_team_season_id)
    - public.get_team_transfer_reserved_budget(v_offer.buyer_team_id, v_offer.id, null);
  if v_available < v_offer.offered_amount + v_offer.salary_per_season then
    raise exception 'L’équipe acheteuse ne dispose plus du budget nécessaire.';
  end if;

  -- Mark the selected offer first so the generic departure trigger only
  -- cancels the competing pending offers for this rider.
  update public.direct_transfer_offers
  set status = 'accepted', responded_by_director_id = v_context.director_id,
      responded_at = now()
  where id = v_offer.id;

  perform public.cancel_pending_direct_transfer_offers(
    v_offer.rider_id,
    v_context.team_id,
    'Le coureur a accepté une autre offre.'
  );

  update public.transfer_market_listings
  set status = 'cancelled', settled_at = now()
  where rider_id = v_offer.rider_id
    and status = 'open';

  update public.rider_contracts
  set status = 'terminated'
  where rider_id = v_offer.rider_id
    and status = 'active';
  update public.rider_contracts
  set status = 'cancelled'
  where rider_id = v_offer.rider_id
    and status = 'planned';

  insert into public.rider_contracts (
    rider_id, team_id, start_season_id, end_season_id, salary_per_season,
    currency, currency_code, status, signed_at, acquisition_type,
    transfer_locked_season_id, transfer_fee
  ) values (
    v_offer.rider_id, v_offer.buyer_team_id, v_context.season_id,
    v_context.season_id, v_offer.salary_per_season, v_offer.currency_code,
    v_offer.currency_code, 'active', now(), 'direct_offer',
    v_context.season_id, v_offer.offered_amount
  ) returning id into v_new_contract_id;

  update public.riders set status = 'active' where id = v_offer.rider_id;

  insert into public.team_finance_transactions (
    team_season_id, day_number, amount, category, status, description,
    source_reference, posted_at
  ) values (
    v_buyer_team_season_id, v_context.day_number, -v_offer.offered_amount,
    'transfer', 'posted', 'Transfert entrant · ' || v_rider_name,
    'direct-transfer-purchase:' || v_offer.id::text, now()
  );
  update public.team_seasons
  set cash_balance = cash_balance - v_offer.offered_amount
  where id = v_buyer_team_season_id;

  insert into public.team_finance_transactions (
    team_season_id, day_number, amount, category, status, description,
    source_reference, posted_at
  ) values (
    v_context.team_season_id, v_context.day_number, v_offer.offered_amount,
    'transfer', 'posted', 'Transfert sortant · ' || v_rider_name,
    'direct-transfer-sale:' || v_offer.id::text, now()
  );
  update public.team_seasons
  set cash_balance = cash_balance + v_offer.offered_amount
  where id = v_context.team_season_id;

  insert into public.sporting_director_messages (
    sporting_director_id, season_id, team_season_id, message_type,
    sender_name, subject, preview, body, action_href, action_label,
    source_reference, is_important
  ) values (
    v_offer.submitted_by_director_id, v_context.season_id,
    v_buyer_team_season_id, 'system', v_context.display_name,
    'Offre acceptée pour ' || v_rider_name,
    v_rider_name || ' rejoint votre équipe.',
    format('%s a accepté votre offre de %s %s. %s signe jusqu’à la fin de la saison en cours.',
      v_context.display_name, v_offer.offered_amount,
      v_offer.currency_code, v_rider_name),
    '/jeu/coureurs/' || v_offer.rider_id::text, 'Voir le nouveau coureur',
    'direct-transfer-offer:' || v_offer.id::text || ':accepted', true
  );

  return v_new_contract_id;
end;
$$;

create or replace function public.dismiss_current_team_rider(
  p_rider_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_contract public.rider_contracts%rowtype;
  v_compensation numeric(14, 2);
  v_rider_name text;
begin
  perform public.settle_current_team_finances();
  perform public.settle_transfer_market();

  select
    director.id as director_id,
    assignment.team_id,
    season.id as season_id,
    coalesce(season.current_day_number, 1) as day_number,
    team_season.id as team_season_id,
    team_season.cash_balance,
    team_season.currency
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
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  select * into v_contract
  from public.rider_contracts as contract
  where contract.rider_id = p_rider_id
    and contract.team_id = v_context.team_id
    and contract.status = 'active'
  for update;
  if v_contract is null then
    raise exception 'Ce coureur n’appartient pas à votre équipe.';
  end if;

  perform 1
  from public.rider_contracts as contract
  where contract.rider_id = p_rider_id
    and contract.team_id = v_context.team_id
    and contract.status = 'planned'
  for update;

  v_compensation := public.calculate_rider_dismissal_compensation(
    v_context.team_id, p_rider_id, v_context.season_id
  );
  if v_context.cash_balance < v_compensation then
    raise exception 'La trésorerie immédiate ne permet pas de payer les salaires restants (% €).', v_compensation;
  end if;

  select concat_ws(' ', rider.first_name, rider.last_name)
  into v_rider_name
  from public.riders as rider
  where rider.id = p_rider_id;

  perform public.cancel_pending_direct_transfer_offers(
    p_rider_id,
    v_context.team_id,
    'Le coureur a été libéré de son contrat.'
  );
  update public.transfer_market_listings
  set status = 'cancelled', settled_at = now()
  where rider_id = p_rider_id
    and status = 'open';

  update public.rider_contracts
  set status = 'terminated'
  where rider_id = p_rider_id
    and team_id = v_context.team_id
    and status = 'active';
  update public.rider_contracts
  set status = 'cancelled'
  where rider_id = p_rider_id
    and team_id = v_context.team_id
    and status = 'planned';

  if v_compensation > 0 then
    insert into public.team_finance_transactions (
      team_season_id, day_number, amount, category, status, description,
      source_reference, posted_at
    ) values (
      v_context.team_season_id, v_context.day_number, -v_compensation,
      'rider_salary', 'posted', 'Indemnité de licenciement · ' || v_rider_name,
      'rider-dismissal:' || v_contract.id::text, now()
    );
    update public.team_seasons
    set cash_balance = cash_balance - v_compensation
    where id = v_context.team_season_id;
  end if;

  update public.riders
  set status = 'free_agent'
  where id = p_rider_id;

  return jsonb_build_object(
    'riderId', p_rider_id,
    'compensation', v_compensation,
    'currency', v_context.currency
  );
end;
$$;

-- If another transfer workflow or the season lifecycle moves the rider first,
-- pending direct offers become historical cancellations automatically.
create or replace function public.cancel_direct_offers_on_rider_departure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'active' and new.status <> 'active' then
    perform public.cancel_pending_direct_transfer_offers(
      old.rider_id,
      old.team_id,
      'Le coureur n’est plus disponible dans cette équipe.'
    );
  end if;
  return new;
end;
$$;

create trigger cancel_direct_offers_on_rider_departure_after_update
after update of status on public.rider_contracts
for each row execute function public.cancel_direct_offers_on_rider_departure();

-- Keep auction bids and direct offers in one reservation envelope.
create or replace function public.place_transfer_bid(
  p_listing_id uuid,
  p_amount numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_listing public.transfer_market_listings%rowtype;
  v_current_amount numeric;
  v_minimum_amount numeric;
  v_reserved numeric;
  v_available numeric;
  v_bid_id uuid;
begin
  perform public.settle_transfer_market();

  select director.id as director_id, assignment.team_id,
    team_season.id as team_season_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id and team_season.season_id = season.id
  where director.auth_user_id = auth.uid() and director.status = 'active'
  limit 1;

  if v_context is null then raise exception 'Aucune équipe active ne correspond au DS.'; end if;

  select * into v_listing from public.transfer_market_listings
  where id = p_listing_id for update;

  if v_listing is null or v_listing.status <> 'open'
    or now() < v_listing.opens_at or now() >= v_listing.closes_at then
    raise exception 'Cette enchère n’est pas ouverte.';
  end if;
  if v_listing.seller_team_id = v_context.team_id then
    raise exception 'Vous ne pouvez pas enchérir sur votre propre coureur.';
  end if;

  select max(amount) into v_current_amount
  from public.transfer_market_bids where listing_id = v_listing.id;
  v_minimum_amount := case
    when v_current_amount is null then v_listing.minimum_bid
    else v_current_amount + greatest(500, ceil(v_current_amount * 0.02 / 100) * 100)
  end;

  if p_amount is null or p_amount < v_minimum_amount then
    raise exception 'La prochaine offre doit atteindre au moins % €.', v_minimum_amount;
  end if;

  v_reserved := public.get_team_transfer_reserved_budget(
    v_context.team_id, null, v_listing.id
  );
  v_available := public.get_projected_transfer_budget(v_context.team_season_id);
  if v_available - v_reserved < p_amount + v_listing.salary_per_season then
    raise exception 'Votre budget disponible ne couvre pas l’offre et la première saison de salaire.';
  end if;

  insert into public.transfer_market_bids (
    listing_id, team_id, sporting_director_id, amount
  ) values (
    v_listing.id, v_context.team_id, v_context.director_id, p_amount
  ) returning id into v_bid_id;

  return v_bid_id;
end;
$$;

revoke all on function public.calculate_rider_dismissal_compensation(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.calculate_rider_dismissal_compensation(uuid, uuid, uuid)
  to service_role;
revoke all on function public.get_team_transfer_reserved_budget(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_team_transfer_reserved_budget(uuid, uuid, uuid)
  to service_role;
revoke all on function public.cancel_pending_direct_transfer_offers(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.submit_direct_transfer_offer(uuid, numeric)
  from public, anon;
grant execute on function public.submit_direct_transfer_offer(uuid, numeric)
  to authenticated;
revoke all on function public.respond_to_direct_transfer_offer(uuid, boolean)
  from public, anon;
grant execute on function public.respond_to_direct_transfer_offer(uuid, boolean)
  to authenticated;
revoke all on function public.dismiss_current_team_rider(uuid)
  from public, anon;
grant execute on function public.dismiss_current_team_rider(uuid)
  to authenticated;
revoke all on function public.cancel_direct_offers_on_rider_departure()
  from public, anon, authenticated;
revoke all on function public.place_transfer_bid(uuid, numeric) from public;
grant execute on function public.place_transfer_bid(uuid, numeric) to authenticated;

notify pgrst, 'reload schema';

commit;
