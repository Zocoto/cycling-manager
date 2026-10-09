begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

-- Two *consecutive full seasons*, not two years since a contract was signed.
-- Actual departure metadata takes precedence over the contractual end date.
create function public.has_rider_two_full_unattached_seasons(
  p_rider_id uuid, p_season_id uuid
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.riders rider
    join public.seasons current_season on current_season.id = p_season_id
    join public.seasons previous_season
      on previous_season.game_year = current_season.game_year - 1
     and previous_season.status = 'completed'
    where rider.id = p_rider_id
      and rider.status = 'free_agent'
      and current_season.status = 'completed'
      and rider.created_at <= (
        previous_season.starts_on::timestamp at time zone 'Europe/Paris'
      )
      and not exists (
        select 1 from public.rider_contracts contract
        join public.seasons starts on starts.id = contract.start_season_id
        join public.seasons ends
          on ends.id = coalesce(contract.left_season_id, contract.end_season_id)
        where contract.rider_id = rider.id
          and contract.status in ('active', 'completed', 'terminated')
          and starts.game_year <= current_season.game_year
          and ends.game_year >= previous_season.game_year
      )
      and not exists (
        select 1 from public.rider_contracts successor
        where successor.rider_id = rider.id
          and successor.status in ('active', 'planned')
      )
  );
$$;

alter table public.rider_history_archives
  drop constraint rider_history_archives_reason_allowed;
alter table public.rider_history_archives
  add constraint rider_history_archives_reason_allowed check (
    retirement_reason in (
      'no_team', 'no_race', 'no_team_and_no_race', 'two_seasons_without_team'
    )
  );

do $patch$
declare
  v_definition text;
  v_anchor constant text := 'where rider.status = ''free_agent''';
  v_count integer;
  v_reason_block text;
  v_team_block text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.archive_inactive_riders_for_season(uuid)'::regprocedure
  ) into v_definition;
  v_count := (length(v_definition) - length(replace(v_definition, v_anchor, '')))
    / length(v_anchor);
  if v_count <> 1 or position('free_agent_reward.uci_points > 0' in v_definition) = 0 then
    raise exception 'Garde de retraite inattendue : aucune modification appliquée.';
  end if;
  v_definition := replace(v_definition, v_anchor, v_anchor || E'\n      and public.has_rider_two_full_unattached_seasons(rider.id, p_season_id)');
  select (regexp_match(v_definition, 'v_reason := case[^;]*end;'))[1] into v_reason_block;
  if v_reason_block is null or position('''no_team_and_no_race''' in v_reason_block) = 0 then
    raise exception 'Motif de retraite inattendu : aucune modification appliquée.';
  end if;
  v_definition := replace(v_definition, v_reason_block, 'v_reason := ''two_seasons_without_team'';');
  select (regexp_match(v_definition, 'select exists \([^;]*\) into v_has_team;'))[1] into v_team_block;
  if v_team_block is null or position('on end_season.id = contract.end_season_id' in v_team_block) = 0 then
    raise exception 'Historique des contrats inattendu : aucune modification appliquée.';
  end if;
  v_definition := replace(v_definition, v_team_block,
    replace(v_team_block, 'on end_season.id = contract.end_season_id',
      'on end_season.id = coalesce(contract.left_season_id, contract.end_season_id)'));
  execute v_definition;
end;
$patch$;

-- No backfill of sporting gains: activation is after this deployment. Daily
-- work uses the same 08:00 Paris cutoff as club training, in bounded batches.
create table public.free_agent_training_state (
  singleton boolean primary key default true check (singleton),
  activated_at timestamptz not null default now(),
  last_completed_cutoff timestamptz
);
insert into public.free_agent_training_state(singleton) values (true);

