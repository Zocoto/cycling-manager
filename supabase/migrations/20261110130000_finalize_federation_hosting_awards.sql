begin;
set local statement_timeout = '5s';
set local lock_timeout = '500ms';

alter table public.national_federation_hosting_awards
  add column actual_refund numeric(14, 2),
  add column actual_starter_count integer,
  add column actual_place_count integer,
  add column completed_edition_count integer,
  add column scheduled_edition_count integer,
  add constraint national_federation_hosting_awards_settlement_counts check (
    (actual_refund is null or actual_refund between 0 and hosting_cost)
    and (actual_starter_count is null or actual_starter_count >= 0)
    and (actual_place_count is null or actual_place_count >= 0)
    and (scheduled_edition_count is null or scheduled_edition_count > 0)
    and (completed_edition_count is null
      or completed_edition_count between 0 and scheduled_edition_count)
  );

-- Keep the scope of the award identical when binding the host and when settling.
create or replace function private.get_federation_hosting_editions(
  p_season_id uuid, p_event_type text, p_continent_code text
)
returns table (edition_id uuid, is_junior boolean, edition_status text)
language sql
stable
set search_path = ''
as $$
  select edition.id, false, edition.status
  from public.race_editions edition
  join public.races race on race.id = edition.race_id
  where edition.season_id = p_season_id
    and (
      (p_event_type = 'world_championship_pro' and race.competition_type = 'world_championship')
      or (p_event_type = 'continental_championship_pro'
        and race.competition_type = 'continental_championship'
        and race.championship_continent_code = p_continent_code)
    )
  union all
  select edition.id, false, edition.status
  from public.national_federation_nations_cup_heats heat
  join public.race_editions edition on edition.id = heat.race_edition_id
    and edition.season_id = heat.season_id
  where p_event_type = 'nations_cup_pro' and heat.season_id = p_season_id
  union all
  select edition.id, false, edition.status
  from public.national_federation_olympic_events event
  join public.race_editions edition on edition.season_id = event.season_id
    and edition.id in (event.race_edition_id, event.time_trial_race_edition_id)
  where p_event_type = 'quadrennial_games_pro' and event.season_id = p_season_id
  union all
  select edition.id, true, edition.status
  from public.development_race_editions edition
  where edition.season_id = p_season_id
    and (
      (p_event_type = 'world_championship_junior'
        and edition.competition_type in ('world_road', 'world_time_trial'))
      or (p_event_type = 'continental_championship_junior'
        and edition.competition_type in ('continental_road', 'continental_time_trial')
        and edition.championship_continent_code = p_continent_code)
    );
$$;

revoke all on function private.get_federation_hosting_editions(uuid, text, text)
  from public, anon, authenticated;

-- The existing NC/JQ host trigger also sees other editions with the same
-- generic competition type. Bind only the official programme for this award.
create or replace function public.apply_professional_nations_cup_host()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.event_type in ('nations_cup_pro', 'quadrennial_games_pro') and new.status = 'scheduled' then
    update public.race_editions e
    set host_country_id = new.country_id
    from public.seasons season,
      lateral private.get_federation_hosting_editions(season.id, new.event_type, null) edition
    where season.game_year = new.target_game_year and e.id = edition.edition_id
      and e.status in ('planned', 'registration_open', 'registration_closed')
      and e.host_country_id is distinct from new.country_id;
  end if;
  return new;
end;
$$;

revoke all on function public.apply_professional_nations_cup_host() from public, anon, authenticated;
drop trigger if exists apply_professional_nations_cup_host_trigger on public.national_federation_hosting_awards;
create trigger apply_professional_nations_cup_host_trigger
after insert or update of country_id, status on public.national_federation_hosting_awards
for each row execute function public.apply_professional_nations_cup_host();

