begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

-- A reserved bid keeps the price and formula that were in force at filing.
alter table public.national_federation_hosting_candidacies
  add column economics_version smallint not null default 1 check (economics_version in (1, 2)),
  add column economics_manifest jsonb,
  add constraint hosting_candidacies_economics_manifest_shape check (
    (economics_version = 1 and economics_manifest is null)
    or (economics_version = 2 and target_game_year >= 6 and jsonb_typeof(economics_manifest) = 'object'
      and economics_manifest is not null)
  );

alter table public.national_federation_hosting_awards
  add column economics_manifest jsonb,
  add column economics_breakdown jsonb,
  add column revenue_window_ends_at timestamptz,
  add constraint hosting_awards_economics_manifest_shape check (
    (economics_version = 1 and economics_manifest is null and economics_breakdown is null
      and revenue_window_ends_at is null)
    or (economics_version = 2 and target_game_year >= 6 and jsonb_typeof(economics_manifest) = 'object'
      and economics_manifest is not null and ((status = 'scheduled' and economics_breakdown is null)
        or (status <> 'scheduled' and economics_breakdown is not null and jsonb_typeof(economics_breakdown) = 'object')))
  );

alter table public.national_federation_hosting_awards
  drop constraint national_federation_hosting_awards_values_valid,
  add constraint national_federation_hosting_awards_values_valid check (
    hosting_cost > 0 and projected_attendance > 0 and projected_gross_revenue > 0
    and (prestige_gain > 0 or (status = 'cancelled' and prestige_gain = 0))
    and (actual_participation_rate is null or actual_participation_rate between 0 and 1)
    and (actual_attendance is null or actual_attendance >= 0)
  ) not valid;

grant select (economics_version, economics_manifest) on public.national_federation_hosting_candidacies to authenticated;

create table private.federation_hosting_draw_tickets (
  award_id uuid primary key references public.national_federation_hosting_awards(id) on delete cascade,
  ticket integer not null default floor(random() * 10000)::integer check (ticket between 0 and 9999)
);
alter table private.federation_hosting_draw_tickets enable row level security;
revoke all on private.federation_hosting_draw_tickets from public, anon, authenticated, service_role;

create function public.get_federation_hosting_economics_catalog(p_continent_code text)
returns table (event_type text, economics_manifest jsonb)
language sql stable security definer set search_path = '' as $$
  with eligible as (
    select count(*)::integer as country_count
    from public.countries as country
    where country.is_active and country.continent_code = p_continent_code
  )
  select catalog.event_type, jsonb_build_object(
    'catalogCost', catalog.catalog_cost, 'prestigeGain', catalog.prestige_gain,
    'countryTarget', case when catalog.is_continental
      then greatest(1, least(catalog.country_target, eligible.country_count)) else catalog.country_target end,
    'readerTarget', catalog.reader_target, 'seatTarget', catalog.seat_target,
    'baseRate', 0.85, 'countryCapRate', 0.50, 'readerCapRate', 0.10, 'seatCapRate', 0.05,
    'drawEligibleCountryRate', 0.60, 'drawSmallRate', 0.15, 'drawSmallProbability', 0.30,
    'drawLargeRate', 0.35, 'drawLargeProbability', 0.10
  )
  from (values
    ('world_championship_pro',        false, 2800000, 45, 100, 400, 60),
    ('continental_championship_pro',  true, 1440000, 25,  70, 320, 35),
    ('nations_cup_pro',                false, 1920000, 40,  80, 320, 45),
    ('quadrennial_games_pro',          false, 1920000, 48, 120, 400, 45),
    ('world_championship_junior',     false,  960000, 35,  60, 240, 25),
    ('continental_championship_junior', true,  560000, 15,  40, 160, 15)
  ) as catalog(event_type, is_continental, catalog_cost, country_target, reader_target, seat_target, prestige_gain)
  cross join eligible;
$$;
revoke all on function public.get_federation_hosting_economics_catalog(text) from public, anon, authenticated;
grant execute on function public.get_federation_hosting_economics_catalog(text) to service_role;

-- Use the same signed catalog as the player-facing quote. Idempotent retries
-- return the existing bid, including any legacy reservation made before release.
do $quote$
declare
  v_definition text := replace(pg_get_functiondef(
    'public.submit_national_federation_hosting_candidacy(text,text)'::regprocedure
  ), chr(13), '');
  v_patch record;
