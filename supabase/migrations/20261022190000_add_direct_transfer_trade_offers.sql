begin;

set local lock_timeout = '2s';
set local statement_timeout = '8s';

-- Keep the mature cash-only business rules byte-for-byte behind thin locking
-- wrappers. Abort rather than silently replacing a newer production core.
-- These MD5 values intentionally normalize CRLF to LF, as PostgreSQL keeps
-- line endings of the original function body in pg_get_functiondef().
do $verified_live_core$
begin
  if md5(replace(pg_catalog.pg_get_functiondef(
    'public.submit_direct_transfer_offer(uuid,numeric)'::regprocedure), chr(13), ''))
      <> 'a89fd68e61df7d153c31537ebd6b35fa'
    or md5(replace(pg_catalog.pg_get_functiondef(
    'public.respond_to_direct_transfer_offer(uuid,boolean)'::regprocedure), chr(13), ''))
      <> '915a479051739453000889726bef123d'
    or md5(replace(pg_catalog.pg_get_functiondef(
    'public.get_team_transfer_reserved_budget(uuid,uuid,uuid)'::regprocedure), chr(13), ''))
      <> '1e5a49a179207cebd1597ec51b07c650'
  then
    raise exception 'Le noyau des transferts a changé : revue de la migration des échanges nécessaire.';
  end if;
end;
$verified_live_core$;

alter table public.direct_transfer_offers
  add column offered_rider_id uuid references public.riders(id) on delete restrict,
  add column offered_rider_salary_per_season numeric(12, 2),
  add column salary_before_team_discounts numeric(12, 2),
  add column offered_rider_salary_before_team_discounts numeric(12, 2);

alter table public.direct_transfer_offers
  drop constraint direct_transfer_offers_amount_range,
  add constraint direct_transfer_offers_amount_range check (
    (offered_rider_id is null and offered_amount between 500 and 100000000)
    or (offered_rider_id is not null and offered_amount between 0 and 100000000)
  ),
  add constraint direct_transfer_offers_trade_shape check (
    (offered_rider_id is null
      and offered_rider_salary_per_season is null
      and salary_before_team_discounts is null
      and offered_rider_salary_before_team_discounts is null)
    or (offered_rider_id is not null
      and offered_rider_id <> rider_id
      and offered_rider_salary_per_season is not null
      and salary_before_team_discounts is not null
      and offered_rider_salary_before_team_discounts is not null
      and offered_rider_salary_per_season >= 0
      and salary_before_team_discounts >= 0
      and offered_rider_salary_before_team_discounts >= 0)
  );

create index direct_transfer_offers_pending_offered_rider_idx
  on public.direct_transfer_offers (offered_rider_id, buyer_team_id)
  where status = 'pending' and offered_rider_id is not null;
create index direct_transfer_offers_pending_target_rider_idx
  on public.direct_transfer_offers (rider_id, seller_team_id)
  where status = 'pending';

comment on column public.direct_transfer_offers.offered_rider_id is
  'Contrepartie optionnelle : un seul coureur de l’équipe émettrice, échangé atomiquement avec le coureur ciblé.';
comment on column public.direct_transfer_offers.salary_before_team_discounts is
  'Échanges uniquement : brut transmis aux déclencheurs normaux ; salary_per_season contient le devis net, puis le salaire réellement signé.';
comment on column public.direct_transfer_offers.offered_rider_salary_before_team_discounts is
  'Échanges uniquement : brut de la contrepartie pour éviter une seconde remise sur le devis net affiché.';

