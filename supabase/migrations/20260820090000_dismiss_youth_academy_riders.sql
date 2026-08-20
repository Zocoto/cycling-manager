begin;

alter table public.youth_academy_riders
  drop constraint if exists youth_academy_riders_status_allowed;

alter table public.youth_academy_riders
  add constraint youth_academy_riders_status_allowed check (
    status in ('active', 'recruited', 'promoted', 'free_agent', 'released')
  );

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
  v_age integer;
  v_new_rider_id uuid;
  v_development_team_id uuid;
  v_withdrawn_registration_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Vous devez être authentifié.';
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

  v_tuition_cost := round(v_academy.tuition_per_season, 2);
  if v_cash_balance < v_tuition_cost then
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
    'withdrawnRegistrationCount', v_withdrawn_registration_count
  );
end;
$$;

revoke all on function public.dismiss_current_team_youth_rider(uuid)
from public;
grant execute on function public.dismiss_current_team_youth_rider(uuid)
to authenticated;

comment on function public.dismiss_current_team_youth_rider(uuid) is
  'Libère un junior contre son coût annuel, annule ses frais futurs et le rend agent libre à partir de 16 ans.';

commit;