begin
  for v_patch in select * from (values
    ($old$  v_hosting_cost numeric;$old$,$new$  v_hosting_cost numeric;
  v_economics_version smallint := 1;
  v_economics_manifest jsonb;$new$),
    ($old$  select effects.hosting_cost_reduction_percentage into v_hosting_cost_reduction$old$,$new$  if v_context.game_year + 1 >= 6 then
    select catalog.economics_manifest into strict v_economics_manifest
    from public.get_federation_hosting_economics_catalog(v_context.continent_code) as catalog
    where catalog.event_type = p_event_type;
    v_economics_version := 2;
    v_hosting_cost := (v_economics_manifest->>'catalogCost')::numeric;
  end if;

  select effects.hosting_cost_reduction_percentage into v_hosting_cost_reduction$new$),
    ($old$    uci_rank, renown_score, submitted_by_director_id$old$,$new$    uci_rank, renown_score, submitted_by_director_id, economics_version, economics_manifest$new$),
    ($old$    v_rank, v_renown.score, v_context.director_id$old$,$new$    v_rank, v_renown.score, v_context.director_id, v_economics_version, v_economics_manifest$new$),
    ($old$    submitted_by_director_id = excluded.submitted_by_director_id,$old$,$new$    submitted_by_director_id = excluded.submitted_by_director_id,
    economics_version = excluded.economics_version, economics_manifest = excluded.economics_manifest,$new$)
  ) as patches(previous, replacement) loop
    v_patch.previous := replace(v_patch.previous, chr(13), '');
    v_patch.replacement := replace(v_patch.replacement, chr(13), '');
    if length(v_definition) - length(replace(v_definition, v_patch.previous, '')) <> length(v_patch.previous) then
      raise exception 'Unexpected federation hosting quote definition.';
    end if;
    v_definition := replace(v_definition, v_patch.previous, v_patch.replacement);
  end loop;
  execute v_definition;
end;
$quote$;

create function private.freeze_federation_hosting_award_economics()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select candidacy.economics_version, candidacy.economics_manifest into strict new.economics_version, new.economics_manifest
  from public.national_federation_hosting_candidacies as candidacy where candidacy.id = new.candidacy_id;
  if new.economics_version = 2 then
    -- Reference scenario. Half of the objective is met and no audience bonus is assumed.
    new.projected_gross_revenue := round((new.economics_manifest->>'catalogCost')::numeric
      * ((new.economics_manifest->>'baseRate')::numeric + (new.economics_manifest->>'countryCapRate')::numeric * 0.5), 2);
    new.projected_net_return := new.projected_gross_revenue - new.hosting_cost;
  end if;
  return new;
end;
$$;
revoke all on function private.freeze_federation_hosting_award_economics() from public, anon, authenticated, service_role;
create trigger freeze_federation_hosting_award_economics before insert on public.national_federation_hosting_awards
for each row execute function private.freeze_federation_hosting_award_economics();

create function private.freeze_federation_hosting_award_draw()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into private.federation_hosting_draw_tickets (award_id) values (new.id);
  return new;
end;
$$;
revoke all on function private.freeze_federation_hosting_award_draw() from public, anon, authenticated, service_role;
create trigger freeze_federation_hosting_award_draw after insert on public.national_federation_hosting_awards
for each row when (new.economics_version = 2) execute function private.freeze_federation_hosting_award_draw();

create function private.get_federation_hosting_country_totals(
  p_season_id uuid, p_event_type text, p_continent_code text
)
returns table (registered_country_count integer, starter_country_count integer)
language sql stable set search_path = '' as $$
  with completed as materialized (
    select edition_id, is_junior
    from private.get_federation_hosting_editions(p_season_id, p_event_type, p_continent_code)
    where edition_status = 'completed'
  ), pro_delegations as materialized (
    select selection.country_id, link.race_edition_id, registration.id as registration_id,
      registration.status as registration_status
    from completed as edition
    join public.national_federation_selection_race_links as link on link.race_edition_id = edition.edition_id
    join public.national_federation_selection_lists as selection on selection.id = link.selection_list_id
    join public.race_registrations as registration on registration.id = link.race_registration_id
    where not edition.is_junior
  ), starters as materialized (
    select distinct delegation.country_id
    from pro_delegations as delegation
    join public.stages as stage on stage.race_edition_id = delegation.race_edition_id and stage.status = 'completed'
    join public.stage_results as result on result.stage_id = stage.id and result.status <> 'did_not_start'
    join public.race_rosters as roster on roster.id = result.race_roster_id
      and roster.race_registration_id = delegation.registration_id
    union
    select country.id
    from completed as edition
    join public.development_race_results as result on result.race_edition_id = edition.edition_id
      and result.result_scope = 'stage' and result.academy_rider_id is not null
    join public.countries as country on country.iso_alpha2 = result.country_code
    where edition.is_junior
  ), registered as (
    select country_id from starters
    union
    select country_id from pro_delegations where registration_status = 'accepted'
    union
    select registration.country_id
    from completed as edition
    join public.national_federation_junior_race_registrations as registration
      on registration.race_edition_id = edition.edition_id and registration.status in ('registered', 'completed')
    where edition.is_junior
  )
  select (select count(*)::integer from registered), (select count(*)::integer from starters);
