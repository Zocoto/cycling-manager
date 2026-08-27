-- Permet aux équipes dont la trésorerie est strictement négative de rompre
-- gratuitement les contrats des coureurs, du staff et des juniors.

begin;

create or replace function public.dismiss_current_team_staff(
  p_contract_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_contract record;
  v_cash_balance numeric(14, 2);
  v_due_installments integer;
  v_regular_installment numeric(14, 2);
  v_due_current_salary numeric(14, 2);
  v_current_remaining numeric(14, 2);
  v_compensation numeric(14, 2);
  v_terminated_at timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Vous devez être authentifié pour licencier un membre du staff.';
  end if;

  if p_contract_id is null then
    raise exception 'Le contrat de staff est obligatoire.';
  end if;

  perform public.settle_current_team_finances();

  select
    director.id as director_id,
    assignment.team_id,
    season.id as season_id,
    season.current_day_number,
    team_season.id as team_season_id,
    team_season.currency,
    season_day.id as season_day_id
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
  join public.season_days as season_day
    on season_day.season_id = season.id
   and season_day.day_number = season.current_day_number
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  select team_season.cash_balance
  into v_cash_balance
  from public.team_seasons as team_season
  where team_season.id = v_context.team_season_id
  for update;

  select
    contract.id,
    contract.staff_member_id,
    contract.team_id,
    contract.salary_per_season,
    contract.currency_code,
    contract.status,
    contract.termination_compensation,
    member.first_name,
    member.last_name
  into v_contract
  from public.staff_contracts as contract
  join public.staff_members as member
    on member.id = contract.staff_member_id
  where contract.id = p_contract_id
    and contract.team_id = v_context.team_id
  for update of contract;

  if v_contract is null then
    raise exception 'Ce contrat de staff est introuvable ou ne vous appartient pas.';
  end if;

  if v_contract.status = 'terminated'
    and v_contract.termination_compensation is not null then
    return v_contract.termination_compensation;
  end if;

  if v_contract.status <> 'active' then
    raise exception 'Seul un contrat de staff actif peut être rompu.';
  end if;

  v_regular_installment := round(v_contract.salary_per_season / 4, 2);
  v_due_installments := least(
    4,
    greatest(
      0,
      floor(v_context.current_day_number / 7.0)::integer
    )
  );
  v_due_current_salary := case
    when v_due_installments < 4
      then v_regular_installment * v_due_installments
    else v_contract.salary_per_season
  end;
  v_current_remaining := greatest(
    0,
    v_contract.salary_per_season - v_due_current_salary
  );
  v_compensation := case
    when v_cash_balance < 0 then 0
    else round(v_current_remaining, 2)
  end;

  update public.staff_rider_assignments
  set
    status = 'ended',
    ended_at = v_terminated_at
  where staff_contract_id = v_contract.id
    and status = 'active';

  update public.youth_scouting_missions
  set
    status = 'cancelled',
    updated_at = v_terminated_at
  where scout_contract_id = v_contract.id
    and status = 'active';

  update public.staff_academy_trainings
  set
    status = 'cancelled',
    updated_at = v_terminated_at
  where staff_contract_id = v_contract.id
    and status = 'active';

  update public.staff_contracts
  set
    status = 'terminated',
    terminated_at = v_terminated_at,
    termination_compensation = v_compensation,
    termination_season_id = v_context.season_id,
    termination_day_number = v_context.current_day_number
  where id = v_contract.id;

  if v_compensation > 0 then
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
      v_context.current_day_number,
      -v_compensation,
      'staff_salary',
      'posted',
      'Indemnité de licenciement de '
        || v_contract.first_name || ' ' || v_contract.last_name,
      'staff-dismissal:' || v_contract.id::text,
      v_terminated_at
    );
  end if;

  perform public.settle_current_team_finances();

  return v_compensation;
end;
$$;

comment on function public.dismiss_current_team_staff(uuid) is
  'Licencie un membre du staff du DS connecté ; la rupture est gratuite si la trésorerie verrouillée est négative.';

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
  v_cash_balance numeric(14, 2);
  v_compensation numeric(14, 2);
  v_mutual_agreement boolean;
  v_rider_name text;