create table public.free_agent_training_sessions (
  rider_id uuid not null references public.riders(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  season_day_id uuid not null references public.season_days(id) on delete cascade,
  status text not null check (status in ('completed', 'skipped_injury', 'skipped_low_form')),
  progress_milli jsonb not null default '{}'::jsonb,
  decline_milli jsonb not null default '{}'::jsonb,
  rating_changes jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now(),
  primary key (rider_id, season_day_id)
);
create index free_agent_training_sessions_day_idx
  on public.free_agent_training_sessions(season_day_id, rider_id);
alter table public.free_agent_training_state enable row level security;
alter table public.free_agent_training_sessions enable row level security;
revoke all on table public.free_agent_training_state, public.free_agent_training_sessions
  from public, anon, authenticated;
grant all on table public.free_agent_training_state, public.free_agent_training_sessions
  to service_role;

create function public.settle_due_free_agent_training(p_limit integer default 250)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_state record;
  v_day record;
  v_rider record;
  v_stat record;
  v_progress record;
  v_cutoff timestamptz;
  v_status text;
  v_processed integer := 0;
  v_completed integer := 0;
  v_limit integer;
  v_strongest integer;
  v_total integer;
  v_cap integer;
  v_age_factor numeric;
  v_potential_factor numeric;
  v_decline integer;
  v_gain integer;
  v_balance integer;
  v_change integer;
  v_gain_cap integer;
  v_iron_health boolean;
  v_progress_json jsonb;
  v_decline_json jsonb;
  v_changes_json jsonb;
begin
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'Le lot d entraînement autonome doit contenir entre 1 et 500 coureurs.';
  end if;
  v_limit := p_limit;
  if not pg_catalog.pg_try_advisory_xact_lock(
    pg_catalog.hashtextextended('free-agent-daily-training', 0)
  ) then
    return jsonb_build_object('processed_sessions', 0, 'busy', true);
  end if;
  select * into strict v_state from public.free_agent_training_state
    where singleton for update;
  for v_day in
    select day.*, season.game_year
    from public.season_days day
    join public.seasons season on season.id = day.season_id
    where season.status = 'active'
      and day.day_number <= coalesce(season.current_day_number, 1)
      and ((day.calendar_date::timestamp + time '08:00') at time zone 'Europe/Paris') >= v_state.activated_at
      and ((day.calendar_date::timestamp + time '08:00') at time zone 'Europe/Paris') <= now()
      and (v_state.last_completed_cutoff is null or
        ((day.calendar_date::timestamp + time '08:00') at time zone 'Europe/Paris') > v_state.last_completed_cutoff)
    order by day.calendar_date, day.day_number
  loop
    v_cutoff := (v_day.calendar_date::timestamp + time '08:00') at time zone 'Europe/Paris';
    for v_rider in
      select rating.*, rider.potential_steps, rider.decline_resistance_multiplier
      from public.riders rider
      join public.rider_season_ratings rating
        on rating.rider_id = rider.id and rating.season_id = v_day.season_id
      where rider.status = 'free_agent'
        and rider.created_at <= v_cutoff
        and not exists (
          select 1 from public.rider_contracts current_contract
          where current_contract.rider_id = rider.id and current_contract.status = 'active'
        )
        and not exists (
          select 1 from public.rider_contracts contract
          join public.seasons starts on starts.id = contract.start_season_id
          join public.seasons ends on ends.id = coalesce(contract.left_season_id, contract.end_season_id)
          where contract.rider_id = rider.id
            and contract.status in ('active', 'completed', 'terminated')
            and coalesce(contract.signed_at, contract.created_at) <= v_cutoff
            and starts.game_year <= v_day.game_year
            and (ends.game_year > v_day.game_year or
              (ends.game_year = v_day.game_year and coalesce(contract.left_day_number, 28) >= v_day.day_number))
        )
        and not exists (
          select 1 from public.rider_training_sessions club_session
          where club_session.rider_id = rider.id and club_session.season_day_id = v_day.id
        )
        and not exists (
          select 1 from public.free_agent_training_sessions existing
          where existing.rider_id = rider.id and existing.season_day_id = v_day.id
        )
      order by rider.id
      limit (v_limit - v_processed)
      for update of rider, rating
    loop
      v_status := case when exists (
        select 1 from public.rider_injuries injury
        where injury.rider_id = v_rider.rider_id and injury.status in ('active', 'recovered')
          and injury.started_at < v_cutoff and injury.expected_recovery_at > v_cutoff
      ) then 'skipped_injury'
      when coalesce((
        select condition.form from public.rider_condition_states condition
        join public.season_days condition_day on condition_day.id = condition.season_day_id
        where condition.rider_id = v_rider.rider_id
          and condition_day.season_id = v_day.season_id
          and condition_day.day_number <= v_day.day_number
        order by condition_day.day_number desc, condition.updated_at desc limit 1
      ), 75) < 50 then 'skipped_low_form' else 'completed' end;
      v_iron_health := exists (
        select 1 from public.rider_special_abilities ability
        where ability.rider_id = v_rider.rider_id and ability.ability_code = 'iron_health'
      );
      v_age_factor := case
        when v_rider.age <= 21 then 1 when v_rider.age <= 24 then 0.95
        when v_rider.age <= 27 then 0.85 when v_rider.age <= 29 then 0.72
        when v_rider.age <= 31 then 0.55
        when v_rider.age <= 36 then 0.5 - (v_rider.age - 32) * 0.04
        else greatest(0.3, 0.34 - (v_rider.age - 36) * 0.01) end;
      v_potential_factor := 0.6 + least(8, greatest(1, v_rider.potential_steps)) * 0.05;
      v_total := v_rider.mountain + v_rider.hills + v_rider.flat + v_rider.time_trial
        + v_rider.cobbles + v_rider.sprint + v_rider.acceleration + v_rider.downhill
        + v_rider.endurance + v_rider.resistance + v_rider.recovery + v_rider.breakaway + v_rider.prologue;
      v_cap := public.get_rider_potential_overall_cap(v_rider.potential_steps) * 13;
      v_strongest := greatest(v_rider.mountain, v_rider.hills, v_rider.flat,
        v_rider.time_trial, v_rider.cobbles, v_rider.sprint, v_rider.acceleration,
        v_rider.downhill, v_rider.endurance, v_rider.resistance, v_rider.recovery,
        v_rider.breakaway, v_rider.prologue);
      v_progress_json := '{}'::jsonb;
      v_decline_json := '{}'::jsonb;
      v_changes_json := '{}'::jsonb;
      v_decline := round(public.get_rider_season_decline_points(
        v_rider.age, v_rider.decline_resistance_multiplier, v_iron_health
      ) * 1000.0 / 28.0)::integer;
      if exists (
        select 1 from public.halloween_rider_effects effect
        where effect.rider_id = v_rider.rider_id and effect.item_id = 'immortality-pact'
          and v_cutoff >= effect.used_at and v_cutoff < effect.protection_expires_at
      ) then v_decline := 0; end if;

      for v_stat in select * from (values
        ('mountain', v_rider.mountain), ('hills', v_rider.hills), ('flat', v_rider.flat),
        ('time_trial', v_rider.time_trial), ('cobbles', v_rider.cobbles), ('sprint', v_rider.sprint),
        ('acceleration', v_rider.acceleration), ('downhill', v_rider.downhill),
        ('endurance', v_rider.endurance), ('resistance', v_rider.resistance),
        ('recovery', v_rider.recovery), ('breakaway', v_rider.breakaway), ('prologue', v_rider.prologue)
      ) stats(stat_code, current_rating)
      loop
        insert into public.rider_training_stat_progress(rider_id, season_id, stat_code, initial_rating)
        values(v_rider.rider_id, v_day.season_id, v_stat.stat_code, v_stat.current_rating)
        on conflict(rider_id, season_id, stat_code) do nothing;
        select * into strict v_progress from public.rider_training_stat_progress progress
        where progress.rider_id = v_rider.rider_id and progress.season_id = v_day.season_id
          and progress.stat_code = v_stat.stat_code for update;
        v_gain := case when v_status = 'completed' then greatest(0, round(
          (10000.0 / 28.0) * 0.40 * v_age_factor * v_potential_factor
          * public.get_pro_training_rating_progress_factor(v_stat.current_rating)
          * case when v_stat.current_rating >= v_strongest - 5 then 1 else 0.35 end
          * public.get_rider_training_progress_multiplier(v_rider.rider_id)
        )::integer) else 0 end;
        v_balance := v_progress.balance_milli + v_gain - v_decline;
        v_change := 0;
        v_gain_cap := case when v_progress.initial_rating < 60 then 18
          when v_progress.initial_rating < 70 then 12 when v_progress.initial_rating < 80 then 8
          when v_progress.initial_rating < 90 then 4 else 2 end;
        if v_rider.age < 32 then
          if v_balance >= 1000 and v_stat.current_rating < 100
            and v_progress.rating_gain < v_gain_cap and v_total < v_cap then
            v_change := least(floor(v_balance / 1000.0)::integer,
              100 - v_stat.current_rating, v_gain_cap - v_progress.rating_gain, v_cap - v_total);
            v_balance := v_balance - v_change * 1000;
          elsif v_stat.current_rating >= 100 or v_progress.rating_gain >= v_gain_cap or v_total >= v_cap then
            v_balance := least(v_balance, 999);
          end if;
        else
          if v_balance <= -1000 and v_stat.current_rating > 0 then
            v_change := -least(floor(abs(v_balance) / 1000.0)::integer, v_stat.current_rating);
            v_balance := v_balance - v_change * 1000;
          elsif v_balance >= 1000 and v_stat.current_rating < v_progress.initial_rating and v_total < v_cap then
            v_change := least(floor(v_balance / 1000.0)::integer,
              v_progress.initial_rating - v_stat.current_rating, v_cap - v_total);
            v_balance := v_balance - v_change * 1000;
          elsif v_stat.current_rating >= v_progress.initial_rating then
            v_balance := least(v_balance, 999);
          end if;
        end if;
        update public.rider_training_stat_progress progress set
          balance_milli = v_balance, total_training_milli = total_training_milli + v_gain,
          rating_gain = rating_gain + greatest(0, v_change), rating_loss = rating_loss + greatest(0, -v_change), updated_at = now()
        where progress.rider_id = v_rider.rider_id and progress.season_id = v_day.season_id
          and progress.stat_code = v_stat.stat_code;
        v_total := v_total + v_change;
        v_progress_json := v_progress_json || jsonb_build_object(v_stat.stat_code, v_gain);
        v_decline_json := v_decline_json || jsonb_build_object(v_stat.stat_code, v_decline);
        if v_change <> 0 then v_changes_json := v_changes_json || jsonb_build_object(v_stat.stat_code, v_change); end if;
      end loop;
      update public.rider_season_ratings set
        mountain = mountain + coalesce((v_changes_json ->> 'mountain')::integer, 0),
        hills = hills + coalesce((v_changes_json ->> 'hills')::integer, 0),
        flat = flat + coalesce((v_changes_json ->> 'flat')::integer, 0),
        time_trial = time_trial + coalesce((v_changes_json ->> 'time_trial')::integer, 0),
        cobbles = cobbles + coalesce((v_changes_json ->> 'cobbles')::integer, 0),
        sprint = sprint + coalesce((v_changes_json ->> 'sprint')::integer, 0),
        acceleration = acceleration + coalesce((v_changes_json ->> 'acceleration')::integer, 0),
        downhill = downhill + coalesce((v_changes_json ->> 'downhill')::integer, 0),
        endurance = endurance + coalesce((v_changes_json ->> 'endurance')::integer, 0),
        resistance = resistance + coalesce((v_changes_json ->> 'resistance')::integer, 0),
        recovery = recovery + coalesce((v_changes_json ->> 'recovery')::integer, 0),
        breakaway = breakaway + coalesce((v_changes_json ->> 'breakaway')::integer, 0),
        prologue = prologue + coalesce((v_changes_json ->> 'prologue')::integer, 0), updated_at = now()
      where rider_id = v_rider.rider_id and season_id = v_day.season_id;
      insert into public.free_agent_training_sessions(rider_id, season_id, season_day_id, status, progress_milli, decline_milli, rating_changes)
      values(v_rider.rider_id, v_day.season_id, v_day.id, v_status, v_progress_json, v_decline_json, v_changes_json);
      v_processed := v_processed + 1;
      if v_status = 'completed' then v_completed := v_completed + 1; end if;
    end loop;
    if v_processed >= v_limit then
      return jsonb_build_object('processed_sessions', v_processed,
        'completed_sessions', v_completed, 'more_due', true);
    end if;
    update public.free_agent_training_state set last_completed_cutoff = v_cutoff where singleton;
  end loop;
  return jsonb_build_object('processed_sessions', v_processed,
    'completed_sessions', v_completed, 'more_due', false);
end;
$$;

-- Keep the current club engine, including every existing bonus. Add only a
-- cross-ledger uniqueness guard so a signing cannot create a second session.
do $patch$
declare v_definition text; v_anchor constant text := 'where rider.status = ''active'''; v_count integer;
begin
  select pg_catalog.pg_get_functiondef('public.settle_due_training_sessions()'::regprocedure) into v_definition;
  v_count := (length(v_definition) - length(replace(v_definition, v_anchor, ''))) / length(v_anchor);
  if v_count <> 1 then raise exception 'Filtre d entraînement professionnel inattendu.'; end if;
  execute replace(v_definition, v_anchor, v_anchor || E'\n        and not exists (select 1 from public.free_agent_training_sessions autonomous_session where autonomous_session.rider_id = rider.id and autonomous_session.season_day_id = v_day.id)');
end;
$patch$;

do $patch$
declare v_definition text; v_anchor constant text := 'from public.settle_due_training_sessions_throttled() as settlement;'; v_count integer;
begin
  select pg_catalog.pg_get_functiondef('public.run_game_maintenance_task(text)'::regprocedure) into v_definition;
  v_count := (length(v_definition) - length(replace(v_definition, v_anchor, ''))) / length(v_anchor);
  if v_count <> 1 then raise exception 'Point de maintenance d entraînement inattendu.'; end if;
  execute replace(v_definition, v_anchor, v_anchor || E'\n      v_result := coalesce(v_result, ''{}''::jsonb) || jsonb_build_object(''free_agent_training'', public.settle_due_free_agent_training());');
end;
$patch$;

revoke all on function public.has_rider_two_full_unattached_seasons(uuid, uuid),
  public.settle_due_free_agent_training(integer) from public, anon, authenticated;
grant execute on function public.has_rider_two_full_unattached_seasons(uuid, uuid),
  public.settle_due_free_agent_training(integer) to service_role;
comment on function public.archive_inactive_riders_for_season(uuid) is
  'Retraite après deux saisons complètes consécutives sans équipe, avec conservation des agents libres ayant marqué des points UCI.';
comment on function public.settle_due_free_agent_training(integer) is
  'Entraînement autonome quotidien modéré, à 8 h Paris, borné et idempotent, sans bonus de structure ni gains rétroactifs.';
notify pgrst, 'reload schema';
commit;