$$;
revoke all on function private.get_federation_hosting_country_totals(uuid,text,text)
  from public, anon, authenticated, service_role;

create function private.calculate_federation_hosting_revenue(
  p_manifest jsonb, p_completion_rate numeric, p_registered_countries integer, p_starter_countries integer,
  p_readers integer, p_cars integer, p_seats integer, p_draw_ticket integer
)
returns jsonb language plpgsql immutable strict set search_path = '' as $$
declare
  v_prorated_cost numeric := (p_manifest->>'catalogCost')::numeric * p_completion_rate;
  v_country_progress numeric := least(1, p_starter_countries::numeric / (p_manifest->>'countryTarget')::numeric);
  v_reader_progress numeric := least(1, p_readers::numeric / (p_manifest->>'readerTarget')::numeric);
  v_seat_progress numeric := least(1, p_seats::numeric / (p_manifest->>'seatTarget')::numeric);
  v_country_rate numeric := v_country_progress * (p_manifest->>'countryCapRate')::numeric;
  v_reader_rate numeric := v_reader_progress * (p_manifest->>'readerCapRate')::numeric;
  v_seat_rate numeric := v_seat_progress * (p_manifest->>'seatCapRate')::numeric;
  v_draw_eligible boolean := p_completion_rate > 0 and v_country_progress >= (p_manifest->>'drawEligibleCountryRate')::numeric;
  v_draw_rate numeric := 0;
  v_base numeric := round(v_prorated_cost * (p_manifest->>'baseRate')::numeric, 2);
  v_countries numeric := round(v_prorated_cost * v_country_rate, 2);
  v_readers numeric := round(v_prorated_cost * v_reader_rate, 2);
  v_seats numeric := round(v_prorated_cost * v_seat_rate, 2);
  v_draw numeric;
begin
  if v_draw_eligible then
    if p_draw_ticket < 10000 * (p_manifest->>'drawLargeProbability')::numeric then
      v_draw_rate := (p_manifest->>'drawLargeRate')::numeric;
    elsif p_draw_ticket < 10000 * ((p_manifest->>'drawLargeProbability')::numeric + (p_manifest->>'drawSmallProbability')::numeric) then
      v_draw_rate := (p_manifest->>'drawSmallRate')::numeric;
    end if;
  end if;
  v_draw := round(v_prorated_cost * v_draw_rate, 2);
  return jsonb_build_object(
    'completionRate', p_completion_rate,
    'registeredCountryCount', p_registered_countries, 'countryCount', p_starter_countries,
    'readerCount', p_readers, 'carCount', p_cars, 'seatCount', p_seats,
    'countryProgress', v_country_progress, 'readerProgress', v_reader_progress, 'seatProgress', v_seat_progress,
    'countryRate', v_country_rate, 'readerRate', v_reader_rate, 'seatRate', v_seat_rate,
    'drawEligible', v_draw_eligible, 'drawRate', v_draw_rate,
    'baseAmount', v_base, 'countryAmount', v_countries, 'readerAmount', v_readers, 'seatAmount', v_seats, 'drawAmount', v_draw,
    'grossRevenue', v_base + v_countries + v_readers + v_seats + v_draw,
    'actualPrestigeGain', round((p_manifest->>'prestigeGain')::numeric * p_completion_rate)::integer
  );
end;
$$;
revoke all on function private.calculate_federation_hosting_revenue(jsonb,numeric,integer,integer,integer,integer,integer,integer)
  from public, anon, authenticated, service_role;

