begin;

-- Professional contracts and current auction leads are firm commitments.
-- Scheduled youth promotions stay flexible until the J1 arbitration so the DS
-- can compare every prospect before choosing how to make room.
create or replace function public.get_team_roster_commitment_count(
  p_team_id uuid,
  p_game_year integer
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with contract_slots as (
    select
      'contract:' || contract.rider_id::text as slot_key
    from public.rider_contracts as contract
    join public.seasons as start_season
      on start_season.id = contract.start_season_id
    join public.seasons as end_season
      on end_season.id = contract.end_season_id
    where contract.team_id = p_team_id
      and contract.status in ('active', 'planned')
      and p_game_year between start_season.game_year and end_season.game_year
    group by contract.rider_id
  ),
  listing_leaders as (
    select distinct on (listing.id)
      listing.id as listing_id,
      listing.season_id,
      bid.team_id
    from public.transfer_market_listings as listing
    join public.transfer_market_bids as bid
      on bid.listing_id = listing.id
    where listing.status = 'open'
    order by
      listing.id,
      bid.amount desc,
      bid.created_at asc,
      bid.id asc
  ),
  transfer_slots as (
    select
      'transfer:' || leader.listing_id::text as slot_key
    from listing_leaders as leader
    join public.seasons as listing_season
      on listing_season.id = leader.season_id
    where leader.team_id = p_team_id
      and p_game_year between
        listing_season.game_year and listing_season.game_year + 1
  )
  select count(*)::integer
  from (
    select slot_key from contract_slots
    union all
    select slot_key from transfer_slots
  ) as commitments;
$$;

comment on function public.get_team_roster_commitment_count(uuid, integer) is
  'Compte les engagements fermes d’une équipe pour une saison : contrats et enchères menées. Les promotions juniors restent arbitrables jusqu’à J1.';

revoke all
on function public.get_team_roster_commitment_count(uuid, integer)
from public, anon, authenticated;

grant execute
on function public.get_team_roster_commitment_count(uuid, integer)
to service_role;

-- Youth scheduling no longer consumes a firm roster slot. Contract and auction
-- writes remain protected by their existing 35-rider capacity triggers.
drop trigger if exists enforce_youth_promotion_roster_capacity_before_write
on public.youth_academy_riders;

create or replace function public.enforce_team_roster_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start_game_year integer;
  v_end_game_year integer;
  v_game_year integer;
  v_commitment_count integer;
  v_replaced_commitment integer;
begin
  if new.status not in ('active', 'planned') then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('team-roster:' || new.team_id::text, 0)
  );

  select season.game_year
  into v_start_game_year
  from public.seasons as season
  where season.id = new.start_season_id;

  select season.game_year
  into v_end_game_year
  from public.seasons as season
  where season.id = new.end_season_id;

  if v_start_game_year is null or v_end_game_year is null then
    raise exception 'Les saisons du contrat coureur sont invalides.';
  end if;

  for v_game_year in v_start_game_year..v_end_game_year loop
    v_commitment_count := public.get_team_roster_commitment_count(
      new.team_id,
      v_game_year
    );
    v_replaced_commitment := 0;

    if new.acquisition_type in ('daily_auction', 'director_auction')
      and exists (
        select 1
        from public.transfer_market_listings as listing
        join public.seasons as listing_season
          on listing_season.id = listing.season_id
        join lateral (
          select bid.team_id
          from public.transfer_market_bids as bid
          where bid.listing_id = listing.id
          order by bid.amount desc, bid.created_at asc, bid.id asc
          limit 1
        ) as leader on leader.team_id = new.team_id
        where listing.rider_id = new.rider_id
          and listing.status = 'open'
          and v_game_year between
            listing_season.game_year and listing_season.game_year + 1
      ) then
      v_replaced_commitment := 1;
    end if;

    if v_commitment_count - v_replaced_commitment > 35 then
      raise exception
        'L’effectif professionnel est limité à 35 coureurs pour la saison %.',
        v_game_year
        using
          errcode = '23514',
          hint = 'Libérez une place avant de recruter un nouveau coureur.';
    end if;
  end loop;

  return new;
end;
$$;

comment on function public.enforce_team_roster_capacity() is
  'Empêche les engagements fermes de dépasser 35 coureurs, sans préempter les promotions juniors arbitrées à J1.';