create or replace function public.settle_due_national_federation_hosting_candidacies()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '30s'
set lock_timeout = '1500ms'
as $$
declare
  v_season public.seasons%rowtype;
  v_group record;
  v_winner record;
  v_target_season_id uuid;
  v_expected_editions integer;
  v_actual_editions integer;
  v_editions_ready boolean;
  v_junior_calendar_ready boolean := false;
  v_projected_attendance integer;
  v_projected_revenue numeric;
  v_award_id uuid;
  v_selected integer := 0;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('federation-hosting-attribution', 0)) then
    return 0;
  end if;
  select season.* into v_season
  from public.seasons season
  where season.status = 'active' and exists (
      select 1 from public.national_federation_hosting_candidacies candidacy
      where candidacy.status = 'pending'
        and ((season.current_day_number >= 21 and candidacy.submitted_season_id = season.id
          and candidacy.target_game_year = season.game_year + 1)
          or (season.game_year >= 6 and candidacy.target_game_year = season.game_year
            and candidacy.submitted_season_id <> season.id))
    )
  limit 1 for share of season;
  if v_season.id is null then return 0; end if;

  -- An incomplete planned calendar can defer a decision. Once the new
  -- season is active, keep its default host and release the expired bid.
  if v_season.game_year >= 6 then
    with expired as (
      update public.national_federation_hosting_candidacies c
      set status = 'not_selected', decided_at = now(), updated_at = now()
      from public.seasons submitted
      where c.submitted_season_id = submitted.id and submitted.status = 'completed'
        and submitted.game_year = v_season.game_year - 1
        and c.target_game_year = v_season.game_year and c.status = 'pending'
      returning c.id, c.country_id, c.event_type
    )
    insert into public.national_federation_journal_entries (
      country_id, season_id, day_number, category, title, detail, source_reference
    )
    select expired.country_id, v_season.id, v_season.current_day_number, 'governance',
      'Candidature close sans attribution',
      case expired.event_type
        when 'world_championship_pro' then 'Championnats du monde professionnels'
        when 'continental_championship_pro' then 'Championnats continentaux professionnels'
        when 'nations_cup_pro' then 'Nations Cup professionnelle'
        when 'quadrennial_games_pro' then 'Jeux quadriennaux professionnels'
        when 'world_championship_junior' then 'Championnats du monde juniors'
        when 'continental_championship_junior' then 'Championnats continentaux juniors'
        else 'Accueil international' end
      || ' · La garantie a été libérée à l’ouverture de la saison.',
      'federation-hosting-candidacy:' || expired.id::text || ':expired'
    from expired
    on conflict (source_reference) do nothing;
  end if;
  if v_season.current_day_number < 21 then return 0; end if;

  for v_group in
    select distinct c.event_key, c.event_type, c.continent_code
    from public.national_federation_hosting_candidacies c
    where c.submitted_season_id = v_season.id
      and c.target_game_year = v_season.game_year + 1
      and c.status = 'pending'
      and not exists (
        select 1 from public.national_federation_hosting_awards a
        where a.target_game_year = c.target_game_year and a.event_key = c.event_key
      )
    order by c.event_key
  loop
    if v_target_season_id is null then
      v_target_season_id := public.ensure_transfer_next_season(v_season.id);
      if not exists (select 1 from public.seasons where id = v_target_season_id and status = 'planned') then
        return 0;
      end if;
    end if;
    if v_group.event_type in ('world_championship_junior', 'continental_championship_junior')
       and not v_junior_calendar_ready then
      perform public.ensure_development_race_calendar(v_target_season_id);
      v_junior_calendar_ready := true;
    end if;

    -- NC/JQ editions are generated by their own maintenance task. Do not
    -- generate them here or seed next season's sporting groups from a draft.
    v_expected_editions := 2;
    if v_group.event_type = 'nations_cup_pro' then
      select count(*) * (
        select count(*)
        from public.national_federation_selection_slots slot
        where slot.competition_code = 'nations_cup' and slot.rider_category = 'professional'
          and slot.active_from_game_year <= v_season.game_year + 1
      ) into v_expected_editions
      from (
        select distinct assignment.division, assignment.group_code
        from public.national_federation_nations_cup_assignments assignment
        where assignment.season_id = v_target_season_id
      ) pools;
    end if;
    select count(*),
      bool_and(
        edition.edition_status in ('planned', 'registration_open', 'registration_closed')
        and case when edition.is_junior then exists (
          select 1 from public.development_race_stages stage
          where stage.race_edition_id = edition.edition_id
        ) else exists (
          select 1 from public.stages stage
          where stage.race_edition_id = edition.edition_id and stage.status in ('planned', 'scheduled')
        ) end
      )
    into v_actual_editions, v_editions_ready
    from private.get_federation_hosting_editions(
      v_target_season_id, v_group.event_type, v_group.continent_code
    ) edition;
    if v_expected_editions = 0 or v_actual_editions <> v_expected_editions
       or not coalesce(v_editions_ready, false) then
      -- A partially generated programme is retried on the next maintenance run.
      continue;
    end if;

    -- Submission, withdrawal and settlement all take the account lock before
    -- changing candidacy status. The group lock order is stable for retries.
    perform account.id
    from public.national_federation_accounts account
    where account.season_id = v_season.id
      and exists (
        select 1 from public.national_federation_hosting_candidacies c
        where c.country_id = account.country_id and c.submitted_season_id = v_season.id
          and c.target_game_year = v_season.game_year + 1
          and c.event_key = v_group.event_key and c.status = 'pending'
      )
    order by account.id for update of account;

    select c.*, account.id as account_id into v_winner
    from public.national_federation_hosting_candidacies c
    join public.national_federation_accounts account
      on account.country_id = c.country_id and account.season_id = c.submitted_season_id
    where c.submitted_season_id = v_season.id and c.target_game_year = v_season.game_year + 1
      and c.event_key = v_group.event_key and c.status = 'pending'
      and account.balance >= private.get_national_federation_reserved_hosting_amount(c.country_id, c.submitted_season_id)
    order by c.selection_score desc, c.created_at, c.id
    limit 1 for update of c;

    update public.national_federation_hosting_candidacies c
    set status = case when c.id = v_winner.id then 'selected' else 'not_selected' end,
        decided_at = now(), updated_at = now()
    where c.submitted_season_id = v_season.id and c.target_game_year = v_season.game_year + 1
      and c.event_key = v_group.event_key and c.status = 'pending';

    if v_winner.id is null then continue; end if;

    v_projected_attendance := round(v_winner.base_attendance * 0.94
      * (0.75 + least(1000, greatest(0, v_winner.renown_score))::numeric / 2000));
    v_projected_revenue := v_projected_attendance * v_winner.revenue_per_attendee;
    insert into public.national_federation_hosting_awards (
      candidacy_id, country_id, target_game_year, event_type, event_key, continent_code,
      hosting_cost, projected_attendance, projected_gross_revenue, projected_net_return,
      prestige_gain, scheduled_edition_count
    ) values (
      v_winner.id, v_winner.country_id, v_winner.target_game_year, v_winner.event_type,
      v_winner.event_key, v_winner.continent_code, v_winner.hosting_cost,
      v_projected_attendance, v_projected_revenue, v_projected_revenue - v_winner.hosting_cost,
      v_winner.prestige_gain, v_expected_editions
    ) returning id into v_award_id;

    if v_group.event_type in ('world_championship_junior', 'continental_championship_junior') then
      update public.development_race_editions e
      set host_country_id = country.id, country_code = country.iso_alpha2,
          location_name = country.name, updated_at = now()
      from public.countries country, private.get_federation_hosting_editions(
        v_target_season_id, v_group.event_type, v_group.continent_code
      ) edition
      where country.id = v_winner.country_id and e.id = edition.edition_id
        and e.status = 'planned';
      get diagnostics v_actual_editions = row_count;
    elsif v_group.event_type in ('nations_cup_pro', 'quadrennial_games_pro') then
      -- The award trigger owns this update, including later maintenance replays.
      select count(*) into v_actual_editions
      from private.get_federation_hosting_editions(v_target_season_id, v_group.event_type, null) edition
      join public.race_editions e on e.id = edition.edition_id
      where e.host_country_id = v_winner.country_id
        and e.status in ('planned', 'registration_open', 'registration_closed');
    else
      update public.race_editions e
      set host_country_id = v_winner.country_id
      from private.get_federation_hosting_editions(
        v_target_season_id, v_group.event_type, v_group.continent_code
      ) edition
      where e.id = edition.edition_id and e.status in ('planned', 'registration_open', 'registration_closed');
      get diagnostics v_actual_editions = row_count;
    end if;
    if v_actual_editions <> v_expected_editions then
      raise exception 'Programme d’accueil modifié pendant l’attribution.';
    end if;

    update public.national_federation_accounts
    set balance = balance - v_winner.hosting_cost, updated_at = now()
    where id = v_winner.account_id;
    insert into public.national_federation_transactions (
      account_id, day_number, amount, category, description, source_reference, metadata
    ) values (
      v_winner.account_id, v_season.current_day_number, -v_winner.hosting_cost, 'hosting',
      'Organisation ' || v_winner.event_key || ' S' || v_winner.target_game_year::text,
      'federation-hosting:' || v_award_id::text || ':cost',
      jsonb_build_object('awardId', v_award_id, 'eventType', v_winner.event_type)
    );

    insert into public.national_federation_journal_entries (
      country_id, season_id, day_number, category, title, detail, source_reference
    ) values (
      v_winner.country_id, v_season.id, v_season.current_day_number,
      'governance', 'Pays hôte désigné',
      v_winner.event_key || ' S' || v_winner.target_game_year::text
        || ' · score automatique ' || v_winner.selection_score::text || '.',
      'federation-hosting:' || v_award_id::text || ':selected'
    );
    v_selected := v_selected + 1;
  end loop;
  return v_selected;
