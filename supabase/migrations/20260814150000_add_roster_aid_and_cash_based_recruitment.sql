begin;

-- At the opening of a new season, help a managed team that has fewer than
-- five active riders. The transaction and mailbox source references make the
-- grant idempotent even if a season status is repaired or replayed.
create or replace function public.grant_understaffed_team_starting_aid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'active' or old.status = 'active' then
    return new;
  end if;

  with eligible_teams as (
    select team_season.id as team_season_id
    from public.team_seasons as team_season
    where team_season.season_id = new.id
      and team_season.status = 'active'
      and exists (
        select 1
        from public.team_manager_assignments as assignment
        join public.sporting_directors as director
          on director.id = assignment.sporting_director_id
         and director.status = 'active'
        where assignment.team_id = team_season.team_id
          and assignment.role = 'general_manager'
          and assignment.status = 'active'
      )
      and (
        select count(distinct contract.rider_id)
        from public.rider_contracts as contract
        where contract.team_id = team_season.team_id
          and contract.status = 'active'
      ) < 5
  ), granted as (
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
    select
      eligible.team_season_id,
      season_day.id,
      1,
      100000,
      'other',
      'posted',
      'Coup de pouce de début de saison pour effectif réduit',
      'understaffed-roster-aid:' || new.id::text,
      now()
    from eligible_teams as eligible
    join public.season_days as season_day
      on season_day.season_id = new.id
     and season_day.day_number = 1
    on conflict (team_season_id, source_reference) do nothing
    returning team_season_id
  )
  update public.team_seasons as team_season
  set cash_balance = team_season.cash_balance + 100000
  where team_season.id in (
    select granted.team_season_id from granted
  );

  insert into public.sporting_director_messages (
    sporting_director_id,
    season_id,
    team_season_id,
    message_type,
    sender_name,
    subject,
    preview,
    body,
    action_href,
    action_label,
    source_reference,
    is_important
  )
  select
    director.id,
    new.id,
    team_season.id,
    'system',
    'Direction financière',
    'Un coup de pouce de 100 000 € pour votre effectif',
    'Votre effectif compte moins de cinq coureurs en ce début de saison.',
    'Votre effectif compte moins de cinq coureurs actifs en ce début de saison. Une aide exceptionnelle de 100 000 € a été versée immédiatement dans votre trésorerie pour vous permettre de reconstruire votre équipe.',
    '/jeu/finances',
    'Voir les finances',
    'understaffed-roster-aid:' || new.id::text,
    true
  from public.team_seasons as team_season
  join public.team_manager_assignments as assignment
    on assignment.team_id = team_season.team_id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id
   and director.status = 'active'
  where team_season.season_id = new.id
    and exists (
      select 1
      from public.team_finance_transactions as finance_transaction
      where finance_transaction.team_season_id = team_season.id
        and finance_transaction.source_reference =
          'understaffed-roster-aid:' || new.id::text
    )
  on conflict (sporting_director_id, source_reference) do nothing;

  return new;
end;
$$;

drop trigger if exists zz_season_grants_understaffed_team_aid
  on public.seasons;
create trigger zz_season_grants_understaffed_team_aid
after update of status
on public.seasons
for each row execute function public.grant_understaffed_team_starting_aid();

revoke all on function public.grant_understaffed_team_starting_aid()
  from public, anon, authenticated;