create or replace function private.get_team_roster_projection(
  p_team_id uuid,
  p_game_year integer
)
returns table (
  firm_commitment_count integer,
  scheduled_youth_count integer,
  projected_count integer,
  overflow_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with projection as (
    select
      public.get_team_roster_commitment_count(
        p_team_id,
        p_game_year
      )::integer as firm_commitment_count,
      (
        select count(*)::integer
        from public.youth_academy_riders as academy
        where academy.team_id = p_team_id
          and academy.status = 'recruited'
          and academy.promotion_game_year <= p_game_year
      ) as scheduled_youth_count
  )
  select
    projection.firm_commitment_count,
    projection.scheduled_youth_count,
    projection.firm_commitment_count + projection.scheduled_youth_count,
    greatest(
      0,
      projection.firm_commitment_count
        + projection.scheduled_youth_count
        - 35
    )::integer
  from projection;
$$;

comment on function private.get_team_roster_projection(uuid, integer) is
  'Projette l’effectif à J1 en ajoutant les promotions juniors aux engagements fermes et calcule le dépassement de la limite de 35.';

revoke all
on function private.get_team_roster_projection(uuid, integer)
from public, anon, authenticated;

-- Keep the Bureau on its existing single compact RPC. The extra projection is
-- folded into its JSON payload and therefore adds no browser round trip.
do $dashboard_migration$
declare
  v_definition text;
  v_previous_payload constant text := $previous$
      'availableScoutCount', (
        select count(*)::integer
        from public.staff_contracts as contract
        join public.staff_members as member
          on member.id = contract.staff_member_id
        join current_context as context
          on context.team_id = contract.team_id
        where contract.status = 'active'
          and member.role = 'scout'
          and not exists (
            select 1
            from public.youth_scouting_missions as mission
            where mission.scout_contract_id = contract.id
              and mission.status = 'active'
          )
      )
    ) as items
$previous$;
  v_replacement_payload constant text := $replacement$
      'availableScoutCount', (
        select count(*)::integer
        from public.staff_contracts as contract
        join public.staff_members as member
          on member.id = contract.staff_member_id
        join current_context as context
          on context.team_id = contract.team_id
        where contract.status = 'active'
          and member.role = 'scout'
          and not exists (
            select 1
            from public.youth_scouting_missions as mission
            where mission.scout_contract_id = contract.id
              and mission.status = 'active'
          )
      ),
      'nextSeasonRosterProjection', (
        select jsonb_build_object(
          'projectedCount', projection.projected_count,
          'overflowCount', projection.overflow_count
        )
        from current_context as projection_context
        cross join lateral private.get_team_roster_projection(
          projection_context.team_id,
          projection_context.game_year + 1
        ) as projection
      )
    ) as items
$replacement$;
begin
  select pg_get_functiondef(
    'public.get_current_dashboard_assistant_summary()'::regprocedure
  ) into v_definition;
  v_definition := replace(v_definition, E'\r\n', E'\n');

  if strpos(v_definition, v_previous_payload) = 0 then
    raise exception
      'Le payload du résumé du Bureau est introuvable.';
  end if;

  execute replace(
    v_definition,
    v_previous_payload,
    v_replacement_payload
  );
end;
$dashboard_migration$;

comment on function public.get_current_dashboard_assistant_summary() is
  'Résumé opérationnel compact du Bureau. Il inclut la projection de l’effectif de la saison suivante sans requête cliente supplémentaire.';