-- No global market lock: only the two participating teams and their riders.
-- NOWAIT also avoids deadlock cycles with older auction/contract workflows
-- that already hold a contract or finance row before entering a trigger.
create function private.lock_direct_transfer_scope(
  p_season_id uuid, p_team_ids uuid[], p_rider_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_rider_id uuid;
begin
  for v_team_id in
    select distinct item.team_id
    from unnest(p_team_ids) as item(team_id)
    where item.team_id is not null
    order by item.team_id
  loop
    if not pg_catalog.pg_try_advisory_xact_lock(
      pg_catalog.hashtextextended('team-roster:' || v_team_id::text, 0)
    ) then
      raise exception 'Un mouvement d’effectif est déjà en cours. Réessayez dans quelques secondes.'
        using errcode = '55P03';
    end if;
  end loop;

  -- Same per-rider key as save_current_team_race_roster and its delta paths.
  -- Never wait while owning a team/contract lock held by another workflow.
  for v_rider_id in
    select distinct item.rider_id from unnest(p_rider_ids) as item(rider_id)
    where item.rider_id is not null order by item.rider_id
  loop
    if not pg_catalog.pg_try_advisory_xact_lock(
      pg_catalog.hashtextextended(v_rider_id::text, 0)
    ) then
      raise exception 'Une inscription concernant ces coureurs est en cours. Réessayez dans quelques secondes.'
        using errcode = '55P03';
    end if;
  end loop;

  perform team_season.id
  from public.team_seasons as team_season
  where team_season.season_id = p_season_id
    and team_season.team_id = any(p_team_ids)
  order by team_season.team_id, team_season.id
  for update nowait;

  perform contract.id
  from public.rider_contracts as contract
  where contract.rider_id = any(p_rider_ids)
    and contract.status in ('active', 'planned')
  order by contract.rider_id, contract.id
  for update nowait;

  perform offer.id
  from public.direct_transfer_offers as offer
  where offer.status = 'pending'
    and (offer.rider_id = any(p_rider_ids)
      or offer.offered_rider_id = any(p_rider_ids))
  order by offer.id
  for update nowait;
exception when lock_not_available then
  raise exception 'Une opération concernant ces coureurs est déjà en cours. Réessayez dans quelques secondes.'
    using errcode = '55P03';
end;
$$;

-- A booking can validate ownership before waiting for its team/registration
-- lock. Check it once more at the actual write, under a contract row lock
-- conflicting with the exchange's FOR UPDATE. Completed history, national
-- selections without a club team_season and amateur entries remain untouched.
create function private.guard_live_rider_commitment_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_contract_id uuid;
begin
  if new.rider_id is null then return new; end if;
  if tg_table_name = 'race_rosters' then
    if new.status not in ('selected', 'confirmed') then return new; end if;
    select team_season.team_id into v_team_id
    from public.race_registrations as registration
    join public.team_seasons as team_season on team_season.id = registration.team_season_id
    join public.race_editions as edition on edition.id = registration.race_edition_id
    where registration.id = new.race_registration_id
      and registration.status in ('pending', 'accepted')
      and edition.status not in ('completed', 'cancelled');
  elsif tg_table_name = 'rider_form_camps' then
    if new.status not in ('planned', 'active') then return new; end if;
    select team_season.team_id into v_team_id
    from public.team_seasons as team_season
    join public.seasons as season on season.id = new.season_id and season.status = 'active'
    where team_season.id = new.team_season_id;
  elsif tg_table_name = 'stage_reconnaissance_riders' then
    select team_season.team_id into v_team_id
    from public.stage_reconnaissances as reconnaissance
    join public.team_seasons as team_season on team_season.id = reconnaissance.team_season_id
    join public.seasons as season on season.id = reconnaissance.season_id and season.status = 'active'
    where reconnaissance.id = new.reconnaissance_id
      and reconnaissance.status in ('planned', 'active');
  end if;
  if v_team_id is null then return new; end if;

  select contract.id into v_contract_id
  from public.rider_contracts as contract
  where contract.rider_id = new.rider_id and contract.team_id = v_team_id and contract.status = 'active'
  for key share nowait;
  if v_contract_id is null then
    raise exception 'Ce coureur ne fait plus partie de l’effectif actif de cette équipe. Actualisez la page avant de confirmer son engagement.';
  end if;
  return new;
exception when lock_not_available then
  raise exception 'Un transfert de ce coureur est en cours. Réessayez son inscription ou son programme dans quelques secondes.'
    using errcode = '55P03';
end;
$$;

create trigger guard_race_roster_transfer_ownership
before insert or update of rider_id, status, race_registration_id on public.race_rosters
for each row execute function private.guard_live_rider_commitment_ownership();
create trigger guard_form_camp_transfer_ownership
before insert or update of rider_id, status, team_season_id on public.rider_form_camps
for each row execute function private.guard_live_rider_commitment_ownership();
create trigger guard_reconnaissance_transfer_ownership
before insert or update of rider_id, reconnaissance_id on public.stage_reconnaissance_riders
for each row execute function private.guard_live_rider_commitment_ownership();

create function private.assert_rider_trade_eligible(
  p_rider_id uuid, p_team_id uuid, p_season_id uuid, p_game_year integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  select concat_ws(' ', rider.first_name, rider.last_name)
  into v_name from public.riders as rider
  where rider.id = p_rider_id and rider.status = 'active';
  if v_name is null or not exists (
    select 1 from public.rider_contracts as contract
    where contract.rider_id = p_rider_id and contract.team_id = p_team_id
      and contract.status = 'active'
  ) then
    raise exception 'Un coureur proposé n’appartient plus à l’équipe attendue ou n’est plus actif.';
  end if;

  if exists (
    select 1 from public.rider_contracts as contract
    join public.seasons as start_season on start_season.id = contract.start_season_id
    join public.seasons as end_season on end_season.id = contract.end_season_id
    where contract.rider_id = p_rider_id
      and contract.status in ('active', 'terminated', 'completed')
      and p_game_year between start_season.game_year and end_season.game_year
      and (contract.transfer_locked_season_id = p_season_id
        or contract.team_id <> p_team_id)
  ) then
    raise exception '% a déjà changé d’équipe cette saison et ne peut plus être échangé.', v_name;
  end if;

  if exists (
    select 1 from public.rider_contracts as contract
    where contract.rider_id = p_rider_id and contract.status = 'planned'
      and (contract.team_id <> p_team_id or contract.acquisition_type <> 'renewal')
  ) then
    raise exception '% possède déjà un engagement futur incompatible avec cet échange.', v_name;
  end if;

  if exists (select 1 from public.transfer_market_listings as listing
    where listing.rider_id = p_rider_id and listing.status = 'open') then
    raise exception '% est actuellement proposé aux enchères. Retirez d’abord son enchère.', v_name;
  end if;

  if exists (
    select 1 from public.race_rosters as roster
    join public.race_registrations as registration on registration.id = roster.race_registration_id
    join public.race_editions as edition on edition.id = registration.race_edition_id
    where roster.rider_id = p_rider_id and roster.status in ('selected', 'confirmed')
      and registration.status in ('pending', 'accepted')
      and edition.status not in ('completed', 'cancelled')
  ) then
    raise exception '% est engagé sur une course non terminée. Retirez-le de cette course avant l’échange, ou attendez la fin de l’épreuve.', v_name;
  end if;

  if exists (
    select 1 from public.rider_form_camps as camp
    where camp.rider_id = p_rider_id and camp.season_id = p_season_id
      and camp.status in ('planned', 'active')
  ) or exists (
    select 1 from public.stage_reconnaissance_riders as participant
    join public.stage_reconnaissances as reconnaissance on reconnaissance.id = participant.reconnaissance_id
    where participant.rider_id = p_rider_id and reconnaissance.season_id = p_season_id
      and reconnaissance.status in ('planned', 'active')
  ) then
    raise exception '% participe à un stage ou une reconnaissance programmé ou en cours. Annulez le programme futur ou attendez sa fin avant l’échange.', v_name;
  end if;
end;
$$;

create function private.assert_trade_roster_capacity(
  p_team_id uuid, p_game_year integer, p_incoming_rider_id uuid, p_outgoing_rider_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year integer;
  v_total integer;
  v_non_homegrown integer;
  v_outgoing_present boolean;
  v_outgoing_homegrown boolean;
  v_incoming_homegrown boolean := public.is_team_homegrown_rider(p_team_id, p_incoming_rider_id);
  v_incoming_slots integer;
begin
  for v_year in p_game_year..p_game_year + 1 loop
    v_total := public.get_team_roster_commitment_count(p_team_id, v_year);
    v_non_homegrown := public.get_team_non_homegrown_roster_commitment_count(p_team_id, v_year);
    select count(*) > 0, coalesce(bool_or(contract.acquisition_type = 'academy'
      or public.is_team_homegrown_rider(p_team_id, p_outgoing_rider_id)), false)
    into v_outgoing_present, v_outgoing_homegrown
    from public.rider_contracts as contract
    join public.seasons as start_season on start_season.id = contract.start_season_id
    join public.seasons as end_season on end_season.id = contract.end_season_id
    where contract.team_id = p_team_id and contract.rider_id = p_outgoing_rider_id
      and contract.status in ('active', 'planned')
      and v_year between start_season.game_year and end_season.game_year;

    if v_outgoing_present then
      v_total := greatest(0, v_total - 1);
      if not v_outgoing_homegrown then v_non_homegrown := greatest(0, v_non_homegrown - 1); end if;
    end if;
    -- New direct contracts last through this season, never a fictitious slot
    -- in S+1. Existing future commitments are nevertheless checked net of the
    -- outgoing rider, including the academy-only reserve.
    v_incoming_slots := case when v_year = p_game_year then 1 else 0 end;
    if v_total + v_incoming_slots > public.get_team_roster_limit(p_team_id)
      or (not v_incoming_homegrown and v_non_homegrown + v_incoming_slots
        > public.get_team_roster_base_limit(p_team_id)) then
      raise exception 'L’échange dépasserait la capacité d’effectif de l’une des équipes pour la saison %.', v_year;
    end if;
  end loop;
end;
$$;

create function private.quote_direct_transfer_salary(
  p_rider_id uuid, p_team_id uuid, p_season_id uuid, p_gross_salary numeric
)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_salary numeric := p_gross_salary;
  v_power numeric;
begin
  -- BEFORE INSERT order is DataRoom, then homegrown; renewal-only discounts
  -- do not apply to a transfer. Keep actual triggers authoritative at signing.
  v_power := public.get_team_specialization_power(p_team_id, 'recruitment_data_room', 'deal_room');
  if v_power > 0 then v_salary := round(v_salary * (1 - 0.03 * v_power), 2); end if;
  if exists (select 1 from public.seasons as season
    where season.game_year >= 3 and (season.id = p_season_id or season.status = 'active'))
    and exists (
      select 1 from public.rider_special_abilities as ability
      join public.youth_academy_riders as academy on academy.promoted_rider_id = ability.rider_id
        and academy.team_id = p_team_id and academy.status = 'promoted'
      where ability.rider_id = p_rider_id and ability.ability_code = 'homegrown'
    ) then
    v_salary := round(v_salary / 2, 2);
  end if;
  return v_salary;
end;
$$;

-- Departure invalidates an offer whether the rider was the target OR the
-- buyer's non-cash consideration. No scan of an entire season is required.
create or replace function public.cancel_pending_direct_transfer_offers(
  p_rider_id uuid, p_seller_team_id uuid, p_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.direct_transfer_offers%rowtype;
  v_rider_name text;
  v_recipient record;
  v_cancelled integer := 0;
  v_reason text := left(coalesce(nullif(btrim(p_reason), ''), 'Le coureur n’est plus disponible.'), 500);
begin
  select concat_ws(' ', rider.first_name, rider.last_name) into v_rider_name
  from public.riders as rider where rider.id = p_rider_id;
  for v_offer in
    select offer.* from public.direct_transfer_offers as offer
    where offer.status = 'pending'
      and ((offer.rider_id = p_rider_id and offer.seller_team_id = p_seller_team_id)
        or (offer.offered_rider_id = p_rider_id and offer.buyer_team_id = p_seller_team_id))
    order by offer.id for update nowait
  loop
    update public.direct_transfer_offers set status = 'cancelled', responded_at = now(), response_note = v_reason
    where id = v_offer.id;
    for v_recipient in
      select v_offer.submitted_by_director_id as director_id, team_season.id as team_season_id
      from public.team_seasons as team_season
      where team_season.team_id = v_offer.buyer_team_id and team_season.season_id = v_offer.season_id
      union all
      select director.id, team_season.id
      from public.team_manager_assignments as assignment
      join public.sporting_directors as director on director.id = assignment.sporting_director_id and director.status = 'active'
      join public.team_seasons as team_season on team_season.team_id = assignment.team_id and team_season.season_id = v_offer.season_id
      where v_offer.offered_rider_id is not null and assignment.team_id = v_offer.seller_team_id
        and assignment.role = 'general_manager' and assignment.status = 'active'
    loop
      insert into public.sporting_director_messages (
        sporting_director_id, season_id, team_season_id, message_type, sender_name, subject, preview, body,
        action_href, action_label, source_reference, is_important
      ) values (
        v_recipient.director_id, v_offer.season_id, v_recipient.team_season_id, 'system', 'Bureau des transferts',
        'Offre devenue caduque · ' || coalesce(v_rider_name, 'Coureur'), v_reason, v_reason,
        '/jeu/transferts?onglet=offres', 'Voir le bureau des transferts',
        'direct-transfer-offer:' || v_offer.id::text || ':cancelled', false
      ) on conflict (sporting_director_id, source_reference) do nothing;
    end loop;
    v_cancelled := v_cancelled + 1;
  end loop;
  return v_cancelled;
end;
$$;

create or replace function public.cancel_direct_offers_on_rider_departure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'active' then
      perform public.cancel_pending_direct_transfer_offers(old.rider_id, old.team_id,
        'Le coureur n’est plus disponible dans cette équipe.');
    end if;
    return old;
  end if;
  if old.status = 'active'
    and (new.status <> 'active' or new.team_id is distinct from old.team_id) then
    perform public.cancel_pending_direct_transfer_offers(old.rider_id, old.team_id,
      'Le coureur n’est plus disponible dans cette équipe.');
  end if;
  return new;
end;
$$;
drop trigger cancel_direct_offers_on_rider_departure_after_update on public.rider_contracts;
create trigger cancel_direct_offers_on_rider_departure_after_update
after delete or update of status, team_id on public.rider_contracts
for each row execute function public.cancel_direct_offers_on_rider_departure();

alter function public.submit_direct_transfer_offer(uuid, numeric) rename to submit_direct_transfer_offer_cash_20261022;
alter function public.submit_direct_transfer_offer_cash_20261022(uuid, numeric) set schema private;
alter function public.respond_to_direct_transfer_offer(uuid, boolean) rename to respond_to_direct_transfer_offer_cash_20261022;
alter function public.respond_to_direct_transfer_offer_cash_20261022(uuid, boolean) set schema private;

create function public.submit_direct_transfer_offer(p_rider_id uuid, p_amount numeric)
returns uuid
language plpgsql
security definer
set search_path = ''
set lock_timeout = '2s'
set statement_timeout = '8s'
as $$
declare
  v_context record;
  v_seller_team_id uuid;
begin
  select assignment.team_id, season.id as season_id into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment on assignment.sporting_director_id = director.id
    and assignment.status = 'active' and assignment.role = 'general_manager'
  join public.seasons as season on season.status = 'active'
  where director.auth_user_id = auth.uid() and director.status = 'active' limit 1;
  if v_context is null then raise exception 'Aucune équipe active ne correspond au Directeur Sportif.'; end if;
  select contract.team_id into v_seller_team_id from public.rider_contracts as contract
  where contract.rider_id = p_rider_id and contract.status = 'active';
  perform private.lock_direct_transfer_scope(v_context.season_id,
    array[v_context.team_id, v_seller_team_id], array[p_rider_id]);
  return private.submit_direct_transfer_offer_cash_20261022(p_rider_id, p_amount);
end;
$$;

create function public.submit_direct_transfer_trade_offer(
  p_rider_id uuid, p_amount numeric, p_offered_rider_id uuid, p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set lock_timeout = '2s'
set statement_timeout = '8s'
as $$
declare
  v_context record;
  v_seller record;
  v_rider_name text;
  v_offered_name text;
  v_amount numeric(14, 2);
  v_target_gross numeric(12, 2);
  v_offered_gross numeric(12, 2);
  v_offer_id uuid;
  v_conversation_id uuid;
  v_message public.direct_messages%rowtype;
  v_body text;
  v_custom text;
  v_available numeric;
begin
  if p_offered_rider_id is null then
    return public.submit_direct_transfer_offer_with_message(p_rider_id, p_amount, p_message);
  end if;
  if auth.uid() is null then raise exception 'Votre session ne permet pas de proposer un échange.'; end if;
  if p_rider_id is null or p_rider_id = p_offered_rider_id then raise exception 'Sélectionnez deux coureurs distincts pour cet échange.'; end if;
  if p_amount is null or p_amount::text in ('NaN', 'Infinity', '-Infinity')
    or p_amount < 0 or p_amount > 100000000 then
    raise exception 'La somme ajoutée à un échange doit être comprise entre 0 € et 100 000 000 €.';
  end if;
  v_amount := round(p_amount / 100) * 100;
  v_custom := replace(replace(btrim(coalesce(p_message, '')), E'\r\n', E'\n'), E'\r', E'\n');
  v_custom := regexp_replace(v_custom, E'[\t ]+', ' ', 'g');
  v_custom := regexp_replace(v_custom, E'\n[\t ]+', E'\n', 'g');
  v_custom := regexp_replace(v_custom, E'\n{3,}', E'\n\n', 'g');
  if char_length(v_custom) > 500 then raise exception 'Le message ne peut pas dépasser 500 caractères.'; end if;

  perform public.settle_current_team_finances();
  select director.id as director_id, assignment.team_id, season.id as season_id, season.game_year,
    team_season.id as team_season_id, team_season.display_name, team_season.currency
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment on assignment.sporting_director_id = director.id
    and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season on team_season.team_id = assignment.team_id and team_season.season_id = season.id
  where director.auth_user_id = auth.uid() and director.status = 'active'
    and not exists (select 1 from public.alpha_bot_managers as bot where bot.sporting_director_id = director.id)
  limit 1;
  if v_context is null then raise exception 'Les échanges de coureurs sont réservés aux équipes gérées par des joueurs.'; end if;

  select director.id as director_id, assignment.team_id, team_season.id as team_season_id, team_season.display_name
  into v_seller
  from public.rider_contracts as contract
  join public.team_manager_assignments as assignment on assignment.team_id = contract.team_id
    and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.sporting_directors as director on director.id = assignment.sporting_director_id
    and director.status = 'active' and director.auth_user_id is not null
  join public.team_seasons as team_season on team_season.team_id = assignment.team_id and team_season.season_id = v_context.season_id
  where contract.rider_id = p_rider_id and contract.status = 'active'
    and not exists (select 1 from public.alpha_bot_managers as bot where bot.sporting_director_id = director.id)
  limit 1;
  if v_seller is null or v_seller.team_id = v_context.team_id or v_seller.director_id = v_context.director_id then
    raise exception 'Choisissez un coureur d’une autre équipe gérée par un joueur pour proposer un échange.';
  end if;

  -- Keep rollover from closing this season after its cleanup but before the
  -- offer is inserted. Shared readers coexist; an ongoing rollover fails fast.
  perform season.id from public.seasons as season
  where season.id = v_context.season_id and season.status = 'active'
  for share nowait;
  if not found then raise exception 'La saison a changé. Actualisez la page avant de proposer cet échange.'; end if;
  perform private.lock_direct_transfer_scope(v_context.season_id,
    array[v_context.team_id, v_seller.team_id], array[p_rider_id, p_offered_rider_id]);
  perform private.assert_rider_trade_eligible(p_rider_id, v_seller.team_id, v_context.season_id, v_context.game_year);
  perform private.assert_rider_trade_eligible(p_offered_rider_id, v_context.team_id, v_context.season_id, v_context.game_year);
  if exists (select 1 from public.direct_transfer_offers as offer where offer.status = 'pending'
    and offer.buyer_team_id = v_context.team_id and offer.rider_id = p_rider_id) then
    raise exception 'Votre équipe a déjà une offre en attente pour ce coureur.';
  end if;
  if exists (select 1 from public.direct_transfer_offers as offer where offer.status = 'pending'
    and (offer.rider_id = p_offered_rider_id or offer.offered_rider_id = p_offered_rider_id)) then
    raise exception 'Le coureur proposé est déjà impliqué dans une offre en attente. Attendez sa réponse ou retirez votre offre.';
  end if;
  perform private.assert_trade_roster_capacity(v_context.team_id, v_context.game_year, p_rider_id, p_offered_rider_id);
  perform private.assert_trade_roster_capacity(v_seller.team_id, v_context.game_year, p_offered_rider_id, p_rider_id);
  select team_season.cash_balance - public.get_team_transfer_reserved_budget(v_context.team_id)
  into v_available from public.team_seasons as team_season where team_season.id = v_context.team_season_id;
  if v_amount > 0 and v_available < v_amount then
    raise exception 'Votre trésorerie disponible ne couvre pas la somme ajoutée à cet échange.';
  end if;

  v_target_gross := public.calculate_rider_season_salary(p_rider_id, v_context.season_id);
  v_offered_gross := public.calculate_rider_season_salary(p_offered_rider_id, v_context.season_id);
  insert into public.direct_transfer_offers (
    season_id, rider_id, buyer_team_id, seller_team_id, submitted_by_director_id,
    offered_amount, salary_per_season, currency_code, offered_rider_id,
    offered_rider_salary_per_season, salary_before_team_discounts, offered_rider_salary_before_team_discounts
  ) values (
    v_context.season_id, p_rider_id, v_context.team_id, v_seller.team_id, v_context.director_id,
    v_amount, private.quote_direct_transfer_salary(p_rider_id, v_context.team_id, v_context.season_id, v_target_gross),
    v_context.currency, p_offered_rider_id,
    private.quote_direct_transfer_salary(p_offered_rider_id, v_seller.team_id, v_context.season_id, v_offered_gross),
    v_target_gross, v_offered_gross
  ) returning id into v_offer_id;

  select concat_ws(' ', first_name, last_name) into v_rider_name from public.riders where id = p_rider_id;
  select concat_ws(' ', first_name, last_name) into v_offered_name from public.riders where id = p_offered_rider_id;
  v_body := format('💼 %s propose %s + %s %s contre %s.',
    v_context.display_name, v_offered_name, v_amount, v_context.currency, v_rider_name);
  insert into public.sporting_director_messages (
    sporting_director_id, season_id, team_season_id, message_type, sender_name, subject, preview, body,
    action_href, action_label, source_reference, is_important
  ) values (
    v_seller.director_id, v_context.season_id, v_seller.team_season_id, 'system', v_context.display_name,
    'Proposition d’échange pour ' || v_rider_name, left(v_body, 240),
    v_body || ' Consultez les deux coureurs et leurs salaires avant d’accepter. Les deux contrats sont signés jusqu’à la fin de la saison.',
    '/jeu/transferts?onglet=offres', 'Examiner l’échange', 'direct-transfer-offer:' || v_offer_id::text || ':received', true
  );

  v_conversation_id := public.get_or_create_current_direct_conversation(v_seller.director_id);
  v_body := v_body || case when v_custom <> '' then E'\n\nMessage du DS :\n' || v_custom else '' end
    || E'\n\nVoir l’offre : /jeu/transferts?onglet=offres';
  if char_length(v_body) > 1000 then raise exception 'Le message associé à cette offre est trop long.'; end if;
  insert into public.direct_messages (conversation_id, sender_id, recipient_id, body, message_type, source_reference)
  values (v_conversation_id, v_context.director_id, v_seller.director_id, v_body, 'transfer_offer',
    'direct-transfer-offer:' || v_offer_id::text || ':chat') returning * into v_message;
  update public.direct_conversations set last_message_sender_id = v_context.director_id,
    last_message_body = v_body, last_message_at = v_message.created_at, updated_at = v_message.created_at
  where id = v_conversation_id;
  insert into public.direct_conversation_states (conversation_id, sporting_director_id, unread_count, last_activity_at)
  values (v_conversation_id, v_seller.director_id, 1, v_message.created_at)
  on conflict (conversation_id, sporting_director_id) do update
    set unread_count = public.direct_conversation_states.unread_count + 1, last_activity_at = excluded.last_activity_at;
  insert into public.direct_conversation_states (conversation_id, sporting_director_id, unread_count, last_read_at, last_activity_at)
  values (v_conversation_id, v_context.director_id, 0, v_message.created_at, v_message.created_at)
  on conflict (conversation_id, sporting_director_id) do update
    set unread_count = 0, last_read_at = excluded.last_read_at, last_activity_at = excluded.last_activity_at;
  return jsonb_build_object('offerId', v_offer_id, 'conversationId', v_conversation_id);
end;
$$;

create function public.respond_to_direct_transfer_offer(p_offer_id uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
set lock_timeout = '2s'
set statement_timeout = '8s'
as $$
declare
  v_context record;
  v_buyer record;
  v_offer public.direct_transfer_offers%rowtype;
  v_target_name text;
  v_offered_name text;
  v_target_contract_id uuid;
  v_other_contract_id uuid;
  v_target_net numeric;
  v_other_net numeric;
  v_available numeric;
  v_note text;
begin
  select director.id as director_id, assignment.team_id, season.id as season_id, season.game_year,
    coalesce(season.current_day_number, 1) as day_number, team_season.id as team_season_id, team_season.display_name
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment on assignment.sporting_director_id = director.id
    and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season on team_season.team_id = assignment.team_id and team_season.season_id = season.id
  where director.auth_user_id = auth.uid() and director.status = 'active' limit 1;
  if v_context is null then raise exception 'Aucune équipe active ne correspond au Directeur Sportif.'; end if;
  if p_accept is null then raise exception 'La décision transmise est invalide.'; end if;
  select offer.* into v_offer from public.direct_transfer_offers as offer where offer.id = p_offer_id;
  if v_offer.id is null or v_offer.seller_team_id <> v_context.team_id then raise exception 'Cette offre ne concerne pas votre équipe.'; end if;
  if v_offer.offered_rider_id is not null then
    -- Same season-first order as submission; cash-only core remains untouched.
    perform season.id from public.seasons as season
    where season.id = v_context.season_id and season.status = 'active'
    for share nowait;
    if not found then raise exception 'La saison a changé. Actualisez la page avant de répondre à cet échange.'; end if;
  end if;
  perform private.lock_direct_transfer_scope(v_context.season_id,
    array[v_offer.buyer_team_id, v_offer.seller_team_id], array[v_offer.rider_id, v_offer.offered_rider_id]);
  select offer.* into v_offer from public.direct_transfer_offers as offer where offer.id = p_offer_id for update nowait;
  if v_offer.status <> 'pending' then raise exception 'Cette offre a déjà reçu une réponse.'; end if;
  if v_offer.offered_rider_id is null then
    return private.respond_to_direct_transfer_offer_cash_20261022(p_offer_id, p_accept);
  end if;
  if v_offer.season_id <> v_context.season_id then raise exception 'Cet échange appartient à une saison terminée.'; end if;

  select concat_ws(' ', first_name, last_name) into v_target_name from public.riders where id = v_offer.rider_id;
  select concat_ws(' ', first_name, last_name) into v_offered_name from public.riders where id = v_offer.offered_rider_id;
  select team_season.id as team_season_id, team_season.display_name, director.id as director_id
  into v_buyer
  from public.team_seasons as team_season
  join public.team_manager_assignments as assignment on assignment.team_id = team_season.team_id
    and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.sporting_directors as director on director.id = assignment.sporting_director_id and director.status = 'active'
    and director.auth_user_id is not null
  where team_season.team_id = v_offer.buyer_team_id and team_season.season_id = v_context.season_id
    and not exists (select 1 from public.alpha_bot_managers as bot where bot.sporting_director_id = director.id)
  limit 1;

  if not p_accept then
    update public.direct_transfer_offers set status = 'rejected', responded_by_director_id = v_context.director_id, responded_at = now()
    where id = v_offer.id;
    insert into public.sporting_director_messages (
      sporting_director_id, season_id, team_season_id, message_type, sender_name, subject, preview, body,
      action_href, action_label, source_reference, is_important
    ) values (
      v_offer.submitted_by_director_id, v_context.season_id, v_buyer.team_season_id, 'system', v_context.display_name,
      'Échange refusé pour ' || v_target_name, v_context.display_name || ' a refusé votre proposition.',
      format('%s a refusé votre proposition de %s + %s %s contre %s.', v_context.display_name,
        v_offered_name, v_offer.offered_amount, v_offer.currency_code, v_target_name),
      '/jeu/transferts?onglet=offres', 'Voir le bureau des transferts',
      'direct-transfer-offer:' || v_offer.id::text || ':rejected', false
    );
    return null;
  end if;

  if v_buyer.team_season_id is null or v_buyer.director_id <> v_offer.submitted_by_director_id
    or exists (select 1 from public.alpha_bot_managers as bot where bot.sporting_director_id = v_context.director_id) then
    raise exception 'L’un des responsables de cet échange n’est plus un joueur actif de son équipe.';
  end if;
  perform private.assert_rider_trade_eligible(v_offer.rider_id, v_offer.seller_team_id, v_context.season_id, v_context.game_year);
  perform private.assert_rider_trade_eligible(v_offer.offered_rider_id, v_offer.buyer_team_id, v_context.season_id, v_context.game_year);
  perform private.assert_trade_roster_capacity(v_offer.buyer_team_id, v_context.game_year, v_offer.rider_id, v_offer.offered_rider_id);
  perform private.assert_trade_roster_capacity(v_offer.seller_team_id, v_context.game_year, v_offer.offered_rider_id, v_offer.rider_id);
  select team_season.cash_balance - public.get_team_transfer_reserved_budget(v_offer.buyer_team_id, v_offer.id, null)
  into v_available from public.team_seasons as team_season where team_season.id = v_buyer.team_season_id;
  if v_offer.offered_amount > 0 and v_available < v_offer.offered_amount then
    raise exception 'L’équipe à l’origine de l’échange ne dispose plus de la trésorerie nécessaire.';
  end if;

  -- Accepted first so departure triggers invalidate only competing offers.
  -- Any subsequent error rolls this status AND both transfers back together.
  update public.direct_transfer_offers set status = 'accepted', responded_by_director_id = v_context.director_id, responded_at = now()
  where id = v_offer.id;
  perform public.cancel_pending_direct_transfer_offers(v_offer.rider_id, v_offer.seller_team_id, 'Le coureur a accepté une autre offre.');
  perform public.cancel_pending_direct_transfer_offers(v_offer.offered_rider_id, v_offer.buyer_team_id, 'Le coureur a été inclus dans un échange accepté.');

  -- Cancel future renewals, then BOTH existing contracts before inserting any
  -- successor. Normal departure triggers free equipment, freeze nationality
  -- progress and cancel unpaid salary installments. They remain enabled.
  update public.rider_contracts set status = 'cancelled'
  where rider_id in (v_offer.rider_id, v_offer.offered_rider_id) and status = 'planned';
  update public.rider_contracts set status = 'terminated'
  where rider_id in (v_offer.rider_id, v_offer.offered_rider_id) and status = 'active';

  -- Do not carry source-team tactical equipment or staff assignments to the
  -- destination. Historical stage equipment/sessions/results are preserved.
  delete from public.race_stage_equipment_assignments as equipment using public.stages as stage
  where equipment.rider_id in (v_offer.rider_id, v_offer.offered_rider_id)
    and stage.id = equipment.stage_id and stage.status not in ('completed', 'cancelled');
  update public.rider_training_plan_versions set trainer_contract_id = null
  where rider_id in (v_offer.rider_id, v_offer.offered_rider_id)
    and season_id = v_context.season_id and effective_from_day_number >= v_context.day_number;

  insert into public.rider_contracts (
    rider_id, team_id, start_season_id, end_season_id, salary_per_season, currency, currency_code,
    status, signed_at, acquisition_type, transfer_locked_season_id, transfer_fee
  ) values (
    v_offer.rider_id, v_offer.buyer_team_id, v_context.season_id, v_context.season_id,
    v_offer.salary_before_team_discounts, v_offer.currency_code, v_offer.currency_code,
    'active', now(), 'direct_offer', v_context.season_id, v_offer.offered_amount
  ) returning id, salary_per_season into v_target_contract_id, v_target_net;
  insert into public.rider_contracts (
    rider_id, team_id, start_season_id, end_season_id, salary_per_season, currency, currency_code,
    status, signed_at, acquisition_type, transfer_locked_season_id, transfer_fee
  ) values (
    v_offer.offered_rider_id, v_offer.seller_team_id, v_context.season_id, v_context.season_id,
    v_offer.offered_rider_salary_before_team_discounts, v_offer.currency_code, v_offer.currency_code,
    'active', now(), 'direct_offer', v_context.season_id, 0
  ) returning id, salary_per_season into v_other_contract_id, v_other_net;
  -- Only the actual cash adjustment is a transfer fee. In particular the
  -- reverse contract must NEVER produce a rebate on a fictitious rider value.
  update public.direct_transfer_offers set salary_per_season = v_target_net,
    offered_rider_salary_per_season = v_other_net where id = v_offer.id;

  if v_offer.offered_amount > 0 then
    insert into public.team_finance_transactions (
      team_season_id, day_number, amount, category, status, description, source_reference, posted_at
    ) values (
      v_buyer.team_season_id, v_context.day_number, -v_offer.offered_amount, 'transfer', 'posted',
      'Échange entrant · ' || v_target_name || ' contre ' || v_offered_name,
      'direct-transfer-purchase:' || v_offer.id::text, now()
    );
    update public.team_seasons set cash_balance = cash_balance - v_offer.offered_amount where id = v_buyer.team_season_id;
    insert into public.team_finance_transactions (
      team_season_id, day_number, amount, category, status, description, source_reference, posted_at
    ) values (
      v_context.team_season_id, v_context.day_number, v_offer.offered_amount, 'transfer', 'posted',
      'Échange sortant · ' || v_target_name || ' contre ' || v_offered_name,
      'direct-transfer-sale:' || v_offer.id::text, now()
    );
    update public.team_seasons set cash_balance = cash_balance + v_offer.offered_amount where id = v_context.team_season_id;
  end if;

  v_note := format('%s et %s ont été échangés, avec une somme de %s %s versée à %s. Les nouveaux contrats courent jusqu’à la fin de la saison.',
    v_target_name, v_offered_name, v_offer.offered_amount, v_offer.currency_code, v_context.display_name);
  insert into public.sporting_director_messages (
    sporting_director_id, season_id, team_season_id, message_type, sender_name, subject, preview, body,
    action_href, action_label, source_reference, is_important
  ) values (
    v_offer.submitted_by_director_id, v_context.season_id, v_buyer.team_season_id, 'system', v_context.display_name,
    'Échange accepté · ' || v_target_name, v_target_name || ' rejoint votre équipe.', v_note,
    '/jeu/coureurs/' || v_offer.rider_id::text, 'Voir le nouveau coureur', 'direct-transfer-offer:' || v_offer.id::text || ':accepted', true
  ), (
    v_context.director_id, v_context.season_id, v_context.team_season_id, 'system', v_buyer.display_name,
    'Échange réalisé · ' || v_offered_name, v_offered_name || ' rejoint votre équipe.', v_note,
    '/jeu/coureurs/' || v_offer.offered_rider_id::text, 'Voir le nouveau coureur', 'direct-transfer-offer:' || v_offer.id::text || ':accepted', true
  );
  return v_target_contract_id;
end;
$$;

create function public.cancel_current_direct_transfer_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set lock_timeout = '2s'
set statement_timeout = '8s'
as $$
declare
  v_director_id uuid;
  v_offer public.direct_transfer_offers%rowtype;
begin
  select director.id into v_director_id
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment on assignment.sporting_director_id = director.id
    and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.direct_transfer_offers as offer on offer.buyer_team_id = assignment.team_id and offer.id = p_offer_id
  where director.auth_user_id = auth.uid() and director.status = 'active' limit 1;
  if v_director_id is null then raise exception 'Vous ne pouvez retirer que les offres de votre équipe.'; end if;
  select offer.* into v_offer from public.direct_transfer_offers as offer where offer.id = p_offer_id;
  perform private.lock_direct_transfer_scope(v_offer.season_id,
    array[v_offer.buyer_team_id, v_offer.seller_team_id], array[v_offer.rider_id, v_offer.offered_rider_id]);
  select offer.* into v_offer from public.direct_transfer_offers as offer where offer.id = p_offer_id for update nowait;
  if v_offer.status = 'cancelled' then return; end if;
  if v_offer.status <> 'pending' then raise exception 'Cette offre a déjà reçu une réponse et ne peut plus être retirée.'; end if;
  update public.direct_transfer_offers set status = 'cancelled', responded_at = now(),
    responded_by_director_id = v_director_id, response_note = 'Offre retirée par l’équipe à l’origine de la proposition.'
  where id = v_offer.id;
end;
$$;

revoke all on function private.lock_direct_transfer_scope(uuid, uuid[], uuid[]) from public, anon, authenticated, service_role;
revoke all on function private.guard_live_rider_commitment_ownership() from public, anon, authenticated, service_role;
revoke all on function private.assert_rider_trade_eligible(uuid, uuid, uuid, integer) from public, anon, authenticated, service_role;
revoke all on function private.assert_trade_roster_capacity(uuid, integer, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function private.quote_direct_transfer_salary(uuid, uuid, uuid, numeric) from public, anon, authenticated, service_role;
revoke all on function private.submit_direct_transfer_offer_cash_20261022(uuid, numeric) from public, anon, authenticated, service_role;
revoke all on function private.respond_to_direct_transfer_offer_cash_20261022(uuid, boolean) from public, anon, authenticated, service_role;
revoke all on function public.submit_direct_transfer_offer(uuid, numeric) from public, anon, authenticated, service_role;
revoke all on function public.submit_direct_transfer_trade_offer(uuid, numeric, uuid, text) from public, anon;
grant execute on function public.submit_direct_transfer_trade_offer(uuid, numeric, uuid, text) to authenticated, service_role;
revoke all on function public.respond_to_direct_transfer_offer(uuid, boolean) from public, anon;
grant execute on function public.respond_to_direct_transfer_offer(uuid, boolean) to authenticated;
revoke all on function public.cancel_current_direct_transfer_offer(uuid) from public, anon;
grant execute on function public.cancel_current_direct_transfer_offer(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