begin
  if auth.uid() is null then
    raise exception 'Vous devez être authentifié pour licencier un coureur.';
  end if;

  if p_rider_id is null then
    raise exception 'Le coureur est obligatoire.';
  end if;

  perform public.settle_current_team_finances();
  perform public.settle_transfer_market();

  select
    director.id as director_id,
    assignment.team_id,
    season.id as season_id,
    coalesce(season.current_day_number, 1) as day_number,
    team_season.id as team_season_id,
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

  select team_season.cash_balance
  into v_cash_balance
  from public.team_seasons as team_season
  where team_season.id = v_context.team_season_id
  for update;

  v_mutual_agreement := v_cash_balance < 0;

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

  v_compensation := case
    when v_mutual_agreement then 0
    else public.calculate_rider_dismissal_compensation(
      v_context.team_id,
      p_rider_id,
      v_context.season_id
    )
  end;
  if not v_mutual_agreement and v_cash_balance < v_compensation then
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
    'currency', v_context.currency,
    'mutualAgreement', v_mutual_agreement
  );
end;
$$;

comment on function public.dismiss_current_team_rider(uuid) is
  'Libère un coureur du DS connecté ; la rupture est gratuite si la trésorerie verrouillée est négative.';

create or replace function public.dismiss_current_team_youth_rider(
  p_academy_rider_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_academy public.youth_academy_riders%rowtype;
  v_cash_balance numeric(14, 2);
  v_tuition_cost numeric(14, 2);
  v_mutual_agreement boolean;
  v_age integer;
  v_new_rider_id uuid;
  v_development_team_id uuid;
  v_withdrawn_registration_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Vous devez être authentifié.';
  end if;

  if p_academy_rider_id is null then
    raise exception 'Le junior est obligatoire.';
  end if;

  perform public.settle_current_team_finances();

  select
    assignment.team_id,
    season.id as season_id,
    season.game_year,
    coalesce(season.current_day_number, 1) as day_number,
    season_day.id as season_day_id,
    team_season.id as team_season_id,
    team_season.currency
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
  join public.season_days as season_day
    on season_day.season_id = season.id
   and season_day.day_number = coalesce(season.current_day_number, 1)
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  select team_season.cash_balance
  into v_cash_balance
  from public.team_seasons as team_season
  where team_season.id = v_context.team_season_id
  for update;

  v_mutual_agreement := v_cash_balance < 0;

  select academy.*
  into v_academy
  from public.youth_academy_riders as academy
  where academy.id = p_academy_rider_id
    and academy.team_id = v_context.team_id
  for update;

  if v_academy.id is null
    or v_academy.status not in ('active', 'recruited') then
    raise exception 'Ce junior ne fait plus partie de votre école de cyclisme.';
  end if;

  v_tuition_cost := case
    when v_mutual_agreement then 0
    else round(v_academy.tuition_per_season, 2)
  end;
  if not v_mutual_agreement and v_cash_balance < v_tuition_cost then
    raise exception
      'La trésorerie immédiate ne permet pas de payer le coût annuel de scolarité (% %).',
      v_tuition_cost,
      v_context.currency;
  end if;

  v_age := v_context.game_year - v_academy.birth_game_year;

  select development_team.id
  into v_development_team_id
  from public.development_teams as development_team
  where development_team.team_id = v_context.team_id
    and development_team.season_id = v_context.season_id
    and development_team.status = 'active'
  limit 1
  for update;

  if v_development_team_id is not null and exists (
    select 1
    from public.development_race_registration_riders as selected
    join public.development_race_registrations as registration
      on registration.id = selected.registration_id
    join public.development_race_editions as edition
      on edition.id = registration.race_edition_id
    where registration.development_team_id = v_development_team_id
      and registration.status = 'registered'
      and selected.academy_rider_id = v_academy.id
      and edition.start_day_number <= v_context.day_number
  ) then
    raise exception
      'Ce junior est engagé dans une épreuve déjà commencée. Son renvoi sera possible après la publication des résultats.';
  end if;

  if v_age >= 16 then
    insert into public.riders (
      country_id,
      first_name,
      last_name,
      status,
      potential_steps
    ) values (
      v_academy.country_id,
      v_academy.first_name,
      v_academy.last_name,
      'free_agent',
      v_academy.potential_steps
    )
    returning id into v_new_rider_id;

    insert into public.rider_season_ratings (
      rider_id,
      season_id,
      age,
      mountain,
      hills,
      flat,
      time_trial,
      cobbles,
      sprint,
      acceleration,
      downhill,
      endurance,
      resistance,
      recovery,
      breakaway,
      prologue
    ) values (
      v_new_rider_id,
      v_context.season_id,
      v_age::smallint,
      least(100, greatest(0, round(34 + v_academy.mountain * 8)))::smallint,
      least(100, greatest(0, round(34 + v_academy.hills * 8)))::smallint,
      least(100, greatest(0, round(34 + v_academy.flat * 8)))::smallint,
      least(100, greatest(0, round(34 + v_academy.time_trial * 8)))::smallint,
      least(100, greatest(0, round(34 + v_academy.cobbles * 8)))::smallint,
      least(100, greatest(0, round(34 + v_academy.sprint * 8)))::smallint,
      least(100, greatest(0, round(34 + v_academy.acceleration * 8)))::smallint,
      least(100, greatest(0, round(34 + v_academy.downhill * 8)))::smallint,
      least(100, greatest(0, round(34 + v_academy.endurance * 8)))::smallint,
      least(100, greatest(0, round(34 + v_academy.resistance * 8)))::smallint,
      least(100, greatest(0, round(34 + v_academy.recovery * 8)))::smallint,
      least(100, greatest(0, round(34 + v_academy.breakaway * 8)))::smallint,
      least(100, greatest(0, round(34 + v_academy.prologue * 8)))::smallint
    );

    update public.youth_academy_riders
    set
      status = 'free_agent',
      promotion_game_year = null,
      promoted_rider_id = v_new_rider_id,
      updated_at = now()
    where id = v_academy.id;
  else
    update public.youth_academy_riders
    set
      status = 'released',
      promotion_game_year = null,
      promoted_rider_id = null,
      updated_at = now()
    where id = v_academy.id;
  end if;

  update public.team_finance_transactions as transaction
  set status = 'cancelled'
  where transaction.team_season_id = v_context.team_season_id
    and transaction.status = 'pending'
    and transaction.source_reference like
      'youth-tuition:' || v_academy.id::text || ':' || v_context.season_id::text || ':%';

  if v_tuition_cost > 0 then
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
      v_context.day_number,
      -v_tuition_cost,
      'training',
      'posted',
      'Renvoi de ' || v_academy.first_name || ' ' || v_academy.last_name
        || ' — coût annuel de scolarité',
      'youth-dismissal:' || v_academy.id::text,
      now()
    );

    update public.team_seasons
    set cash_balance = cash_balance - v_tuition_cost
    where id = v_context.team_season_id;
  end if;

  if v_development_team_id is not null then
    delete from public.development_race_registration_riders as selected
    using public.development_race_registrations as registration
    where selected.registration_id = registration.id
      and registration.development_team_id = v_development_team_id
      and registration.status = 'registered'
      and selected.academy_rider_id = v_academy.id;

    with invalid_registrations as (
      select registration.id
      from public.development_race_registrations as registration
      join public.development_race_editions as edition
        on edition.id = registration.race_edition_id
      where registration.development_team_id = v_development_team_id
        and registration.status = 'registered'
        and (
          select count(*)
          from public.development_race_registration_riders as selected
          where selected.registration_id = registration.id
        ) < edition.selection_minimum
    ),
    withdrawn as (
      update public.development_race_registrations as registration
      set status = 'withdrawn', updated_at = now()
      where registration.id in (
        select invalid_registration.id
        from invalid_registrations as invalid_registration
      )
      returning registration.id
    ),
    cleared_selections as (
      delete from public.development_race_registration_riders as selected
      where selected.registration_id in (
        select withdrawn_registration.id
        from withdrawn as withdrawn_registration
      )
    )
    select count(*)::integer
    into v_withdrawn_registration_count
    from withdrawn;

    delete from public.development_team_roster
    where development_team_id = v_development_team_id
      and academy_rider_id = v_academy.id;
  end if;

  return jsonb_build_object(
    'academyRiderId', v_academy.id,
    'riderId', v_new_rider_id,
    'riderName', concat_ws(' ', v_academy.first_name, v_academy.last_name),
    'age', v_age,
    'freeAgent', v_age >= 16,
    'tuitionCost', v_tuition_cost,
    'currency', v_context.currency,
    'mutualAgreement', v_mutual_agreement,
    'withdrawnRegistrationCount', v_withdrawn_registration_count
  );
end;
$$;

comment on function public.dismiss_current_team_youth_rider(uuid) is
  'Libère un junior du DS connecté ; le renvoi est gratuit si la trésorerie verrouillée est négative.';

revoke all on function public.dismiss_current_team_staff(uuid)
from public, anon;
grant execute on function public.dismiss_current_team_staff(uuid)
to authenticated;

revoke all on function public.dismiss_current_team_rider(uuid)
from public, anon;
grant execute on function public.dismiss_current_team_rider(uuid)
to authenticated;

revoke all on function public.dismiss_current_team_youth_rider(uuid)
from public, anon;
grant execute on function public.dismiss_current_team_youth_rider(uuid)
to authenticated;

commit;
