begin;

-- Keep the personality entries separate from the age-of-tenure calculation.
-- That calculation sums rows carrying metadata.teamId.
create function private.apply_fidele_contract_morale()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_renewal boolean := false;
  v_transfer boolean := false;
  v_day record;
  v_former_club_id uuid;
begin
  if tg_op = 'INSERT' then
    v_renewal := new.status = 'planned' and new.acquisition_type = 'renewal';
    v_transfer := new.status = 'active' and new.acquisition_type in ('director_auction', 'direct_offer');
  else
    v_renewal := (
      new.status = 'planned' and new.acquisition_type = 'renewal'
      and old.status = 'cancelled'
    ) or (
      new.status in ('planned', 'active') and old.status = new.status
      and new.team_id = old.team_id
      and new.end_season_id <> old.end_season_id
      and (new.status = 'active' or new.acquisition_type = 'renewal')
      and exists (
        select 1 from public.seasons as previous_end, public.seasons as proposed_end
        where previous_end.id = old.end_season_id
          and proposed_end.id = new.end_season_id
          and proposed_end.game_year > previous_end.game_year
      )
    );
    v_transfer := new.status = 'active' and old.status <> 'active'
      and new.acquisition_type in ('director_auction', 'direct_offer');
  end if;

  if not (v_renewal or v_transfer) or not exists (
    select 1 from public.riders
    where id = new.rider_id and personality_key = 'fidele'
  ) then return new; end if;

  select season.id as season_id, season.game_year, day.id, day.day_number
  into v_day
  from public.seasons as season
  join public.season_days as day on day.season_id = season.id
    and day.day_number = coalesce(season.current_day_number, 1)
  where (v_renewal and season.status = 'active')
     or (v_transfer and season.id = new.start_season_id)
  limit 1;
  if not found then return new; end if;

  if v_renewal then
    if new.signed_at is not null and exists (
      select 1 from public.rider_contracts as contract
      where contract.rider_id = new.rider_id and contract.team_id = new.team_id
        and contract.status = 'active'
    ) then
      perform public.apply_rider_morale_event(
        new.rider_id, v_day.id, 'team_tenure',
        'personality:fidele:renewal:' || v_day.season_id::text,
        1, 'Caractère Fidèle · Contrat prolongé avec son club',
        jsonb_build_object('personalityKey', 'fidele', 'clubId', new.team_id, 'contractId', new.id)
      );
    end if;
    return new;
  end if;

  -- An active successor identifies a completed club-to-club move. The ending
  -- recorded on the previous contract distinguishes it from a free agent
  -- returning much later. A deferred move takes effect at rollover.
  select previous.team_id into v_former_club_id
  from public.rider_contracts as previous
  join public.seasons as scheduled_end on scheduled_end.id = previous.end_season_id
  left join public.seasons as actual_end on actual_end.id = previous.left_season_id
  where previous.rider_id = new.rider_id and previous.id <> new.id
    and previous.status in ('completed', 'terminated')
    and (
      (coalesce(actual_end.game_year, scheduled_end.game_year) = v_day.game_year
        and coalesce(previous.left_day_number, 28) = v_day.day_number)
      or (v_day.day_number = 1
        and coalesce(actual_end.game_year, scheduled_end.game_year) = v_day.game_year - 1
        and coalesce(previous.left_day_number, 28) = 28)
    )
  order by coalesce(actual_end.game_year, scheduled_end.game_year) desc,
    coalesce(previous.left_day_number, 28) desc, previous.signed_at desc nulls last, previous.id
  limit 1;

  if v_former_club_id is null or v_former_club_id = new.team_id then return new; end if;

  -- Require two completed seasons at that club and rule out a separate stint
  -- at another club in the same period.
  if exists (
    select 1 from generate_series(v_day.game_year - 2, v_day.game_year - 1) as tenure(year)
    where not exists (
      select 1 from public.rider_contracts as history
      join public.seasons as started on started.id = history.start_season_id
      join public.seasons as scheduled_end on scheduled_end.id = history.end_season_id
      left join public.seasons as actual_end on actual_end.id = history.left_season_id
      where history.rider_id = new.rider_id and history.team_id = v_former_club_id
        and history.status in ('completed', 'terminated')
        and started.game_year <= tenure.year
        and (coalesce(actual_end.game_year, scheduled_end.game_year), coalesce(history.left_day_number, 28))
          >= (tenure.year, 28)
    )
  ) or exists (
    select 1 from public.rider_contracts as other_club
    join public.seasons as started on started.id = other_club.start_season_id
    where other_club.rider_id = new.rider_id and other_club.id <> new.id
      and other_club.team_id <> v_former_club_id
      and other_club.status in ('completed', 'terminated')
      and started.game_year between v_day.game_year - 2 and v_day.game_year
  ) then return new; end if;

  perform public.apply_rider_morale_event(
    new.rider_id, v_day.id, 'team_tenure',
    'personality:fidele:transfer:' || new.id::text,
    -1, 'Caractère Fidèle · Départ après deux saisons complètes au club',
    jsonb_build_object('personalityKey', 'fidele', 'formerClubId', v_former_club_id, 'clubId', new.team_id, 'contractId', new.id)
  );
  return new;