-- Expose only the current DS's race-specific sponsor objectives. Calendar
-- services can then mark the matching editions without opening sponsor tables.
create or replace function public.get_current_team_sponsor_objective_races()
returns table (race_edition_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct race_objective.race_edition_id
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_sponsor_contracts as contract
    on contract.team_id = assignment.team_id
   and contract.role = 'principal'
   and contract.status = 'active'
  join public.sponsor_objectives as objective
    on objective.sponsor_offer_id = contract.sponsor_offer_id
   and objective.season_id = season.id
   and objective.objective_type = 'race_result'
   and objective.status = 'active'
  join public.race_result_objectives as race_objective
    on race_objective.objective_id = objective.id
  where director.auth_user_id = auth.uid()
    and director.status = 'active';
$$;

revoke all on function public.get_current_team_sponsor_objective_races()
  from public, anon;
grant execute on function public.get_current_team_sponsor_objective_races()
  to authenticated, service_role;

-- The registration summary already returns rider nationality. Add the team
-- registration nationality to the same response so both flags can be shown.
drop function if exists public.get_race_engaged_riders(uuid);
create function public.get_race_engaged_riders(
  p_race_edition_id uuid
)
returns table (
  team_id uuid,
  team_name text,
  team_short_name text,
  team_country_iso_alpha2 text,
  rider_id uuid,
  rider_first_name text,
  rider_last_name text,
  country_iso_alpha2 text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    team_season.team_id,
    team_season.display_name,
    team_season.short_name,
    team_country.iso_alpha2,
    rider.id,
    rider.first_name,
    rider.last_name,
    rider_country.iso_alpha2
  from public.race_registrations as registration
  join public.team_seasons as team_season
    on team_season.id = registration.team_season_id
  join public.countries as team_country
    on team_country.id = team_season.registration_country_id
  join public.race_rosters as roster
    on roster.race_registration_id = registration.id
   and roster.status in ('selected', 'confirmed')
  join public.riders as rider
    on rider.id = roster.rider_id
  join public.countries as rider_country
    on rider_country.id = rider.country_id
  where registration.race_edition_id = p_race_edition_id
    and registration.status = 'accepted'
  order by team_season.display_name, rider.last_name, rider.first_name;
$$;

revoke all on function public.get_race_engaged_riders(uuid)
  from public, anon;
grant execute on function public.get_race_engaged_riders(uuid)
  to authenticated, service_role;

-- Transfer commitments reserve only their immediate purchase price. Salaries
-- remain scheduled in the finance ledger and may legitimately take the future
-- projection below zero, where the weekly debt controls apply.
do $migration$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.get_team_transfer_reserved_budget(uuid,uuid,uuid)'::regprocedure
  ) into v_definition;

  if position('bid.amount + listing.salary_per_season as reserved_amount' in v_definition) = 0
    or position('offer.offered_amount + offer.salary_per_season' in v_definition) = 0
  then
    raise exception 'Le calcul des réservations de transfert a changé : migration interrompue.';
  end if;

  v_definition := replace(
    v_definition,
    'bid.amount + listing.salary_per_season as reserved_amount',
    'bid.amount as reserved_amount'
  );
  v_definition := replace(
    v_definition,
    'offer.offered_amount + offer.salary_per_season',
    'offer.offered_amount'
  );
  execute v_definition;
end;
$migration$;

do $migration$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.place_transfer_bid(uuid,numeric)'::regprocedure
  ) into v_definition;

  if position('team_season.id as team_season_id' in v_definition) = 0
    or position('v_available := public.get_projected_transfer_budget(v_context.team_season_id);' in v_definition) = 0
    or position('p_amount + v_listing.salary_per_season' in v_definition) = 0
  then
    raise exception 'La validation des enchères a changé : migration interrompue.';
  end if;

  v_definition := replace(
    v_definition,
    'team_season.id as team_season_id',
    'team_season.id as team_season_id, team_season.cash_balance'
  );
  v_definition := replace(
    v_definition,
    'v_available := public.get_projected_transfer_budget(v_context.team_season_id);',
    'v_available := v_context.cash_balance;'
  );
  v_definition := replace(
    v_definition,
    'p_amount + v_listing.salary_per_season',
    'p_amount'
  );
  v_definition := replace(
    v_definition,
    'Votre budget disponible ne couvre pas l’offre et la première saison de salaire.',
    'Votre trésorerie disponible ne couvre pas cette offre.'
  );
  execute v_definition;
end;
$migration$;

do $migration$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.settle_transfer_market()'::regprocedure
  ) into v_definition;

  if position('v_available := public.get_projected_transfer_budget(v_team_season_id);' in v_definition) = 0
    or position('v_available >= v_bid.amount + v_listing.salary_per_season' in v_definition) = 0
  then
    raise exception 'Le règlement des enchères a changé : migration interrompue.';
  end if;

  v_definition := replace(
    v_definition,
    'v_available := public.get_projected_transfer_budget(v_team_season_id);',
    'select team_season.cash_balance into v_available from public.team_seasons as team_season where team_season.id = v_team_season_id;'
  );
  v_definition := replace(
    v_definition,
    'v_available >= v_bid.amount + v_listing.salary_per_season',
    'v_available >= v_bid.amount'
  );
  execute v_definition;
end;
$migration$;

do $migration$
declare
  v_definition text;
  v_projected_check text := $check$
  if public.get_projected_transfer_budget(v_context.team_season_id) < v_salary then
    raise exception 'La trésorerie projetée ne permet pas d’assumer ce salaire.';
  end if;$check$;