-- Preserve legacy competitions and the existing once-only cash ledger. New
-- economics changes only how the amount is computed and when it becomes due.
do $settle$
declare
  v_definition text := replace(pg_get_functiondef(
    'public.settle_due_national_federation_hosting_returns()'::regprocedure
  ), chr(13), '');
  v_patch record;
begin
  for v_patch in select * from (values
    ($old$  v_credit numeric;$old$,$new$  v_credit numeric;
  v_deadline timestamptz;
  v_registered_countries integer;
  v_starter_countries integer;
  v_readers integer;
  v_cars integer;
  v_seats integer;
  v_ticket integer;
  v_breakdown jsonb;$new$),
    ($old$    order by award.selected_at, award.id$old$,$new$      and (award.revenue_window_ends_at is null or award.revenue_window_ends_at <= clock_timestamp())
    order by award.selected_at, award.id$new$),
    ($old$    v_participation := 0;$old$,$new$    v_deadline := v_award.revenue_window_ends_at;
    v_breakdown := null;
    if v_award.economics_version = 2 and v_completed > 0 then
      if v_deadline is null then
        v_deadline := private.get_federation_hosting_revenue_window(v_award.id);
        if v_deadline is null then continue; end if;
        update public.national_federation_hosting_awards
        set revenue_window_ends_at = v_deadline where id = v_award.id;
      end if;
      if clock_timestamp() < v_deadline then continue; end if;
    end if;

    v_participation := 0;$new$),
    ($old$      if coalesce(v_places, 0) <= 0 or coalesce(v_starters, 0) <= 0 then continue; end if;
      v_participation := least(1, v_starters::numeric / v_places);
      v_attendance := round$old$,$new$      if coalesce(v_places, 0) > 0 and coalesce(v_starters, 0) > 0 then
        v_participation := least(1, v_starters::numeric / v_places);
      elsif v_award.economics_version = 1 then
        continue;
      end if;
    end if;

    if v_award.economics_version = 2 then
      v_registered_countries := 0;
      v_starter_countries := 0;
      v_readers := 0;
      v_cars := 0;
      v_seats := 0;
      if v_completed > 0 then
        select registered_country_count, starter_country_count into v_registered_countries, v_starter_countries
        from private.get_federation_hosting_country_totals(v_award.event_season_id, v_award.event_type, v_award.continent_code);
        v_readers := private.get_federation_hosting_unique_readers(v_award.id);
        select car_count, seat_count into v_cars, v_seats from private.get_federation_hosting_charter_totals(v_award.id);
      end if;
      select draw.ticket into strict v_ticket from private.federation_hosting_draw_tickets as draw where draw.award_id = v_award.id;
      v_breakdown := private.calculate_federation_hosting_revenue(v_award.economics_manifest, v_completed_fraction,
        v_registered_countries, v_starter_countries, v_readers, v_cars, v_seats, v_ticket);
      v_gross := (v_breakdown->>'grossRevenue')::numeric;
      v_prestige := (v_breakdown->>'actualPrestigeGain')::integer;
      v_attendance := null;
    elsif v_completed > 0 then
      v_attendance := round$new$),
    ($old$          'completedEditions', v_completed, 'scheduledEditions', v_total, 'prestigeGain', v_prestige)$old$,$new$          'completedEditions', v_completed, 'scheduledEditions', v_total, 'prestigeGain', v_prestige)
          || case when v_breakdown is null then '{}'::jsonb else jsonb_build_object(
            'hostingEconomicsVersion', v_award.economics_version, 'hostingEconomics', v_breakdown) end$new$),
    ($old$        scheduled_edition_count = v_total, completed_edition_count = v_completed,$old$,$new$        scheduled_edition_count = v_total, completed_edition_count = v_completed,
        economics_breakdown = v_breakdown,
        prestige_gain = case when v_award.economics_version = 2 then v_prestige else prestige_gain end,$new$)
  ) as patches(previous, replacement) loop
    v_patch.previous := replace(v_patch.previous, chr(13), '');
    v_patch.replacement := replace(v_patch.replacement, chr(13), '');
    if length(v_definition) - length(replace(v_definition, v_patch.previous, '')) <> length(v_patch.previous) then
      raise exception 'Unexpected federation hosting returns definition.';
    end if;
    v_definition := replace(v_definition, v_patch.previous, v_patch.replacement);
  end loop;
  execute v_definition;
end;
$settle$;

notify pgrst, 'reload schema';
commit;