end;
$$;

revoke all on function private.apply_fidele_contract_morale() from public, anon, authenticated, service_role;

create trigger rider_contracts_fidele_morale
after insert or update of status, end_season_id on public.rider_contracts
for each row execute function private.apply_fidele_contract_morale();

create function public.settle_stage_personality_team_morale(p_stage_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage record;
  v_effect record;
  v_applied integer := 0;
begin
  select stage.season_day_id, stage.race_edition_id, stage.stage_type,
    edition.season_id, race.country_id, day.calendar_date,
    coalesce(stage.departure_at, day.calendar_date::timestamp at time zone 'Europe/Paris') as starts_at,
    recorded.simulation_data -> 'resolvedRiders' as riders,
    recorded.simulation_data -> 'teamWork' as team_work
  into v_stage
  from public.stages as stage
  join public.race_editions as edition on edition.id = stage.race_edition_id
  join public.races as race on race.id = edition.race_id
  join public.season_days as day on day.id = stage.season_day_id
  join public.official_stage_simulations as recorded on recorded.stage_id = stage.id
  where stage.id = p_stage_id and stage.status <> 'cancelled'
    and coalesce(stage.departure_at, day.calendar_date::timestamp at time zone 'Europe/Paris') <= now();
  if not found or jsonb_typeof(v_stage.riders) is distinct from 'array' then return 0; end if;

  for v_effect in
    with starters as materialized (
      select roster.rider_id, roster.race_registration_id, result.rank, result.status,
        snapshot.value ->> 'personalityKey' as personality,
        (snapshot.value ->> 'age')::integer as age,
        coalesce((snapshot.value ->> 'reconnaissanceBonus')::numeric, 0) as recon_bonus
      from jsonb_array_elements(v_stage.riders) as snapshot(value)
      join public.stage_results as result on result.stage_id = p_stage_id
      join public.race_rosters as roster on roster.id = result.race_roster_id
        and roster.rider_id::text = snapshot.value ->> 'id'
      where result.status in ('finished', 'did_not_finish', 'outside_time_limit')
    ), actual_work as materialized (
      select period.value ->> 'riderId' as rider, period.value ->> 'kind' as kind,
        coalesce(period.value -> 'targetRiderIds', '[]'::jsonb) as targets
      from jsonb_array_elements(
        case when jsonb_typeof(v_stage.team_work) = 'array' then v_stage.team_work else '[]'::jsonb end
      ) as period(value)
      where (period.value ->> 'endKm')::numeric > (period.value ->> 'startKm')::numeric
    )
    select rider.rider_id, rider.personality, null::uuid as teammate_id
    from starters as rider
    where (rider.personality = 'meticuleux' and rider.recon_bonus > 0)
      or (rider.personality = 'globe_trotteur' and not exists (
        select 1
        from public.race_rosters as previous_roster
        join public.stage_results as previous_result on previous_result.race_roster_id = previous_roster.id
        join public.stages as previous_stage on previous_stage.id = previous_result.stage_id
        join public.season_days as previous_day on previous_day.id = previous_stage.season_day_id
        join public.race_editions as previous_edition on previous_edition.id = previous_stage.race_edition_id
        join public.races as previous_race on previous_race.id = previous_edition.race_id
        where previous_roster.rider_id = rider.rider_id
          and previous_result.status in ('finished', 'did_not_finish', 'outside_time_limit')
          and previous_race.country_id = v_stage.country_id
          and (previous_day.calendar_date,
            coalesce(previous_stage.departure_at, previous_day.calendar_date::timestamp at time zone 'Europe/Paris'),
            previous_stage.id) < (v_stage.calendar_date, v_stage.starts_at, p_stage_id)
      ))
    union all
    select rider.rider_id, rider.personality, beneficiary.rider_id
    from starters as rider
    cross join lateral (
      select teammate.rider_id
      from starters as teammate
      where teammate.rider_id <> rider.rider_id
        and teammate.race_registration_id = rider.race_registration_id
        and teammate.status = 'finished'
        and (
          (rider.personality = 'collectif' and teammate.rank = 1 and exists (
            select 1 from actual_work as work
            where work.rider = rider.rider_id::text
              and (work.kind in ('peloton', 'leadout')
                or (work.kind in ('protection', 'recovery') and work.targets ? teammate.rider_id::text))
          ))
          or (rider.personality = 'mentor' and teammate.age <= 22 and teammate.rank <= 10
            and exists (
              select 1 from actual_work as work
              where work.rider = rider.rider_id::text and work.kind in ('protection', 'recovery')
                and work.targets ? teammate.rider_id::text
            )
            and not exists (
              select 1
              from public.race_rosters as previous_roster
              join public.stage_results as previous_result on previous_result.race_roster_id = previous_roster.id
              join public.stages as previous_stage on previous_stage.id = previous_result.stage_id
              join public.season_days as previous_day on previous_day.id = previous_stage.season_day_id
              where previous_roster.rider_id = teammate.rider_id
                and previous_result.status = 'finished' and previous_result.rank <= 10
                and previous_stage.stage_type <> 'team_time_trial'
                and (previous_day.calendar_date,
                  coalesce(previous_stage.departure_at, previous_day.calendar_date::timestamp at time zone 'Europe/Paris'),
                  previous_stage.id) < (v_stage.calendar_date, v_stage.starts_at, p_stage_id)
            )
          )
        )
      order by teammate.rank, teammate.rider_id
      limit 1
    ) as beneficiary
    where v_stage.stage_type = 'road' and rider.personality in ('mentor', 'collectif')
    order by rider_id
  loop
    if v_effect.personality = 'globe_trotteur' then
      -- The morale ledger uses the same lock for this rider. Checking the
      -- seasonal cap under it keeps simultaneous race jobs from exceeding 3.
      perform pg_advisory_xact_lock(hashtextextended(v_effect.rider_id::text, 0));
      if (
        select count(*) from public.rider_morale_events as event
        join public.season_days as day on day.id = event.season_day_id
        where event.rider_id = v_effect.rider_id and day.season_id = v_stage.season_id
          and event.source_type = 'stage_result'
          and event.source_reference like 'personality:globe_trotteur:%'
      ) >= 3 then continue; end if;
    end if;

    if not coalesce((public.apply_rider_morale_event(
      v_effect.rider_id, v_stage.season_day_id, 'stage_result',
      'personality:' || v_effect.personality || ':' || case when v_effect.personality = 'globe_trotteur'
        then v_stage.country_id::text else v_stage.race_edition_id::text end,
      1, case v_effect.personality
        when 'mentor' then 'Caractère Mentor · Premier top 10 du jeune équipier qu’il a aidé'
        when 'collectif' then 'Caractère Collectif · A contribué à la victoire d’un équipier'
        when 'globe_trotteur' then 'Caractère Globe-trotteur · Premier départ dans ce pays'
        when 'meticuleux' then 'Caractère Méticuleux · A pris le départ après une reconnaissance'
      end,
      jsonb_strip_nulls(jsonb_build_object(
        'personalityKey', v_effect.personality, 'raceEditionId', v_stage.race_edition_id,
        'stageId', p_stage_id, 'countryId', v_stage.country_id, 'teammateRiderId', v_effect.teammate_id
      ))
    ) ->> 'alreadyApplied')::boolean, false) then
      v_applied := v_applied + 1;
    end if;
  end loop;
  return v_applied;
end;
$$;

revoke all on function public.settle_stage_personality_team_morale(uuid) from public, anon, authenticated;
grant execute on function public.settle_stage_personality_team_morale(uuid) to service_role;

notify pgrst, 'reload schema';
commit;