-- At J1, firm professional commitments have priority. The remaining places are
-- awarded to the scheduled juniors with the highest projected overall rating;
-- every other due junior becomes a free agent.
do $rollover_migration$
declare
  v_definition text;
  v_start_marker constant text :=
    '  -- Youth transitions were previously lazy and happened only when a player';
  v_end_marker constant text :=
    '  -- Existing riders need the same J1 profile state that the insert trigger gives';
  v_new_block constant text := $block$  -- Youth transitions were previously lazy and happened only when a player
  -- opened the academy page. They are now global and deterministic at J1.
  -- Lock every due academy record before ranking the scheduled promotions.
  perform 1
  from public.youth_academy_riders as academy
  where (academy.status = 'recruited'
      and academy.promotion_game_year <= v_target.game_year)
    or (academy.status = 'active'
      and v_target.game_year - academy.birth_game_year > 18)
  order by academy.team_id, academy.id
  for update;

  for v_youth in
    with firm_contracts as materialized (
      select
        contract.team_id,
        count(distinct contract.rider_id)::integer as rider_count
      from public.rider_contracts as contract
      join public.seasons as start_season
        on start_season.id = contract.start_season_id
      join public.seasons as end_season
        on end_season.id = contract.end_season_id
      where contract.status in ('active', 'planned')
        and v_target.game_year between
          start_season.game_year and end_season.game_year
      group by contract.team_id
    ),
    rated_candidates as materialized (
      select
        academy.*,
        (
          round(34 + academy.mountain * 8)
          + round(34 + academy.hills * 8)
          + round(34 + academy.flat * 8)
          + round(34 + academy.time_trial * 8)
          + round(34 + academy.cobbles * 8)
          + round(34 + academy.sprint * 8)
          + round(34 + academy.acceleration * 8)
          + round(34 + academy.downhill * 8)
          + round(34 + academy.endurance * 8)
          + round(34 + academy.resistance * 8)
          + round(34 + academy.recovery * 8)
          + round(34 + academy.breakaway * 8)
          + round(34 + academy.prologue * 8)
        ) as projected_rating_total
      from public.youth_academy_riders as academy
      where (academy.status = 'recruited'
          and academy.promotion_game_year <= v_target.game_year)
        or (academy.status = 'active'
          and v_target.game_year - academy.birth_game_year > 18)
    ),
    ranked_candidates as materialized (
      select
        candidate.*,
        row_number() over (
          partition by candidate.team_id, candidate.status
          order by
            candidate.projected_rating_total desc,
            candidate.potential_steps desc,
            candidate.signed_at asc,
            candidate.id asc
        ) as promotion_rank
      from rated_candidates as candidate
    )
    select
      candidate.*,
      (
        candidate.status = 'recruited'
        and candidate.promotion_rank <= greatest(
          0,
          35 - coalesce(firm.rider_count, 0)
        )
      ) as promote_to_pro
    from ranked_candidates as candidate
    left join firm_contracts as firm
      on firm.team_id = candidate.team_id
    order by
      candidate.team_id,
      case when candidate.status = 'recruited' then 0 else 1 end,
      candidate.promotion_rank,
      candidate.id
  loop
    insert into public.riders (
      country_id, first_name, last_name, status, potential_steps
    )
    values (
      v_youth.country_id, v_youth.first_name, v_youth.last_name,
      case when v_youth.promote_to_pro then 'active' else 'free_agent' end,
      v_youth.potential_steps
    )
    returning id into v_new_rider_id;

    insert into public.rider_season_ratings (
      rider_id, season_id, age, mountain, hills, flat, time_trial, cobbles,
      sprint, acceleration, downhill, endurance, resistance, recovery,
      breakaway, prologue
    ) values (
      v_new_rider_id, v_target.id,
      (v_target.game_year - v_youth.birth_game_year)::smallint,
      least(100, greatest(0, round(34 + v_youth.mountain * 8)))::smallint,
      least(100, greatest(0, round(34 + v_youth.hills * 8)))::smallint,
      least(100, greatest(0, round(34 + v_youth.flat * 8)))::smallint,
      least(100, greatest(0, round(34 + v_youth.time_trial * 8)))::smallint,
      least(100, greatest(0, round(34 + v_youth.cobbles * 8)))::smallint,
      least(100, greatest(0, round(34 + v_youth.sprint * 8)))::smallint,
      least(100, greatest(0, round(34 + v_youth.acceleration * 8)))::smallint,
      least(100, greatest(0, round(34 + v_youth.downhill * 8)))::smallint,
      least(100, greatest(0, round(34 + v_youth.endurance * 8)))::smallint,
      least(100, greatest(0, round(34 + v_youth.resistance * 8)))::smallint,
      least(100, greatest(0, round(34 + v_youth.recovery * 8)))::smallint,
      least(100, greatest(0, round(34 + v_youth.breakaway * 8)))::smallint,
      least(100, greatest(0, round(34 + v_youth.prologue * 8)))::smallint
    );

    if v_youth.promote_to_pro then
      insert into public.rider_contracts (
        rider_id, team_id, start_season_id, end_season_id,
        salary_per_season, currency, currency_code, status,
        signed_at, acquisition_type
      )
      select v_new_rider_id, v_youth.team_id, v_target.id, v_target.id,
        0, team_season.currency, team_season.currency, 'active', now(), 'academy'
      from public.team_seasons as team_season
      where team_season.team_id = v_youth.team_id
        and team_season.season_id = v_target.id;

      update public.youth_academy_riders
      set status = 'promoted', promoted_rider_id = v_new_rider_id, updated_at = now()
      where id = v_youth.id;
      v_promoted_youth := v_promoted_youth + 1;
    else
      update public.youth_academy_riders
      set status = 'free_agent', promoted_rider_id = v_new_rider_id, updated_at = now()
      where id = v_youth.id;

      if v_youth.status = 'recruited' then
        insert into public.youth_development_notifications (
          team_id,
          notification_type,
          title,
          message,
          source_reference
        ) values (
          v_youth.team_id,
          'contract_expired',
          'Promotion annulée — effectif complet',
          v_youth.first_name || ' ' || v_youth.last_name
            || ' n’a pas pu intégrer l’équipe professionnelle, limitée à 35 coureurs, et rejoint les agents libres.',
          'youth-roster-overflow:' || v_youth.id::text
        )
        on conflict (team_id, source_reference) do nothing;
      end if;

      v_released_youth := v_released_youth + 1;
    end if;
  end loop;

$block$;
  v_block_start integer;
  v_block_end integer;
  v_block_length integer;
begin
  select pg_get_functiondef(
    'public.rollover_game_season(uuid,boolean)'::regprocedure
  ) into v_definition;
  v_definition := replace(v_definition, E'\r\n', E'\n');

  v_block_start := position(v_start_marker in v_definition);
  if v_block_start = 0 then
    raise exception 'Le début du traitement des juniors à J1 est introuvable.';
  end if;

  v_block_end := position(
    v_end_marker in substring(v_definition from v_block_start)
  );
  if v_block_end = 0 then
    raise exception 'La fin du traitement des juniors à J1 est introuvable.';
  end if;

  v_block_length := v_block_end - 1;
  execute overlay(
    v_definition
    placing v_new_block
    from v_block_start
    for v_block_length
  );
end;
$rollover_migration$;

comment on function public.rollover_game_season(uuid, boolean) is
  'Clôture atomiquement une saison et ouvre la suivante. À J1, les places restantes sont attribuées aux juniors programmés ayant les meilleures moyennes.';

notify pgrst, 'reload schema';

commit;