begin
  select pg_get_functiondef(
    'public.sign_current_team_free_agent(uuid)'::regprocedure
  ) into v_definition;

  if position(v_projected_check in v_definition) = 0 then
    raise exception 'La validation des agents libres a changé : migration interrompue.';
  end if;

  v_definition := replace(v_definition, v_projected_check, '');
  execute v_definition;
end;
$migration$;

do $migration$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.submit_direct_transfer_offer(uuid,numeric)'::regprocedure
  ) into v_definition;

  if position('team_season.currency' in v_definition) = 0
    or position('public.get_projected_transfer_budget(v_context.team_season_id)' in v_definition) = 0
    or position('v_amount + v_salary' in v_definition) = 0
  then
    raise exception 'La validation des offres directes a changé : migration interrompue.';
  end if;

  v_definition := replace(
    v_definition,
    'team_season.currency',
    'team_season.currency, team_season.cash_balance'
  );
  v_definition := replace(
    v_definition,
    'public.get_projected_transfer_budget(v_context.team_season_id)',
    'v_context.cash_balance'
  );
  v_definition := replace(v_definition, 'v_amount + v_salary', 'v_amount');
  v_definition := replace(
    v_definition,
    'Votre budget disponible ne couvre pas l’offre et la première saison de salaire.',
    'Votre trésorerie disponible ne couvre pas cette offre.'
  );

  if position('v_context.cash_balance' in v_definition) = 0
    or position('public.get_projected_transfer_budget(v_context.team_season_id)' in v_definition) > 0
    or position('v_amount + v_salary' in v_definition) > 0
  then
    raise exception 'La trésorerie immédiate n’a pas été injectée dans les offres directes.';
  end if;
  execute v_definition;
end;
$migration$;

do $migration$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.respond_to_direct_transfer_offer(uuid,boolean)'::regprocedure
  ) into v_definition;

  if position('public.get_projected_transfer_budget(v_buyer_team_season_id)' in v_definition) = 0
    or position('v_offer.offered_amount + v_offer.salary_per_season' in v_definition) = 0
  then
    raise exception 'Le règlement des offres directes a changé : migration interrompue.';
  end if;

  v_definition := replace(
    v_definition,
    'public.get_projected_transfer_budget(v_buyer_team_season_id)',
    '(select team_season.cash_balance from public.team_seasons as team_season where team_season.id = v_buyer_team_season_id)'
  );
  v_definition := replace(
    v_definition,
    'v_offer.offered_amount + v_offer.salary_per_season',
    'v_offer.offered_amount'
  );
  v_definition := replace(
    v_definition,
    'L’équipe acheteuse ne dispose plus du budget nécessaire.',
    'L’équipe acheteuse ne dispose plus de la trésorerie nécessaire.'
  );
  if position('public.get_projected_transfer_budget(v_buyer_team_season_id)' in v_definition) > 0
    or position('v_offer.offered_amount + v_offer.salary_per_season' in v_definition) > 0
  then
    raise exception 'La trésorerie immédiate n’a pas été injectée dans le règlement des offres directes.';
  end if;
  execute v_definition;
end;
$migration$;

-- The latest public staff RPC delegates to this renamed implementation. Keep
-- the immediate signing fee and already-due salary check, but remove the
-- season-wide projection gate.
do $migration$
declare
  v_definition text;
  v_block_start integer;
  v_block_end integer;
begin
  select pg_get_functiondef(
    'public.hire_current_team_staff_legacy_20260812(uuid)'::regprocedure
  ) into v_definition;

  v_block_start := position(
    'if v_projected_budget < v_listing.signing_fee + v_listing.salary_per_season then'
    in v_definition
  );
  if v_block_start = 0 then
    raise exception 'La validation financière du staff a changé : migration interrompue.';
  end if;

  v_block_end := position('end if;' in substring(v_definition from v_block_start));
  if v_block_end = 0 then
    raise exception 'La fin de la validation financière du staff est introuvable.';
  end if;
  v_definition := overlay(
    v_definition placing '' from v_block_start
    for v_block_end + char_length('end if;') - 1
  );
  if position('if v_projected_budget < v_listing.signing_fee + v_listing.salary_per_season then' in v_definition) > 0 then
    raise exception 'La projection annuelle du staff n’a pas été retirée.';
  end if;
  execute v_definition;
end;
$migration$;

notify pgrst, 'reload schema';

commit;