end;
$$;

create or replace function public.settle_due_national_federation_hosting_returns()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '30s'
set lock_timeout = '1500ms'
as $$
declare
  v_season public.seasons%rowtype;
  v_award record;
  v_account_id uuid;
  v_total integer;
  v_completed integer;
  v_all_terminal boolean;
  v_starters integer;
  v_places integer;
  v_participation numeric;
  v_completed_fraction numeric;
  v_attendance integer;
  v_gross numeric;
  v_refund numeric;
  v_credit numeric;
  v_prestige integer;
  v_settled integer := 0;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('federation-hosting-returns', 0)) then
    return 0;
  end if;
  -- Serialize against the rollover. A late receipt goes to the active
  -- account, after the previous season's balance has been carried forward.
  select season.* into v_season
  from public.seasons season
  where season.status = 'active' and exists (
    select 1 from public.national_federation_hosting_awards award
    where award.target_game_year between season.game_year - 1 and season.game_year
      and award.status = 'scheduled'
  )
  limit 1 for share of season;
  if v_season.id is null then return 0; end if;

  for v_award in
    select award.*, event_season.id as event_season_id,
      candidacy.base_attendance, candidacy.revenue_per_attendee
    from public.national_federation_hosting_awards award
    join public.national_federation_hosting_candidacies candidacy on candidacy.id = award.candidacy_id
    join public.seasons event_season on event_season.game_year = award.target_game_year
    where award.target_game_year between v_season.game_year - 1 and v_season.game_year
      and award.status = 'scheduled'
    order by award.selected_at, award.id
    for update of award skip locked
  loop
    select count(*), count(*) filter (where edition_status = 'completed'),
      bool_and(edition_status in ('completed', 'cancelled'))
    into v_total, v_completed, v_all_terminal
    from private.get_federation_hosting_editions(v_award.event_season_id, v_award.event_type, v_award.continent_code);

    if v_total = 0 or v_total <> coalesce(v_award.scheduled_edition_count, v_total)
       or not coalesce(v_all_terminal, false) then continue; end if;

    v_participation := 0;
    v_starters := 0;
    v_places := 0;
    v_attendance := 0;
    v_gross := 0;
    v_completed_fraction := v_completed::numeric / v_total;
    v_refund := round(v_award.hosting_cost * (1 - v_completed_fraction), 2);
    v_prestige := case when v_completed > 0 then v_award.prestige_gain else 0 end;
    if v_completed > 0 then
      if v_award.event_type in ('world_championship_junior', 'continental_championship_junior') then
        select sum(e.selection_maximum) * (
          select count(*) from public.countries country
          where country.is_active and (
            v_award.event_type = 'world_championship_junior'
            or country.continent_code = v_award.continent_code
          )
        ) into v_places
        from private.get_federation_hosting_editions(
          v_award.event_season_id, v_award.event_type, v_award.continent_code
        ) edition
        join public.development_race_editions e on e.id = edition.edition_id
        where edition.edition_status = 'completed';

        select count(*) into v_starters from (
          select distinct result.race_edition_id, result.competitor_key
          from private.get_federation_hosting_editions(
            v_award.event_season_id, v_award.event_type, v_award.continent_code
          ) edition
          join public.development_race_results result on result.race_edition_id = edition.edition_id
            and result.result_scope = 'stage'
          where edition.edition_status = 'completed'
        ) starts;
      else
        select sum(case
          when v_award.event_type = 'nations_cup_pro' then e.field_limit * slot.rider_limit
          when v_award.event_type = 'quadrennial_games_pro' then least(
            e.field_limit,
            coalesce((select sum(case when event.time_trial_race_edition_id = e.id
              then q.time_trial_rider_quota else q.rider_quota end)
              from public.national_federation_olympic_qualifications q
              where q.season_id = v_award.event_season_id), e.field_limit)
          )
          else e.field_limit end
        ) into v_places
        from private.get_federation_hosting_editions(
          v_award.event_season_id, v_award.event_type, v_award.continent_code
        ) edition
        join public.race_editions e on e.id = edition.edition_id
        left join public.national_federation_nations_cup_heats heat on heat.race_edition_id = e.id
        left join public.national_federation_selection_slots slot on slot.slot_key = heat.slot_key
        left join public.national_federation_olympic_events event on event.season_id = e.season_id
        where edition.edition_status = 'completed';

        select count(*) into v_starters from (
          select distinct stage.race_edition_id, result.race_roster_id
          from private.get_federation_hosting_editions(
            v_award.event_season_id, v_award.event_type, v_award.continent_code
          ) edition
          join public.stages stage on stage.race_edition_id = edition.edition_id
            and stage.status = 'completed'
          join public.stage_results result on result.stage_id = stage.id
            and result.status <> 'did_not_start'
          where edition.edition_status = 'completed'
        ) starts;
      end if;

      if coalesce(v_places, 0) <= 0 or coalesce(v_starters, 0) <= 0 then continue; end if;
      v_participation := least(1, v_starters::numeric / v_places);
      v_attendance := round(v_award.base_attendance * v_completed_fraction
        * (0.6 + v_participation * 0.4)
        * (0.75 + coalesce((
          select least(1000, greatest(0, renown.score))::numeric / 2000
          from public.national_federation_renown renown where renown.country_id = v_award.country_id
        ), 0)));
      v_gross := round(v_attendance * v_award.revenue_per_attendee * (1 + coalesce((
        select least(6, greatest(0, effects.hosting_revenue_bonus_percentage))
        from public.get_national_federation_race_organization_effects(v_award.country_id) effects
      ), 0) / 100));
    end if;

    select account.id into v_account_id
    from public.national_federation_accounts account
    where account.country_id = v_award.country_id and account.season_id = v_season.id
    for update;
    if v_account_id is null then continue; end if;

    with posted as (
      insert into public.national_federation_transactions (
        account_id, day_number, amount, category, description, source_reference, metadata
      )
      select v_account_id, v_season.current_day_number, transaction.amount, transaction.category,
        transaction.label || ' ' || v_award.event_key,
        'federation-hosting:' || v_award.id::text || transaction.suffix,
        jsonb_build_object('awardId', v_award.id, 'eventType', v_award.event_type,
          'attendance', v_attendance, 'participationRate', v_participation,
          'actualStarters', v_starters, 'availablePlaces', v_places,
          'completedEditions', v_completed, 'scheduledEditions', v_total, 'prestigeGain', v_prestige)
      from (values
        (v_gross, 'hosting', 'Recettes d’accueil', ':revenue'),
        (v_refund, 'refund', 'Remboursement d’accueil', ':refund')
      ) transaction(amount, category, label, suffix)
      where transaction.amount > 0
      on conflict (source_reference) do nothing
      returning amount
    )
    select coalesce(sum(amount), 0) into v_credit from posted;

    if v_credit > 0 then
      update public.national_federation_accounts set balance = balance + v_credit, updated_at = now()
      where id = v_account_id;
    end if;
    update public.national_federation_hosting_awards
    set actual_participation_rate = v_participation, actual_attendance = v_attendance,
        actual_starter_count = v_starters, actual_place_count = v_places,
        actual_gross_revenue = v_gross, actual_refund = v_refund,
        actual_net_return = v_gross + v_refund - hosting_cost,
        scheduled_edition_count = v_total, completed_edition_count = v_completed,
        status = case when v_completed = 0 then 'cancelled' else 'settled' end,
        settled_at = now()
    where id = v_award.id;
    if v_completed > 0 then
      perform public.refresh_national_federation_renown(v_award.country_id);
    end if;
    v_settled := v_settled + 1;
  end loop;
  return v_settled;
end;
$$;

revoke all on function public.settle_due_national_federation_hosting_candidacies() from public, anon, authenticated;
revoke all on function public.settle_due_national_federation_hosting_returns() from public, anon, authenticated;
grant execute on function public.settle_due_national_federation_hosting_candidacies() to service_role;
grant execute on function public.settle_due_national_federation_hosting_returns() to service_role;

notify pgrst, 'reload schema';
commit;

