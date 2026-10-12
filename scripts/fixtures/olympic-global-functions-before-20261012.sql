-- Technical definitions only, isolated regression baseline; never execute in production.
CREATE OR REPLACE FUNCTION public.get_national_federation_race_creation_score_base(p_country_id uuid, p_season_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '15s'
AS $function$
declare
  v_season public.seasons%rowtype;
  v_previous_season_id uuid;
  v_country_code text;
  v_nation_rank integer := 173;
  v_rank_target integer := 24;
  v_reference_teams integer := 0;
  v_current_teams integer := 0;
  v_member_target integer := 1;
  v_naturalizations integer := 0;
  v_naturalization_target integer := 1;
  v_published_selections integer := 0;
  v_nations_cup_rank integer;
  v_nations_cup_overall_rank integer;
  v_nations_cup_events integer := 0;
  v_nations_cup_pool_size integer := 0;
  v_nations_cup_target integer := 1;
  v_world_rank integer;
  v_continental_rank integer;
  v_junior_rank integer;
  v_school_count integer := 0;
  v_team_uci_rank integer;
  v_rider_uci_rank integer;
  v_team_uci_target integer := 35;
  v_rider_uci_target integer := 200;
  v_variants text[] := array[
    'naturalizations', 'championships', 'continental',
    'junior_championships', 'cycling_school', 'team_uci', 'rider_uci'
  ];
  v_offset integer;
  v_variant text;
  v_completed_objectives integer := 0;
  v_existing_races integer := 0;
  v_ranking_points integer := 0;
  v_objective_points integer := 0;
  v_calendar_penalty integer := 0;
  v_total integer := 0;
begin
  select * into v_season from public.seasons where id = p_season_id;
  select iso_alpha2 into v_country_code
  from public.countries
  where id = p_country_id and is_active = true;
  if v_season.id is null or v_country_code is null then
    raise exception 'La saison ou la fédération est introuvable.';
  end if;

  with country_points as (
    select ranking.country_id, sum(ranking.uci_points)::bigint as points
    from public.get_national_championship_country_rankings(p_season_id) as ranking
    group by ranking.country_id
  ), ranked as (
    select country_id,
      row_number() over (order by points desc, country_id)::integer as rank
    from country_points
  )
  select coalesce(rank, 173) into v_nation_rank
  from ranked where country_id = p_country_id;
  v_nation_rank := coalesce(v_nation_rank, 173);
  v_rank_target := case
    when v_nation_rank <= 16 then 8
    when v_nation_rank <= 48 then 16
    else 24
  end;
  v_team_uci_target := case when v_nation_rank <= 16 then 20 else 35 end;
  v_rider_uci_target := case
    when v_nation_rank <= 16 then 50
    when v_nation_rank <= 48 then 100
    else 200
  end;

  select id into v_previous_season_id
  from public.seasons where game_year = v_season.game_year - 1;
  select count(*)::integer into v_reference_teams
  from public.team_seasons
  where season_id = coalesce(v_previous_season_id, p_season_id)
    and registration_country_id = p_country_id
    and status in ('planned', 'active', 'completed');
  select count(*)::integer into v_current_teams
  from public.team_seasons
  where season_id = p_season_id
    and registration_country_id = p_country_id
    and status in ('planned', 'active', 'completed');
  v_member_target := v_reference_teams
    + case when v_reference_teams >= 8 then 2 else 1 end;
  if v_current_teams >= v_member_target then
    v_completed_objectives := v_completed_objectives + 1;
  end if;

  v_naturalization_target := least(
    3, greatest(1, ceil(greatest(1, v_reference_teams)::numeric / 4)::integer)
  );
  select count(*)::integer into v_naturalizations
  from public.rider_naturalizations
  where season_id = p_season_id and to_country_id = p_country_id;

  select count(*)::integer into v_published_selections
  from public.national_federation_selection_lists
  where country_id = p_country_id
    and season_id = p_season_id
    and manually_submitted_at is not null
    and status in ('pending_confirmation', 'finalized');
  if v_published_selections >= 5 then
    v_completed_objectives := v_completed_objectives + 1;
  end if;

  with standings as materialized (
    select * from public.get_national_federation_nations_cup_standings(p_season_id)
  )
  select
    case when own.group_code is null then own.division_rank else own.group_rank end,
    own.overall_rank,
    own.events_count,
    (select count(*)::integer from standings as peer
     where peer.division = own.division
       and peer.group_code is not distinct from own.group_code)
  into v_nations_cup_rank, v_nations_cup_overall_rank,
       v_nations_cup_events, v_nations_cup_pool_size
  from standings as own where own.country_id = p_country_id;
  v_nations_cup_events := coalesce(v_nations_cup_events, 0);
  v_nations_cup_target := greatest(
    1, least(5, ceil(coalesce(v_nations_cup_pool_size, 0) * 0.6)::integer)
  );
  if v_nations_cup_events > 0 and (
    (v_season.game_year % 4 = 0 and v_nations_cup_overall_rank <= v_rank_target)
    or (v_season.game_year % 4 <> 0 and v_nations_cup_rank <= v_nations_cup_target)
  ) then
    v_completed_objectives := v_completed_objectives + 1;
  end if;

  select min(result.final_rank)::integer into v_world_rank
  from public.race_results as result
  join public.race_editions as edition
    on edition.id = result.race_edition_id and edition.season_id = p_season_id
  join public.races as race
    on race.id = edition.race_id and race.competition_type = 'world_championship'
  join public.race_rosters as roster on roster.id = result.race_roster_id
  join public.riders as rider
    on rider.id = roster.rider_id and rider.country_id = p_country_id
  where result.status = 'classified';

  if v_season.game_year <= 3 then
    if v_naturalizations >= v_naturalization_target then
      v_completed_objectives := v_completed_objectives + 1;
    end if;
    if v_world_rank is not null and v_world_rank <= v_rank_target then
      v_completed_objectives := v_completed_objectives + 1;
    end if;
  else
    -- Same stable, season-specific two-slot selection as the UI. The array
    -- order is version 1 and must stay fixed for seasons already started.
    v_offset := (get_byte(uuid_send(p_country_id), 0) + v_season.game_year)
      % array_length(v_variants, 1);

    foreach v_variant in array array[
      v_variants[v_offset + 1],
      v_variants[((v_offset + 3) % array_length(v_variants, 1)) + 1]
    ] loop
      if v_variant = 'naturalizations' then
        if v_naturalizations >= v_naturalization_target then
          v_completed_objectives := v_completed_objectives + 1;
        end if;
      elsif v_variant = 'championships' then
        if v_world_rank is not null and v_world_rank <= v_rank_target then
          v_completed_objectives := v_completed_objectives + 1;
        end if;
      elsif v_variant = 'continental' then
        select min(result.final_rank)::integer into v_continental_rank
        from public.race_results as result
        join public.race_editions as edition
          on edition.id = result.race_edition_id and edition.season_id = p_season_id
        join public.races as race
          on race.id = edition.race_id
         and race.competition_type = 'continental_championship'
        join public.race_rosters as roster on roster.id = result.race_roster_id
        join public.riders as rider
          on rider.id = roster.rider_id and rider.country_id = p_country_id
        where result.status = 'classified';
        if v_continental_rank is not null and v_continental_rank <= v_rank_target then
          v_completed_objectives := v_completed_objectives + 1;
        end if;
      elsif v_variant = 'junior_championships' then
        select min(result.rank)::integer into v_junior_rank
        from public.development_race_results as result
        join public.development_race_editions as edition
          on edition.id = result.race_edition_id
         and edition.season_id = p_season_id
         and edition.competition_type in (
           'continental_road', 'continental_time_trial',
           'world_road', 'world_time_trial'
         )
        where result.country_code = v_country_code
          and result.result_scope = 'general';
        if v_junior_rank is not null and v_junior_rank <= v_rank_target then
          v_completed_objectives := v_completed_objectives + 1;
        end if;
      elsif v_variant = 'cycling_school' then
        select count(*)::integer into v_school_count
        from public.international_youth_centers as center
        join public.team_seasons as team_season
          on team_season.team_id = center.team_id
         and team_season.season_id = p_season_id
         and team_season.registration_country_id = p_country_id
         and team_season.status in ('planned', 'active', 'completed')
        where center.country_id = p_country_id
          and center.completed_at >= v_season.starts_on
          and center.completed_at < v_season.ends_on + 1;
        if v_school_count > 0 then
          v_completed_objectives := v_completed_objectives + 1;
        end if;
      elsif v_variant = 'team_uci' then
        with ranked as (
          select registration_country_id,
            row_number() over (order by points desc, display_name, team_id) as rank
          from public.team_seasons
          where season_id = p_season_id and status <> 'withdrawn' and points > 0
        )
        select min(rank)::integer into v_team_uci_rank
        from ranked where registration_country_id = p_country_id;
        if v_team_uci_rank is not null and v_team_uci_rank <= v_team_uci_target then
          v_completed_objectives := v_completed_objectives + 1;
        end if;
      elsif v_variant = 'rider_uci' then
        with ranked as (
          select rider.country_id,
            row_number() over (
              order by summary.points desc,
                rider.first_name || ' ' || rider.last_name, rider.id
            ) as rank
          from public.rider_season_summaries as summary
          join public.riders as rider on rider.id = summary.rider_id
          where summary.season_id = p_season_id and summary.points > 0
        )
        select min(rank)::integer into v_rider_uci_rank
        from ranked where country_id = p_country_id;
        if v_rider_uci_rank is not null and v_rider_uci_rank <= v_rider_uci_target then
          v_completed_objectives := v_completed_objectives + 1;
        end if;
      end if;
    end loop;
  end if;

  select count(*)::integer into v_existing_races
  from public.races
  where country_id = p_country_id
    and competition_type = 'standard'
    and status = 'active';
  v_ranking_points := greatest(0, 41 - v_nation_rank);
  v_objective_points := v_completed_objectives * 15;
  v_calendar_penalty := v_existing_races * 10;
  v_total := greatest(0, least(100,
    v_ranking_points + v_objective_points - v_calendar_penalty
  ));

  return jsonb_build_object(
    'nationRank', nullif(v_nation_rank, 173),
    'rankingPoints', v_ranking_points,
    'completedObjectiveCount', v_completed_objectives,
    'objectivePoints', v_objective_points,
    'existingRaceCount', v_existing_races,
    'calendarPenalty', v_calendar_penalty,
    'total', v_total,
    'threshold', 60,
    'eligible', v_total >= 60
  );
end;
$function$;
CREATE OR REPLACE FUNCTION public.save_national_federation_preselection(p_country_code text, p_slot_key text, p_rider_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '10s'
AS $function$
declare
  v_identity record;
  v_season public.seasons%rowtype;
  v_slot public.national_federation_selection_slots%rowtype;
  v_list_id uuid;
  v_revision integer;
  v_rider_ids uuid[] := coalesce(p_rider_ids, '{}'::uuid[]);
begin
  if (select auth.uid()) is null then
    raise exception 'Vous devez être connecté pour enregistrer une présélection.';
  end if;
  if false then
    raise exception 'La présélection est limitée à la fédération belge pendant la bêta.';
  end if;

  select * into v_identity
  from public.get_current_federation_identity(p_country_code);
  select * into v_season
  from public.seasons where status = 'active' limit 1;
  select * into v_slot
  from public.national_federation_selection_slots
  where slot_key = p_slot_key
    and active_from_game_year <= v_season.game_year;

  if v_identity.country_id is null or v_identity.team_id is null then
    raise exception 'Votre équipe ne fait pas partie de cette fédération.';
  end if;
  if v_season.id is null or v_season.game_year < 3 then
    raise exception 'Les présélections officielles seront disponibles à partir de la Saison 3.';
  end if;
  if v_slot.slot_key is null or not public.federation_selection_slot_is_available(v_slot.slot_key, v_season.game_year) then
    raise exception 'Cette épreuve de sélection n’est pas disponible.';
  end if;
  if not exists (
    select 1
    from public.national_federation_terms as term
    where term.country_id = v_identity.country_id
      and term.start_game_year <= v_season.game_year
      and term.end_game_year >= v_season.game_year
      and term.governance_mode = 'elected'
      and term.president_director_id = v_identity.sporting_director_id
  ) then
    raise exception 'Seul le président élu peut modifier la présélection.';
  end if;
  if cardinality(v_rider_ids) > v_slot.rider_limit then
    raise exception 'Le quota de cette épreuve est dépassé.';
  end if;
  if cardinality(v_rider_ids) <> (
    select count(distinct selected.rider_id)::integer
    from unnest(v_rider_ids) as selected(rider_id)
  ) then
    raise exception 'Un coureur ne peut apparaître deux fois dans la même liste.';
  end if;
  -- This nation-wide lock must be acquired before reading the other slots.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'federation-selection:' || v_identity.country_id::text || ':' || v_season.id::text,
      0
    )
  );

if v_slot.competition_code = 'nations_cup' and exists (
    select 1
    from public.national_federation_selection_lists as other_list
    join public.national_federation_selection_slots as other_slot
      on other_slot.slot_key = other_list.slot_key
     and other_slot.competition_code = 'nations_cup'
    join public.national_federation_selection_members as member
      on member.selection_list_id = other_list.id
    where other_list.country_id = v_identity.country_id
      and other_list.season_id = v_season.id
      and other_list.slot_key <> v_slot.slot_key
      and public.federation_selection_slot_is_available(other_list.slot_key, v_season.game_year)
      and coalesce(member.professional_rider_id, member.junior_rider_id) = any(v_rider_ids)
  ) then
    raise exception 'Un coureur ne peut disputer qu’une seule épreuve de Nations Cup.';
  end if;

  if v_slot.rider_category = 'professional' then
    if (select count(*) from public.riders as rider
        where rider.id = any(v_rider_ids)
          and rider.country_id = v_identity.country_id
          and rider.status in ('active', 'free_agent')) <> cardinality(v_rider_ids) then
      raise exception 'La liste contient un coureur professionnel inéligible.';
    end if;
  elsif (select count(*) from public.youth_academy_riders as rider
         where rider.id = any(v_rider_ids)
           and rider.country_id = v_identity.country_id
           and rider.status in ('active', 'recruited', 'free_agent')
           and v_season.game_year - rider.birth_game_year between 16 and 18) <> cardinality(v_rider_ids) then
    raise exception 'La liste contient un coureur junior inéligible.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_identity.country_id::text || ':' || v_season.id::text || ':' || v_slot.slot_key,
      0
    )
  );

  insert into public.national_federation_selection_lists (
    country_id, season_id, slot_key, status, revision, created_by_director_id
  ) values (
    v_identity.country_id, v_season.id, v_slot.slot_key, 'draft', 1,
    v_identity.sporting_director_id
  )
  on conflict (country_id, season_id, slot_key) do update set
    status = national_federation_selection_lists.status,
    revision = national_federation_selection_lists.revision + 1,
    created_by_director_id = excluded.created_by_director_id,
    published_at = national_federation_selection_lists.published_at,
    updated_at = now()
  returning id, revision into v_list_id, v_revision;

  -- The upsert locks the list before checking confirmations, just like replies.
  perform public.assert_federation_selection_open(v_identity.country_id, v_season.id, v_slot.slot_key);
  if exists (
    select 1 from public.national_federation_selection_members
    where selection_list_id = v_list_id and response_status = 'confirmed'
      and not (coalesce(professional_rider_id, junior_rider_id) = any(v_rider_ids))
  ) then
    raise exception 'Un coureur confirmé par son DS ne peut plus être retiré de la sélection.';
  end if;
  delete from public.national_federation_selection_members
  where selection_list_id = v_list_id and response_status <> 'confirmed'
    and not (coalesce(professional_rider_id, junior_rider_id) = any(v_rider_ids));

  if v_slot.rider_category = 'professional' then
    insert into public.national_federation_selection_members (
      selection_list_id, professional_rider_id, owner_team_id,
      owner_director_id, response_status
    )
    select
      v_list_id,
      rider.id,
      owner_contract.team_id,
      owner_assignment.sporting_director_id,
      'draft'
    from unnest(v_rider_ids) as selected(rider_id)
    join public.riders as rider on rider.id = selected.rider_id
    left join lateral (
      select contract.team_id
      from public.rider_contracts as contract
      where contract.rider_id = rider.id and contract.status = 'active'
      order by contract.created_at desc, contract.id desc
      limit 1
    ) as owner_contract on true
    left join lateral (
      select assignment.sporting_director_id
      from public.team_manager_assignments as assignment
      where assignment.team_id = owner_contract.team_id
        and assignment.role = 'general_manager'
        and assignment.status = 'active'
      order by assignment.created_at desc, assignment.id desc
      limit 1
    ) as owner_assignment on true on conflict do nothing;
  else
    insert into public.national_federation_selection_members (
      selection_list_id, junior_rider_id, owner_team_id,
      owner_director_id, response_status
    )
    select
      v_list_id,
      rider.id,
      rider.team_id,
      owner_assignment.sporting_director_id,
      'draft'
    from unnest(v_rider_ids) as selected(rider_id)
    join public.youth_academy_riders as rider on rider.id = selected.rider_id
    left join lateral (
      select assignment.sporting_director_id
      from public.team_manager_assignments as assignment
      where assignment.team_id = rider.team_id
        and assignment.role = 'general_manager'
        and assignment.status = 'active'
      order by assignment.created_at desc, assignment.id desc
      limit 1
    ) as owner_assignment on true on conflict do nothing;
  end if;

  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail, source_reference
  ) values (
    v_identity.country_id,
    v_season.id,
    v_season.current_day_number,
    'selection',
    'Présélection mise à jour',
    public.federation_selection_slot_label(v_slot.slot_key, v_slot.label, v_season.game_year) || ' · ' || cardinality(v_rider_ids)::text || '/' || v_slot.rider_limit::text || ' coureurs.',
    'federation-selection:' || v_list_id::text || ':revision:' || v_revision::text
  ) on conflict (source_reference) do nothing;

  return jsonb_build_object(
    'listId', v_list_id,
    'revision', v_revision,
    'riderCount', cardinality(v_rider_ids)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.publish_national_federation_preselection(p_country_code text, p_slot_key text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '10s'
AS $function$
declare
  v_identity record;
  v_season public.seasons%rowtype;
  v_list public.national_federation_selection_lists%rowtype;
  v_slot public.national_federation_selection_slots%rowtype;
  v_notified integer := 0;
  v_new_member_ids uuid[];
begin
  if (select auth.uid()) is null then raise exception 'Authentification requise.'; end if;
  if false then
    raise exception 'La publication est limitée à la fédération belge pendant la bêta.';
  end if;
  select * into v_identity from public.get_current_federation_identity(p_country_code);
  select * into v_season from public.seasons where status = 'active' limit 1;
  select selection_list.* into v_list
  from public.national_federation_selection_lists as selection_list
  where selection_list.country_id = v_identity.country_id
    and selection_list.season_id = v_season.id
    and selection_list.slot_key = p_slot_key
  for update;
  select * into v_slot from public.national_federation_selection_slots
  where slot_key = p_slot_key;

  if v_season.game_year < 3 then
    raise exception 'La publication sera disponible à partir de la Saison 3.';
  end if;
  if v_list.id is null or v_slot.slot_key is null then
    raise exception 'Enregistrez d’abord une présélection.';
  end if;
  if not exists (
    select 1 from public.national_federation_terms as term
    where term.country_id = v_identity.country_id
      and term.start_game_year <= v_season.game_year
      and term.end_game_year >= v_season.game_year
      and term.governance_mode = 'elected'
      and term.president_director_id = v_identity.sporting_director_id
  ) then
    raise exception 'Seul le président élu peut publier la présélection.';
  end if;

  perform public.assert_federation_selection_open(v_list.country_id, v_list.season_id, v_list.slot_key);
  update public.national_federation_selection_lists
  set manually_submitted_at = coalesce(manually_submitted_at, now())
  where id = v_list.id;
  select coalesce(array_agg(id), '{}'::uuid[]) into v_new_member_ids
  from public.national_federation_selection_members
  where selection_list_id = v_list.id and response_status = 'draft';
  update public.national_federation_selection_lists
  set status = case when exists (
      select 1 from public.national_federation_selection_members
      where selection_list_id = v_list.id and owner_director_id is not null
        and response_status in ('draft', 'pending')
    ) then 'pending_confirmation' else 'finalized' end,
    published_at = coalesce(published_at, now()), updated_at = now()
  where id = v_list.id;
  update public.national_federation_selection_members
  set
    response_status = case when owner_director_id is null then 'confirmed' else 'pending' end,
    responded_at = case when owner_director_id is null then now() else null end
  where selection_list_id = v_list.id and id = any(v_new_member_ids);

  insert into public.sporting_director_messages (
    sporting_director_id, season_id, message_type, sender_name, subject,
    preview, body, action_href, action_label, source_reference, is_important
  )
  select
    member.owner_director_id,
    v_season.id,
    'international_selection',
    'Fédération nationale',
    'Présélection nationale à confirmer',
    rider_name.name || ' est retenu pour ' || public.federation_selection_slot_label(v_slot.slot_key, v_slot.label, v_season.game_year) || '.',
    'Merci de confirmer ou refuser sa disponibilité. Le président pourra revoir sa liste après un refus.',
    '/jeu/selections-internationales',
    'Répondre à la sélection',
    'federation-selection:' || member.id::text || ':revision:' || v_list.revision::text,
    true
  from public.national_federation_selection_members as member
  cross join lateral (
    select coalesce(
      (select rider.first_name || ' ' || rider.last_name from public.riders as rider where rider.id = member.professional_rider_id),
      (select rider.first_name || ' ' || rider.last_name from public.youth_academy_riders as rider where rider.id = member.junior_rider_id),
      'Un coureur'
    ) as name
  ) as rider_name
  where member.selection_list_id = v_list.id
    and member.owner_director_id is not null
    and member.id = any(v_new_member_ids)
  on conflict (sporting_director_id, source_reference) do nothing;
  get diagnostics v_notified = row_count;

  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail, source_reference
  ) values (
    v_identity.country_id, v_season.id, v_season.current_day_number,
    'selection', 'Présélection soumise aux équipes',
    public.federation_selection_slot_label(v_slot.slot_key, v_slot.label, v_season.game_year) || ' · les DS concernés ont reçu une demande de confirmation.',
    'federation-selection:' || v_list.id::text || ':published:' || v_list.revision::text
  ) on conflict (source_reference) do nothing;

  return v_notified;
end;
$function$;

CREATE OR REPLACE FUNCTION public.respond_to_national_federation_preselection(p_member_id uuid, p_accept boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '10s'
AS $function$
declare
  v_identity record;
  v_season public.seasons%rowtype;
  v_member public.national_federation_selection_members%rowtype;
  v_list public.national_federation_selection_lists%rowtype;
  v_slot public.national_federation_selection_slots%rowtype;
  v_country_code text;
  v_rider_name text;
  v_president_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentification requise.';
  end if;

  -- Lock parent first: a simultaneous save cannot delete a newly accepted rider.
  select selection_list.* into v_list
  from public.national_federation_selection_lists as selection_list
  join public.national_federation_selection_members as member on member.selection_list_id = selection_list.id
  where member.id = p_member_id for update of selection_list;
  select * into v_member from public.national_federation_selection_members
  where id = p_member_id for update;
  select country.iso_alpha2 into v_country_code
  from public.countries as country
  where country.id = v_list.country_id;
  -- A Belgian DS must also be able to answer for a French rider, for example.
  select director.id as sporting_director_id, team.id as team_id,
    coalesce(team.amateur_name, team.internal_name) as team_name into v_identity
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment on assignment.sporting_director_id = director.id
    and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.teams as team on team.id = assignment.team_id and team.status = 'active'
  where director.auth_user_id = (select auth.uid()) and director.status = 'active'
    and director.id = v_member.owner_director_id and team.id = v_member.owner_team_id
  limit 1;
  select * into v_season
  from public.seasons
  where status = 'active'
  limit 1;
  select * into v_slot
  from public.national_federation_selection_slots
  where slot_key = v_list.slot_key;

  if v_member.id is null
     or v_identity.team_id is null
     or v_member.owner_team_id <> v_identity.team_id
     or v_member.owner_director_id is distinct from v_identity.sporting_director_id then
    raise exception 'Cette demande ne concerne pas votre équipe.';
  end if;
  if v_member.response_status <> 'pending' then
    raise exception 'Cette demande a déjà été traitée.';
  end if;

  perform public.assert_federation_callup_response_open(v_list.country_id, v_list.season_id, v_list.slot_key);
  if p_accept is null then raise exception 'Décision invalide.'; end if;
  if p_accept and v_member.professional_rider_id is not null and not exists (
    select 1 from public.rider_contracts as contract
    where contract.rider_id = v_member.professional_rider_id
      and contract.team_id = v_identity.team_id and contract.status = 'active'
  ) then raise exception 'Ce coureur ne fait plus partie de votre équipe.'; end if;
  if p_accept and v_member.junior_rider_id is not null and not exists (
    select 1 from public.youth_academy_riders as rider
    where rider.id = v_member.junior_rider_id and rider.team_id = v_identity.team_id
      and rider.status in ('active', 'recruited')
      and v_season.game_year - rider.birth_game_year between 16 and 18
  ) then raise exception 'Ce junior ne fait plus partie des coureurs éligibles de votre équipe.'; end if;

  update public.national_federation_selection_members
  set
    response_status = case when p_accept then 'confirmed' else 'declined' end,
    responded_at = now()
  where id = v_member.id;

  select coalesce(
    (
      select rider.first_name || ' ' || rider.last_name
      from public.riders as rider
      where rider.id = v_member.professional_rider_id
    ),
    (
      select rider.first_name || ' ' || rider.last_name
      from public.youth_academy_riders as rider
      where rider.id = v_member.junior_rider_id
    ),
    'Le coureur'
  ) into v_rider_name;

  select term.president_director_id into v_president_id
  from public.national_federation_terms as term
  where term.country_id = v_list.country_id
    and term.start_game_year <= v_season.game_year
    and term.end_game_year >= v_season.game_year
  limit 1;

  if v_president_id is not null
     and v_president_id <> v_identity.sporting_director_id then
    insert into public.sporting_director_messages (
      sporting_director_id, season_id, message_type, sender_name, subject,
      preview, body, action_href, action_label, source_reference, is_important
    ) values (
      v_president_id, v_season.id, 'international_selection',
      v_identity.team_name,
      case when p_accept then 'Présélection confirmée' else 'Présélection refusée' end,
      v_rider_name || case when p_accept then ' sera disponible.' else ' ne sera pas disponible.' end,
      case when p_accept
        then 'La participation du coureur est confirmée par son DS.'
        else 'La liste doit être revue ou un remplaçant doit être appelé.' end,
      '/jeu/federations/' || lower(v_country_code) || '?onglet=selections',
      'Voir la sélection',
      'federation-selection:' || v_member.id::text || ':response',
      not p_accept
    ) on conflict (sporting_director_id, source_reference) do nothing;
  end if;

  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail, source_reference
  ) values (
    v_list.country_id, v_season.id, v_season.current_day_number, 'selection',
    case when p_accept then 'Disponibilité confirmée' else 'Disponibilité refusée' end,
    v_identity.team_name || ' · ' || v_rider_name || ' · ' || public.federation_selection_slot_label(v_slot.slot_key, v_slot.label, v_season.game_year) || '.',
    'federation-selection:' || v_member.id::text || ':response'
  ) on conflict (source_reference) do nothing;

  if not exists (
    select 1
    from public.national_federation_selection_members
    where selection_list_id = v_list.id
      and response_status = 'pending'
  ) then
    update public.national_federation_selection_lists
    set status = 'finalized', updated_at = now()
    where id = v_list.id;
  end if;


  if not p_accept and v_member.professional_rider_id is not null then
    perform public.refill_national_federation_professional_selection(
      v_list.id, now()
    );
  end if;

  perform public.sync_national_federation_championship_lineup(v_list.id);
  if p_accept and v_member.professional_rider_id is not null and not exists (
    select 1 from public.national_federation_selection_race_links as link
    join public.race_rosters as roster on roster.race_registration_id = link.race_registration_id
    where link.selection_list_id = v_list.id and roster.rider_id = v_member.professional_rider_id
      and roster.status in ('selected', 'confirmed')
  ) then
    raise exception 'La participation ne peut pas être confirmée : le coureur est indisponible pour cette épreuve (tour verrouillé ou commencé notamment).';
  end if;
  return case when p_accept then 'confirmed' else 'declined' end;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_national_federation_championship_lineup(p_selection_list_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '15s'
AS $function$
declare
  v_list public.national_federation_selection_lists%rowtype;
  v_slot public.national_federation_selection_slots%rowtype;
  v_country public.countries%rowtype;
  v_season public.seasons%rowtype;
  v_edition_id uuid;
  v_departure_at timestamptz;
  v_linked_edition_id uuid;
  v_registration_id uuid;
  v_member record;
  v_roster_count integer := 0;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'federation-startlist:' || p_selection_list_id::text, 0
    )
  );
  select * into v_list
  from public.national_federation_selection_lists
  where id = p_selection_list_id for update;
  if v_list.id is null
     or v_list.status not in ('pending_confirmation', 'finalized') then
    return 0;
  end if;
  select * into v_slot from public.national_federation_selection_slots
  where slot_key = v_list.slot_key;
  select * into v_country from public.countries where id = v_list.country_id;
  select * into v_season from public.seasons where id = v_list.season_id;
  if v_season.game_year < 3 or v_slot.rider_category <> 'professional'
     or v_slot.competition_code not in (
       'world_championship', 'continental_championship', 'nations_cup'
     ) then return 0; end if;

  select target.race_edition_id, target.departure_at
  into v_edition_id, v_departure_at
  from public.get_national_federation_selection_target(
    v_list.country_id, v_list.season_id, v_list.slot_key
  ) as target;
  if v_edition_id is null or v_departure_at <= now() then return 0; end if;

  select link.race_registration_id, link.race_edition_id
  into v_registration_id, v_linked_edition_id
  from public.national_federation_selection_race_links as link
  where link.selection_list_id = v_list.id;

  -- Rehome pre-existing global Nations Cup registrations into the country's
  -- exact division/group heat. The old registration remains as an auditable
  -- withdrawn row and can no longer leak riders into D1.
  if v_registration_id is not null
     and v_linked_edition_id is distinct from v_edition_id then
    update public.race_rosters
    set status = 'withdrawn'
    where race_registration_id = v_registration_id
      and status in ('selected', 'confirmed');
    update public.race_registrations
    set status = 'withdrawn', decided_at = now()
    where id = v_registration_id;
    v_registration_id := null;
  end if;

  if v_registration_id is null then
    insert into public.race_registrations (
      race_edition_id, team_season_id, historical_team_name,
      entry_method, status, registered_at, decided_at
    ) values (
      v_edition_id, null, v_country.name,
      'automatic', 'accepted', now(), now()
    ) returning id into v_registration_id;
    insert into public.national_federation_selection_race_links (
      selection_list_id, race_edition_id, race_registration_id, synced_at
    ) values (v_list.id, v_edition_id, v_registration_id, now())
    on conflict (selection_list_id) do update set
      race_edition_id = excluded.race_edition_id,
      race_registration_id = excluded.race_registration_id,
      synced_at = excluded.synced_at;
  else
    update public.race_registrations
    set status = 'accepted', historical_team_name = v_country.name,
        decided_at = now()
    where id = v_registration_id;
    update public.national_federation_selection_race_links
    set race_edition_id = v_edition_id, synced_at = now()
    where selection_list_id = v_list.id;
  end if;

  update public.race_rosters as roster
  set status = 'withdrawn'
  from public.race_registrations as registration, public.riders as rider
  where registration.id = roster.race_registration_id
    and rider.id = roster.rider_id
    and registration.race_edition_id = v_edition_id
    and registration.id <> v_registration_id
    and rider.country_id = v_list.country_id
    and roster.status in ('selected', 'confirmed');
  update public.race_rosters as roster
  set status = 'withdrawn'
  where roster.race_registration_id = v_registration_id
    and roster.status in ('selected', 'confirmed')
    and not exists (
      select 1 from public.national_federation_selection_members as member
      where member.selection_list_id = v_list.id
        and member.professional_rider_id = roster.rider_id
        and member.response_status = 'confirmed'
    );

  for v_member in
    select member.professional_rider_id as rider_id
    from public.national_federation_selection_members as member
    join public.riders as rider on rider.id = member.professional_rider_id
    where member.selection_list_id = v_list.id
      and member.response_status = 'confirmed'
      and not exists (
        select 1
        from public.race_rosters as existing_roster
        where existing_roster.race_registration_id = v_registration_id
          and existing_roster.rider_id = member.professional_rider_id
          and existing_roster.status in ('selected', 'confirmed')
      )
      and rider.country_id = v_list.country_id
      and rider.status in ('active', 'free_agent')
    order by member.created_at, member.id
    limit v_slot.rider_limit
  loop
    begin
      perform public.prioritize_federation_championship_rider(
        v_edition_id, v_member.rider_id
      );
      insert into public.race_rosters (
        race_registration_id, rider_id, race_role, status, selected_at
      ) values (
        v_registration_id, v_member.rider_id, 'auto', 'confirmed', now()
      ) on conflict (race_registration_id, rider_id) do update set
        race_role = 'auto', status = 'confirmed',
        selected_at = excluded.selected_at;
    exception when sqlstate 'P0001' then
      raise warning 'Coureur % absent de la startlist fédérale: %',
        v_member.rider_id, sqlerrm;
    end;
  end loop;

  update public.race_registrations as registration
  set status = 'withdrawn', decided_at = now()
  where registration.race_edition_id = v_edition_id
    and registration.entry_method = 'automatic'
    and not exists (
      select 1 from public.race_rosters as roster
      where roster.race_registration_id = registration.id
        and roster.status in ('selected', 'confirmed')
    );
  select count(*)::integer into v_roster_count
  from public.race_rosters
  where race_registration_id = v_registration_id
    and status in ('selected', 'confirmed');
  return v_roster_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_national_federation_selection_target(p_country_id uuid, p_season_id uuid, p_slot_key text)
 RETURNS TABLE(race_edition_id uuid, race_slug text, edition_status text, departure_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select edition.id, race.slug, edition.status,
    min(stage.departure_at) as departure_at
  from public.national_federation_selection_slots as slot
  join public.countries as country on country.id = p_country_id
  join public.race_editions as edition on edition.season_id = p_season_id
  join public.races as race on race.id = edition.race_id
    and race.competition_type = slot.competition_code
  join public.stages as stage on stage.race_edition_id = edition.id
  where public.federation_selection_slot_is_available(slot.slot_key, (select s.game_year from public.seasons s where s.id=p_season_id))
    and slot.slot_key = p_slot_key
    and slot.rider_category = 'professional'
    and edition.status <> 'cancelled'
    and (
      (slot.competition_code = 'nations_cup' and exists (
        select 1
        from public.national_federation_nations_cup_assignments as assignment
        join public.national_federation_nations_cup_heats as heat
          on heat.season_id = assignment.season_id
         and heat.division = assignment.division
         and heat.group_code is not distinct from assignment.group_code
         and heat.slot_key = slot.slot_key
         and heat.race_edition_id = edition.id
        where assignment.country_id = p_country_id
          and assignment.season_id = p_season_id
      ))
      or (
        slot.competition_code in (
          'continental_championship', 'world_championship'
        )
        and exists (
          select 1
          from public.international_nation_qualification_snapshots as snapshot
          where snapshot.season_id = p_season_id
            and snapshot.competition_code = slot.competition_code
            and snapshot.country_id = p_country_id
            and snapshot.is_qualified = true
        )
        and (
          slot.competition_code <> 'continental_championship'
          or race.championship_continent_code = country.continent_code
        )
        and stage.stage_type = case when slot.profile_label = 'Chrono'
          then 'individual_time_trial' else 'road' end
      )
    )
  group by edition.id, race.slug
  order by (edition.status = 'cancelled'), min(stage.departure_at), edition.id
  limit 1
$function$;

CREATE OR REPLACE FUNCTION public.get_national_federation_selection_schedule(p_country_id uuid, p_season_id uuid)
 RETURNS TABLE(slot_key text, label text, rider_category text, race_edition_id uuid, race_href text, departure_at timestamp with time zone, closes_at timestamp with time zone, is_open boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select slot.slot_key, public.federation_selection_slot_label(slot.slot_key, slot.label, season.game_year), slot.rider_category,
    coalesce(pro.race_edition_id, junior.id),
    case when pro.race_edition_id is not null
      then '/jeu/courses/' || pro.race_slug
      when junior.id is not null
      then '/jeu/resultats-juniors/' || junior.slug end,
    coalesce(pro.departure_at, junior.departure_at),
    deadline.closes_at,
    coalesce(season.status = 'active' and season.game_year >= 3
      and coalesce(pro.edition_status, junior.status)
        not in ('completed', 'cancelled')
      and now() < deadline.closes_at, false)
  from public.national_federation_selection_slots as slot
  join public.countries as country on country.id = p_country_id
  join public.seasons as season on season.id = p_season_id
    and season.game_year >= slot.active_from_game_year
  left join lateral public.get_national_federation_selection_target(
    country.id, season.id, slot.slot_key
  ) as pro on slot.rider_category = 'professional'
  left join lateral (
    select edition.id, edition.slug, edition.status,
      day.calendar_date::timestamp at time zone 'Europe/Paris' as departure_at
    from public.development_race_editions as edition
    join public.season_days as day on day.season_id = edition.season_id
      and day.day_number = edition.start_day_number
    where slot.rider_category = 'junior' and edition.season_id = season.id
      and edition.competition_type = case slot.slot_key
        when 'cc-junior-road' then 'continental_road'
        when 'cc-junior-itt' then 'continental_time_trial'
        when 'world-junior-road' then 'world_road'
        when 'world-junior-itt' then 'world_time_trial'
        when 'nc-junior-road' then 'nations_cup_junior' end
      and (slot.competition_code <> 'continental_championship_junior'
        or edition.championship_continent_code = country.continent_code)
    order by (edition.status = 'cancelled'), edition.start_day_number,
      edition.id limit 1
  ) as junior on true
  cross join lateral (
    select case
      when pro.race_edition_id is not null then
        pro.departure_at - case
          when season.game_year = 3
            and slot.competition_code = 'continental_championship'
            then interval '1 hour'
          when slot.competition_code in (
            'continental_championship', 'world_championship'
          ) then interval '24 hours'
          else interval '1 hour'
        end
      else junior.departure_at
    end as closes_at
  ) as deadline
  where public.federation_selection_slot_is_available(slot.slot_key, season.game_year);
$function$;

CREATE OR REPLACE FUNCTION public.prepare_due_automatic_federation_professional_lineups(p_now timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '150s'
AS $function$
declare
  v_season public.seasons%rowtype;
  v_slot record;
  v_country record;
  v_expired record;
  v_edition_id uuid;
  v_departure_at timestamptz;
  v_closes_at timestamptz;
  v_automatic boolean;
  v_list public.national_federation_selection_lists%rowtype;
  v_selected integer;
  v_added integer;
  v_candidate record;
  v_total integer := 0;
begin
  select * into v_season
  from public.seasons as season
  where season.status = 'active'
  limit 1;
  if v_season.id is null or v_season.game_year < 3 then return 0; end if;

  perform public.ensure_professional_nations_cup(v_season.id);
  perform public.freeze_due_international_nation_qualifications(p_now);

  -- Expire unresolved calls before looking for replacements.  They are not
  -- selected, and are retained in history as declined for auditability.
  for v_expired in
    select selection_list.id
    from public.national_federation_selection_lists as selection_list
    join public.national_federation_selection_slots as slot
      on slot.slot_key = selection_list.slot_key
    cross join lateral public.get_national_federation_selection_target(
      selection_list.country_id,
      selection_list.season_id,
      selection_list.slot_key
    ) as target
    where selection_list.season_id = v_season.id
      and slot.rider_category = 'professional'
      and public.get_national_federation_callup_response_closes_at(
        slot.competition_code,
        slot.rider_category,
        target.departure_at
      ) <= p_now
      and exists (
        select 1
        from public.national_federation_selection_members as member
        where member.selection_list_id = selection_list.id
          and member.response_status = 'pending'
      )
  loop
    update public.national_federation_selection_members
    set response_status = 'declined', responded_at = p_now
    where selection_list_id = v_expired.id
      and response_status = 'pending';
    update public.national_federation_selection_lists
    set status = 'finalized', updated_at = p_now
    where id = v_expired.id;
  end loop;

  for v_slot in
    select slot.*
    from public.national_federation_selection_slots as slot
    where slot.rider_category = 'professional'
      and slot.competition_code in (
        'continental_championship', 'world_championship', 'nations_cup'
      )
      and slot.active_from_game_year <= v_season.game_year
      and public.federation_selection_slot_is_available(slot.slot_key, v_season.game_year)
    order by slot.day_number, slot.slot_key
  loop
    if v_slot.competition_code in (
      'continental_championship', 'world_championship'
    ) and coalesce(v_season.current_day_number, 0) < 8 then
      continue;
    end if;

    for v_country in
      select country.id, country.name, country.iso_alpha2,
        country.continent_code
      from public.countries as country
      where country.is_active = true
        and exists (
          select 1 from public.riders as rider
          join public.rider_season_ratings as rating
            on rating.rider_id = rider.id and rating.season_id = v_season.id
          where rider.country_id = country.id
            and rider.status in ('active', 'free_agent')
        )
      order by country.id
    loop
      v_edition_id := null;
      v_departure_at := null;
      select target.race_edition_id, target.departure_at
      into v_edition_id, v_departure_at
      from public.get_national_federation_selection_target(
        v_country.id, v_season.id, v_slot.slot_key
      ) as target;
      if v_edition_id is null then continue; end if;

      v_closes_at :=
        public.get_national_federation_callup_response_closes_at(
          v_slot.competition_code,
          v_slot.rider_category,
          v_departure_at
        );
      if p_now >= v_closes_at then continue; end if;
      if v_slot.competition_code = 'nations_cup'
         and public.federation_professional_call_up_is_due(
           v_slot.competition_code, v_departure_at, p_now
         ) is not true then
        continue;
      end if;

      select coalesce(preference.automatic_selection, true)
      into v_automatic
      from (select 1) as singleton
      left join public.national_federation_selection_preferences as preference
        on preference.country_id = v_country.id
       and preference.season_id = v_season.id;
      if not v_automatic then continue; end if;

      v_list.id := null;
      select * into v_list
      from public.national_federation_selection_lists as selection_list
      where selection_list.country_id = v_country.id
        and selection_list.season_id = v_season.id
        and selection_list.slot_key = v_slot.slot_key
      for update;

      if v_list.id is null then
        insert into public.national_federation_selection_lists (
          country_id, season_id, slot_key, status, revision,
          created_by_director_id, published_at, updated_at
        ) values (
          v_country.id, v_season.id, v_slot.slot_key,
          'pending_confirmation', 1, null, p_now, p_now
        ) returning * into v_list;
      else
        -- A draft cannot silently become a federation decision when automatic
        -- mode takes over.  Confirmed and already pending calls are preserved.
        update public.national_federation_selection_members
        set response_status = 'declined', responded_at = p_now
        where selection_list_id = v_list.id
          and response_status = 'draft';
      end if;

      select count(*)::integer into v_selected
      from public.national_federation_selection_members as member
      where member.selection_list_id = v_list.id
        and member.response_status in ('pending', 'confirmed');
      v_added := 0;

      while v_selected < v_slot.rider_limit loop
        select rider.id as rider_id, ownership.team_id,
          ownership.sporting_director_id
        into v_candidate
        from public.riders as rider
        join public.rider_season_ratings as rating
          on rating.rider_id = rider.id and rating.season_id = v_season.id
        left join lateral (
          select contract.team_id, assignment.sporting_director_id
          from public.rider_contracts as contract
          left join public.team_manager_assignments as assignment
            on assignment.team_id = contract.team_id
           and assignment.role = 'general_manager'
           and assignment.status = 'active'
          where contract.rider_id = rider.id and contract.status = 'active'
          order by (assignment.sporting_director_id is not null) desc,
            contract.created_at desc, contract.id desc
          limit 1
        ) as ownership on true
        where rider.country_id = v_country.id
          and rider.status in ('active', 'free_agent')
          and not exists (
            select 1
            from public.national_federation_selection_members as member
            where member.selection_list_id = v_list.id
              and member.professional_rider_id = rider.id
          )
          and not exists (
            select 1 from public.rider_injuries as injury
            where injury.rider_id = rider.id and injury.status = 'active'
              and injury.started_at < v_departure_at
              and injury.expected_recovery_at > v_departure_at
          )
          and (
            v_slot.competition_code <> 'nations_cup'
            or not exists (
              select 1
              from public.national_federation_selection_members as other_member
              join public.national_federation_selection_lists as other_list
                on other_list.id = other_member.selection_list_id
              join public.national_federation_selection_slots as other_slot
                on other_slot.slot_key = other_list.slot_key
              where other_list.country_id = v_country.id
                and other_list.season_id = v_season.id
                and other_list.id <> v_list.id
                and public.federation_selection_slot_is_available(other_list.slot_key, v_season.game_year)
                and other_slot.competition_code = 'nations_cup'
                and other_member.professional_rider_id = rider.id
                and other_member.response_status in ('pending', 'confirmed')
            )
          )
        order by
          case (case when v_season.game_year % 4 = 0 and v_slot.slot_key = 'nc-hills' then 'Olympique' else v_slot.profile_label end)
            when 'Olympique' then rating.mountain * .26 + rating.hills * .18 + rating.cobbles * .16
          + rating.endurance * .15 + rating.resistance * .10 + rating.sprint * .09 + rating.acceleration * .06
        when 'Montagne' then rating.mountain * .42 + rating.endurance * .18 + rating.recovery * .15 + rating.hills * .15 + rating.resistance * .10
            when 'Vallons' then rating.hills * .42 + rating.acceleration * .18 + rating.endurance * .15 + rating.mountain * .15 + rating.resistance * .10
            when 'Sprint' then rating.sprint * .40 + rating.acceleration * .25 + rating.flat * .15 + rating.endurance * .10 + rating.resistance * .10
            when 'Pavés' then rating.cobbles * .40 + rating.flat * .18 + rating.resistance * .17 + rating.endurance * .15 + rating.acceleration * .10
            when 'Chrono' then rating.time_trial * .55 + rating.prologue * .15 + rating.flat * .12 + rating.endurance * .10 + rating.resistance * .08
            else (rating.mountain + rating.hills + rating.flat + rating.sprint + rating.cobbles + rating.endurance + rating.resistance) / 7.0
          end desc,
          rider.id
        limit 1;
        if v_candidate.rider_id is null then exit; end if;

        insert into public.national_federation_selection_members (
          selection_list_id, professional_rider_id, owner_team_id,
          owner_director_id, response_status, responded_at
        ) values (
          v_list.id, v_candidate.rider_id, v_candidate.team_id,
          v_candidate.sporting_director_id,
          case when v_candidate.sporting_director_id is null
            then 'confirmed' else 'pending' end,
          case when v_candidate.sporting_director_id is null
            then p_now else null end
        );
        v_selected := v_selected + 1;
        v_added := v_added + 1;
        v_total := v_total + 1;
      end loop;

      update public.national_federation_selection_lists
      set status = case when exists (
            select 1
            from public.national_federation_selection_members as member
            where member.selection_list_id = v_list.id
              and member.response_status = 'pending'
          ) then 'pending_confirmation' else 'finalized' end,
        created_by_director_id = null,
        published_at = coalesce(published_at, p_now),
        updated_at = case when v_added > 0 then p_now else updated_at end
      where id = v_list.id;

      insert into public.sporting_director_messages (
        sporting_director_id, season_id, message_type, sender_name, subject,
        preview, body, action_href, action_label, source_reference,
        is_important
      )
      select member.owner_director_id, v_season.id,
        'international_selection', v_country.name || ' · Fédération',
        'Convocation internationale à confirmer',
        rider.first_name || ' ' || rider.last_name || ' est convoqué pour '
          || public.federation_selection_slot_label(v_slot.slot_key, v_slot.label, v_season.game_year) || '.',
        'La fédération propose ce coureur. Confirmez ou refusez avant la date limite ; sans réponse, il ne sera pas mobilisé.',
        '/jeu/selections-internationales', 'Répondre à la convocation',
        'federation-auto-callup:' || member.id::text, true
      from public.national_federation_selection_members as member
      join public.riders as rider on rider.id = member.professional_rider_id
      where member.selection_list_id = v_list.id
        and member.owner_director_id is not null
        and member.response_status = 'pending'
      on conflict (sporting_director_id, source_reference) do nothing;

      if v_added > 0 then
        insert into public.national_federation_journal_entries (
          country_id, season_id, day_number, category, title, detail,
          source_reference
        ) values (
          v_country.id, v_season.id, v_season.current_day_number,
          'selection', 'Convocations automatiques envoyées',
          public.federation_selection_slot_label(v_slot.slot_key, v_slot.label, v_season.game_year) || ' · ' || v_added::text
            || ' nouvelle(s) convocation(s), sans validation implicite.',
          'federation-auto-callups:' || v_list.id::text || ':'
            || extract(epoch from p_now)::bigint::text
        ) on conflict (source_reference) do nothing;
      end if;
    end loop;
  end loop;
  return v_total;
end;
$function$;

CREATE OR REPLACE FUNCTION public.refill_national_federation_professional_selection(p_selection_list_id uuid, p_now timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
declare
  v_list public.national_federation_selection_lists%rowtype;
  v_slot public.national_federation_selection_slots%rowtype;
  v_season public.seasons%rowtype;
  v_country public.countries%rowtype;
  v_departure_at timestamptz;
  v_closes_at timestamptz;
  v_automatic boolean;
  v_selected integer := 0;
  v_added integer := 0;
  v_candidate record;
begin
  select * into v_list
  from public.national_federation_selection_lists
  where id = p_selection_list_id
  for update;

  if v_list.id is null then return 0; end if;

  select * into v_slot
  from public.national_federation_selection_slots
  where slot_key = v_list.slot_key;

  select * into v_season
  from public.seasons
  where id = v_list.season_id
    and status = 'active';

  select * into v_country
  from public.countries
  where id = v_list.country_id;

  if v_season.id is null
     or v_season.game_year < 3
     or v_slot.rider_category <> 'professional'
     or not public.federation_selection_slot_is_available(v_slot.slot_key, v_season.game_year)
     or v_slot.competition_code not in (
       'continental_championship', 'world_championship', 'nations_cup'
     ) then
    return 0;
  end if;

  select coalesce(preference.automatic_selection, true)
  into v_automatic
  from (select 1) as singleton
  left join public.national_federation_selection_preferences as preference
    on preference.country_id = v_list.country_id
   and preference.season_id = v_list.season_id;

  if not v_automatic then return 0; end if;
  if v_slot.competition_code in (
       'continental_championship', 'world_championship'
     ) and coalesce(v_season.current_day_number, 0) < 8 then
    return 0;
  end if;

  select target.departure_at
  into v_departure_at
  from public.get_national_federation_selection_target(
    v_list.country_id, v_list.season_id, v_list.slot_key
  ) as target;

  if v_departure_at is null then return 0; end if;

  v_closes_at :=
    public.get_national_federation_callup_response_closes_at(
      v_slot.competition_code,
      v_slot.rider_category,
      v_departure_at
    );

  if p_now >= v_closes_at then return 0; end if;
  if v_slot.competition_code = 'nations_cup'
     and public.federation_professional_call_up_is_due(
       v_slot.competition_code, v_departure_at, p_now
     ) is not true then
    return 0;
  end if;

  update public.national_federation_selection_members
  set response_status = 'declined', responded_at = p_now
  where selection_list_id = v_list.id
    and response_status = 'draft';

  select count(*)::integer into v_selected
  from public.national_federation_selection_members as member
  where member.selection_list_id = v_list.id
    and member.response_status in ('pending', 'confirmed');

  while v_selected < v_slot.rider_limit loop
    select
      rider.id as rider_id,
      ownership.team_id,
      ownership.sporting_director_id
    into v_candidate
    from public.riders as rider
    join public.rider_season_ratings as rating
      on rating.rider_id = rider.id
     and rating.season_id = v_season.id
    left join lateral (
      select contract.team_id, assignment.sporting_director_id
      from public.rider_contracts as contract
      left join public.team_manager_assignments as assignment
        on assignment.team_id = contract.team_id
       and assignment.role = 'general_manager'
       and assignment.status = 'active'
      where contract.rider_id = rider.id
        and contract.status = 'active'
      order by
        (assignment.sporting_director_id is not null) desc,
        contract.created_at desc,
        contract.id desc
      limit 1
    ) as ownership on true
    where rider.country_id = v_list.country_id
      and rider.status in ('active', 'free_agent')
      and not exists (
        select 1
        from public.national_federation_selection_members as member
        where member.selection_list_id = v_list.id
          and member.professional_rider_id = rider.id
      )
      and not exists (
        select 1
        from public.rider_injuries as injury
        where injury.rider_id = rider.id
          and injury.status = 'active'
          and injury.started_at < v_departure_at
          and injury.expected_recovery_at > v_departure_at
      )
      and (
        v_slot.competition_code <> 'nations_cup'
        or not exists (
          select 1
          from public.national_federation_selection_members as other_member
          join public.national_federation_selection_lists as other_list
            on other_list.id = other_member.selection_list_id
          join public.national_federation_selection_slots as other_slot
            on other_slot.slot_key = other_list.slot_key
          where other_list.country_id = v_list.country_id
            and other_list.season_id = v_list.season_id
            and other_list.id <> v_list.id
                and public.federation_selection_slot_is_available(other_list.slot_key, v_season.game_year)
            and other_slot.competition_code = 'nations_cup'
            and other_member.professional_rider_id = rider.id
            and other_member.response_status in ('pending', 'confirmed')
        )
      )
    order by
      case (case when v_season.game_year % 4 = 0 and v_slot.slot_key = 'nc-hills' then 'Olympique' else v_slot.profile_label end)
        when 'Olympique' then rating.mountain * .26 + rating.hills * .18 + rating.cobbles * .16
          + rating.endurance * .15 + rating.resistance * .10 + rating.sprint * .09 + rating.acceleration * .06
        when 'Montagne' then rating.mountain * .42
          + rating.endurance * .18 + rating.recovery * .15
          + rating.hills * .15 + rating.resistance * .10
        when 'Vallons' then rating.hills * .42
          + rating.acceleration * .18 + rating.endurance * .15
          + rating.mountain * .15 + rating.resistance * .10
        when 'Sprint' then rating.sprint * .40
          + rating.acceleration * .25 + rating.flat * .15
          + rating.endurance * .10 + rating.resistance * .10
        when 'Pavés' then rating.cobbles * .40
          + rating.flat * .18 + rating.resistance * .17
          + rating.endurance * .15 + rating.acceleration * .10
        when 'Chrono' then rating.time_trial * .55
          + rating.prologue * .15 + rating.flat * .12
          + rating.endurance * .10 + rating.resistance * .08
        else (rating.mountain + rating.hills + rating.flat + rating.sprint
          + rating.cobbles + rating.endurance + rating.resistance) / 7.0
      end desc,
      rider.id
    limit 1;

    if not found then exit; end if;

    insert into public.national_federation_selection_members (
      selection_list_id,
      professional_rider_id,
      owner_team_id,
      owner_director_id,
      response_status,
      responded_at
    ) values (
      v_list.id,
      v_candidate.rider_id,
      v_candidate.team_id,
      v_candidate.sporting_director_id,
      case when v_candidate.sporting_director_id is null
        then 'confirmed' else 'pending' end,
      case when v_candidate.sporting_director_id is null
        then p_now else null end
    );

    v_selected := v_selected + 1;
    v_added := v_added + 1;
  end loop;

  update public.national_federation_selection_lists
  set
    status = case when exists (
      select 1
      from public.national_federation_selection_members as member
      where member.selection_list_id = v_list.id
        and member.response_status = 'pending'
    ) then 'pending_confirmation' else 'finalized' end,
    created_by_director_id = null,
    published_at = coalesce(published_at, p_now),
    updated_at = case when v_added > 0 then p_now else updated_at end
  where id = v_list.id;

  insert into public.sporting_director_messages (
    sporting_director_id,
    season_id,
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
    member.owner_director_id,
    v_season.id,
    'international_selection',
    v_country.name || ' · Fédération',
    'Convocation internationale à confirmer',
    rider.first_name || ' ' || rider.last_name || ' est convoqué pour '
      || public.federation_selection_slot_label(v_slot.slot_key, v_slot.label, v_season.game_year) || '.',
    'La fédération propose ce coureur. Confirmez ou refusez avant la date limite ; sans réponse, il ne sera pas mobilisé.',
    '/jeu/selections-internationales',
    'Répondre à la convocation',
    'federation-auto-callup:' || member.id::text,
    true
  from public.national_federation_selection_members as member
  join public.riders as rider on rider.id = member.professional_rider_id
  where member.selection_list_id = v_list.id
    and member.owner_director_id is not null
    and member.response_status = 'pending'
  on conflict (sporting_director_id, source_reference) do nothing;

  if v_added > 0 then
    insert into public.national_federation_journal_entries (
      country_id,
      season_id,
      day_number,
      category,
      title,
      detail,
      source_reference
    ) values (
      v_list.country_id,
      v_season.id,
      v_season.current_day_number,
      'selection',
      'Convocation de remplacement envoyée',
      public.federation_selection_slot_label(v_slot.slot_key, v_slot.label, v_season.game_year) || ' · ' || v_added::text
        || ' remplaçant(s) convoqué(s).',
      'federation-targeted-refill:' || v_list.id::text || ':'
        || gen_random_uuid()::text
    );
  end if;

  return v_added;
end;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_professional_nations_cup(p_season_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '120s'
AS $function$
declare
  v_season public.seasons%rowtype;
  v_default_country_id uuid;
  v_host_country_id uuid;
  v_category_id uuid;
  v_day_id uuid;
  v_departure_at timestamptz;
  v_definition record;
  v_pool record;
  v_pool_key text;
  v_pool_label text;
  v_slug text;
  v_name text;
  v_short_name text;
  v_race_id uuid;
  v_edition_id uuid;
  v_stage_id uuid;
  v_created integer := 0;
begin
  select * into v_season
  from public.seasons as season
  where season.id = p_season_id;
  if v_season.id is null or v_season.game_year < 3 then return 0; end if;

  perform public.seed_nations_cup_assignments_for_season(v_season.id);

  select country.id into v_default_country_id
  from public.countries as country
  where country.iso_alpha2 = 'CH' and country.is_active = true;
  select award.country_id into v_host_country_id
  from public.national_federation_hosting_awards as award
  where award.target_game_year = v_season.game_year
    and award.event_type = case when v_season.game_year % 4 = 0 then 'quadrennial_games_pro' else 'nations_cup_pro' end
    and award.status in ('scheduled', 'settled')
  order by award.selected_at desc
  limit 1;
  v_host_country_id := coalesce(v_host_country_id, v_default_country_id);

  select category.id into v_category_id
  from public.race_categories as category
  where category.code = 'world' and category.is_active = true;
  select day.id,
    (day.calendar_date::timestamp + time '18:00') at time zone 'Europe/Paris'
  into v_day_id, v_departure_at
  from public.season_days as day
  where day.season_id = v_season.id and day.day_number = 24;
  if v_default_country_id is null or v_host_country_id is null
     or v_category_id is null or v_day_id is null then
    raise exception 'Impossible de préparer la Nations Cup professionnelle S%.',
      v_season.game_year;
  end if;

  for v_definition in
    select * from (values
      ('nc-mountain', 'nations-cup-montagne', 'Nations Cup · Montagne', 'NC Montagne', 'mountain', 'road', 50::numeric),
      ('nc-hills', 'nations-cup-vallons', 'Nations Cup · Vallons', 'NC Vallons', 'hilly', 'road', 55::numeric),
      ('nc-sprint', 'nations-cup-sprint', 'Nations Cup · Sprint', 'NC Sprint', 'sprint', 'road', 55::numeric),
      ('nc-cobbles', 'nations-cup-paves', 'Nations Cup · Pavés', 'NC Pavés', 'cobbles', 'road', 55::numeric),
      ('nc-time-trial', 'nations-cup-contre-la-montre', 'Nations Cup · Contre-la-montre', 'NC CLM', 'time_trial', 'individual_time_trial', 20::numeric)
    ) as definition(
      slot_key, base_slug, base_name, base_short_name,
      profile_type, stage_type, distance_km
    )
    where public.federation_selection_slot_is_available(definition.slot_key, v_season.game_year)
  loop
    if v_season.game_year % 4 = 0 then
      v_definition.base_name := 'Jeux quadriennaux · Course en ligne';
      v_definition.base_short_name := 'JQ Route';
      v_definition.profile_type := 'mixed';
      v_definition.distance_km := 194;
    end if;
    for v_pool in
      select assignment.division, assignment.group_code,
        count(*)::integer as field_limit
      from public.national_federation_nations_cup_assignments as assignment
      where assignment.season_id = v_season.id
      group by assignment.division, assignment.group_code
      order by assignment.division, assignment.group_code nulls first
    loop
      v_pool_key := 'd' || v_pool.division::text
        || case when v_pool.group_code is null then ''
          else '-' || lower(v_pool.group_code) end;
      v_pool_label := 'D' || v_pool.division::text
        || coalesce(v_pool.group_code, '');
      v_slug := v_definition.base_slug
        || case when v_pool.division = 1 then '' else '-' || v_pool_key end;
      v_name := v_definition.base_name
        || case when v_pool.division = 1 then '' else ' · ' || v_pool_label end;
      v_short_name := v_definition.base_short_name
        || case when v_pool.division = 1 then '' else ' ' || v_pool_label end;

      insert into public.races (
        country_id, name, short_name, race_format, status, slug,
        competition_type, championship_continent_code
      ) values (
        v_default_country_id, v_name, v_short_name,
        'one_day', 'active', v_slug, 'nations_cup', null
      )
      on conflict (slug) do update set
        name = case when v_season.game_year % 4 = 0 then public.races.name else excluded.name end,
        short_name = case when v_season.game_year % 4 = 0 then public.races.short_name else excluded.short_name end,
        race_format = excluded.race_format,
        status = excluded.status,
        competition_type = excluded.competition_type,
        championship_continent_code = null
      returning id into v_race_id;

      insert into public.race_editions (
        race_id, season_id, race_category_id, edition_number, display_name,
        status, registration_closes_at, withdrawal_closes_at,
        minimum_reputation, registration_policy, field_limit, host_country_id
      ) values (
        v_race_id, v_season.id, v_category_id, greatest(1, v_season.game_year),
        v_definition.base_name || ' · ' || v_pool_label,
        'registration_open', v_departure_at - interval '24 hours',
        v_departure_at - interval '24 hours', 0, 'closed',
        v_pool.field_limit, v_host_country_id
      )
      on conflict (race_id, season_id) do update set
        race_category_id = excluded.race_category_id,
        edition_number = excluded.edition_number,
        display_name = excluded.display_name,
        registration_closes_at = excluded.registration_closes_at,
        withdrawal_closes_at = excluded.withdrawal_closes_at,
        minimum_reputation = excluded.minimum_reputation,
        registration_policy = excluded.registration_policy,
        field_limit = excluded.field_limit,
        host_country_id = excluded.host_country_id
      returning id into v_edition_id;

      insert into public.national_federation_nations_cup_heats (
        season_id, slot_key, pool_key, division, group_code,
        race_id, race_edition_id
      ) values (
        v_season.id, v_definition.slot_key, v_pool_key,
        v_pool.division, v_pool.group_code, v_race_id, v_edition_id
      )
      on conflict (season_id, slot_key, pool_key) do update set
        division = excluded.division,
        group_code = excluded.group_code,
        race_id = excluded.race_id,
        race_edition_id = excluded.race_edition_id;

      v_stage_id := null;
      insert into public.stages as target (
        race_edition_id, season_day_id, stage_number, name, stage_type,
        distance_km, status, departure_at, profile_type, day_slot
      ) values (
        v_edition_id, v_day_id, 1,
        v_definition.base_name || ' · ' || v_pool_label,
        v_definition.stage_type, v_definition.distance_km,
        'planned', v_departure_at, v_definition.profile_type, 'late'
      )
      on conflict (race_edition_id, stage_number) do update set
        season_day_id = excluded.season_day_id,
        name = excluded.name,
        stage_type = excluded.stage_type,
        distance_km = excluded.distance_km,
        departure_at = excluded.departure_at,
        profile_type = excluded.profile_type,
        day_slot = excluded.day_slot
      where target.status = 'planned'
      returning id into v_stage_id;

      if v_stage_id is not null then
        delete from public.stage_segments where stage_id = v_stage_id;
        insert into public.stage_segments (
          stage_id, segment_number, distance_km, terrain_type,
          surface_type, average_gradient_pct
        )
        select v_stage_id, profile.segment_number, profile.distance_km,
          profile.terrain_type, profile.surface_type,
          profile.average_gradient_pct
        from public.get_federation_professional_event_profile_segments(
          v_definition.slot_key, v_season.game_year
        ) as profile;
      end if;
      v_created := v_created + 1;
    end loop;
  end loop;
  return v_created;
end;
$function$;

CREATE OR REPLACE FUNCTION public.seed_nations_cup_assignments_for_season(p_target_season_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '30s'
AS $function$
declare
  v_target public.seasons%rowtype;
  v_source public.seasons%rowtype;
  v_expected_events integer := 0;
  v_completed_events integer := 0;
  v_inserted integer := 0;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'nations-cup-assignment:' || p_target_season_id::text,
      0
    )
  );

  select season.* into v_target
  from public.seasons as season
  where season.id = p_target_season_id;
  if v_target.id is null or v_target.game_year < 3 then return 0; end if;

  select season.* into v_source
  from public.seasons as season
  where season.game_year = v_target.game_year - 1
  limit 1;

  if v_source.id is not null then
    select
      count(distinct edition.id)::integer,
      count(distinct edition.id) filter (
        where edition.status = 'completed'
      )::integer
    into v_expected_events, v_completed_events
    from public.races as race
    join public.race_editions as edition
      on edition.race_id = race.id
     and edition.season_id = v_source.id
    where race.competition_type = 'nations_cup'
      and race.status = 'active'
      and edition.status <> 'cancelled';
  end if;


  if v_target.status = 'planned' and v_target.game_year >= 4
    and (v_source.id is null or v_expected_events < (case when v_source.game_year % 4 = 0 then 1 else 5 end) or v_completed_events <> v_expected_events) then
    return 0; -- Never freeze a future fallback before its source Cup finishes.
  end if;

  -- Season opening creates several federation accounts in the same batch.
  -- Once every active nation is frozen, subsequent account triggers can reuse
  -- the assignment without recalculating the complete standings each time.
  if not exists (select 1 from public.national_federation_nations_cup_assignments p
    where p.season_id = v_target.id and v_target.game_year >= 4
      and p.movement = 'initial' and p.source_season_id is null)
    and not exists (
    select 1
    from public.countries as country
    where country.is_active = true
      and not exists (
        select 1
        from public.national_federation_nations_cup_assignments as assignment
        where assignment.country_id = country.id
          and assignment.season_id = v_target.id
      )
  ) then
    update public.national_federation_accounts as account
    set nations_cup_division = assignment.division
    from public.national_federation_nations_cup_assignments as assignment
    where assignment.season_id = v_target.id
      and account.season_id = assignment.season_id
      and account.country_id = assignment.country_id
      and account.nations_cup_division is distinct from assignment.division;
    return 0;
  end if;

  if v_source.id is not null
     and v_target.game_year >= 4
     and v_expected_events >= (case when v_source.game_year % 4 = 0 then 1 else 5 end)
     and v_completed_events = v_expected_events then
    with projected as (
      select projection.*
      from public.get_national_federation_nations_cup_movement_projection(
        v_source.id
      ) as projection
    ), seeded as (
      select
        projected.*,
        row_number() over (
          partition by projected.projected_division
          order by projected.overall_rank, projected.uci_rank,
            projected.country_id
        )::integer as division_seed
      from projected
    )
    insert into public.national_federation_nations_cup_assignments (
      country_id, season_id, division, group_code, source_season_id,
      source_division, movement, source_overall_rank
    )
    select
      seeded.country_id,
      v_target.id,
      seeded.projected_division,
      public.get_nations_cup_group_code_for_seed(
        seeded.division_seed,
        seeded.projected_division
      ),
      v_source.id,
      seeded.division,
      case seeded.movement_zone
        when 'promotion' then 'promoted'
        when 'relegation' then 'relegated'
        else 'held'
      end,
      seeded.overall_rank
    from seeded
    on conflict (country_id, season_id) do update set
      division=excluded.division, group_code=excluded.group_code,
      source_season_id=excluded.source_season_id, source_division=excluded.source_division,
      movement=excluded.movement, source_overall_rank=excluded.source_overall_rank
    where v_target.game_year >= 4
      and national_federation_nations_cup_assignments.movement='initial'
      and national_federation_nations_cup_assignments.source_season_id is null;
    get diagnostics v_inserted = row_count;
  elsif v_source.id is not null and v_target.game_year >= 4 then
    -- A forced rollover with an incomplete Nations Cup never invents moves.
    insert into public.national_federation_nations_cup_assignments (
      country_id, season_id, division, group_code, source_season_id,
      source_division, movement, source_overall_rank
    )
    select
      standing.country_id,
      v_target.id,
      standing.division,
      standing.group_code,
      v_source.id,
      standing.division,
      'held',
      standing.overall_rank
    from public.get_national_federation_nations_cup_standings(
      v_source.id
    ) as standing
    on conflict (country_id, season_id) do update set
      division=excluded.division, group_code=excluded.group_code,
      source_season_id=excluded.source_season_id, source_division=excluded.source_division,
      movement=excluded.movement, source_overall_rank=excluded.source_overall_rank
    where v_target.game_year >= 4
      and national_federation_nations_cup_assignments.movement='initial'
      and national_federation_nations_cup_assignments.source_season_id is null;
    get diagnostics v_inserted = row_count;
  else
    insert into public.national_federation_nations_cup_assignments (
      country_id, season_id, division, group_code, movement,
      source_overall_rank
    )
    select
      standing.country_id,
      v_target.id,
      standing.division,
      standing.group_code,
      'initial',
      standing.overall_rank
    from public.get_national_federation_nations_cup_standings(
      v_target.id
    ) as standing
    on conflict (country_id, season_id) do update set
      division=excluded.division, group_code=excluded.group_code,
      source_season_id=excluded.source_season_id, source_division=excluded.source_division,
      movement=excluded.movement, source_overall_rank=excluded.source_overall_rank
    where v_target.game_year >= 4
      and national_federation_nations_cup_assignments.movement='initial'
      and national_federation_nations_cup_assignments.source_season_id is null;
    get diagnostics v_inserted = row_count;
  end if;

  update public.national_federation_accounts as account
  set nations_cup_division = assignment.division
  from public.national_federation_nations_cup_assignments as assignment
  where assignment.season_id = v_target.id
    and account.season_id = assignment.season_id
    and account.country_id = assignment.country_id
    and account.nations_cup_division is distinct from assignment.division;

  return v_inserted;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_national_federation_nations_cup_standings(p_season_id uuid)
 RETURNS TABLE(country_id uuid, country_code text, country_name text, uci_rank integer, division integer, group_code text, points integer, wins integer, podiums integer, events_count integer, overall_rank integer, division_rank integer, group_rank integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '30s'
AS $function$
  with season_context as (
    select season.game_year
    from public.seasons as season
    where season.id = p_season_id
  ), ranked_uci as (
    select ranked.country_id, ranked.rank
    from (
      select country_points.country_id,
        row_number() over (
          order by country_points.points desc, country_points.country_id
        )::integer as rank
      from (
        select ranking.country_id, sum(ranking.uci_points)::bigint as points
        from public.get_national_championship_country_rankings(p_season_id) as ranking
        group by ranking.country_id
      ) as country_points
    ) as ranked
  ), assignments as (
    select
      country.id as country_id,
      country.iso_alpha2::text as country_code,
      country.name::text as country_name,
      coalesce(account.uci_rank, ranked_uci.rank, 173)::integer as uci_rank,
      coalesce(
        frozen.division,
        account.nations_cup_division,
        case
          when coalesce(ranked_uci.rank, 173) <= 20 then 1
          when coalesce(ranked_uci.rank, 173) <= 60 then 2
          when coalesce(ranked_uci.rank, 173) <= 100 then 3
          else 4
        end
      )::integer as division,
      frozen.group_code as frozen_group_code
    from public.countries as country
    cross join season_context
    left join ranked_uci on ranked_uci.country_id = country.id
    left join public.national_federation_accounts as account
      on account.country_id = country.id
     and account.season_id = p_season_id
    left join public.national_federation_nations_cup_assignments as frozen
      on frozen.country_id = country.id
     and frozen.season_id = p_season_id
    where country.is_active = true
  ), scored_results as (
    select
      rider.country_id,
      count(*)::integer as events_count,
      count(*) filter (where result.final_rank = 1)::integer as wins,
      count(*) filter (where result.final_rank <= 3)::integer as podiums,
      coalesce(sum(case result.final_rank
        when 1 then 50 when 2 then 40 when 3 then 32 when 4 then 26
        when 5 then 22 when 6 then 18 when 7 then 15 when 8 then 12
        when 9 then 10 when 10 then 8 when 11 then 6 when 12 then 5
        when 13 then 4 when 14 then 3 when 15 then 2 when 16 then 1
        else 0 end), 0)::integer as points,
      sum(result.final_rank)::integer as rank_sum
    from public.race_results as result
    join public.race_editions as edition
      on edition.id = result.race_edition_id
     and edition.season_id = p_season_id
    join public.races as race
      on race.id = edition.race_id
     and race.competition_type = 'nations_cup'
    join public.race_rosters as roster on roster.id = result.race_roster_id
    join public.riders as rider on rider.id = roster.rider_id
    where result.status = 'classified'
    group by rider.country_id
  ), scored as (
    select
      assignments.country_id,
      assignments.country_code,
      assignments.country_name,
      assignments.uci_rank,
      assignments.division,
      coalesce(
        assignments.frozen_group_code,
        public.get_nations_cup_group_code(
          assignments.uci_rank,
          assignments.division
        )
      ) as group_code,
      coalesce(scored_results.points, 0)::integer as points,
      coalesce(scored_results.wins, 0)::integer as wins,
      coalesce(scored_results.podiums, 0)::integer as podiums,
      coalesce(scored_results.events_count, 0)::integer as events_count,
      coalesce(scored_results.rank_sum, 9999)::integer as rank_sum
    from assignments
    left join scored_results on scored_results.country_id = assignments.country_id
  )
  select
    scored.country_id,
    scored.country_code,
    scored.country_name,
    scored.uci_rank,
    scored.division,
    scored.group_code,
    scored.points,
    scored.wins,
    scored.podiums,
    scored.events_count,
    row_number() over (
      order by scored.points desc, scored.wins desc, scored.podiums desc,
        scored.rank_sum, scored.uci_rank, scored.country_id
    )::integer as overall_rank,
    row_number() over (
      partition by scored.division
      order by scored.points desc, scored.wins desc, scored.podiums desc,
        scored.rank_sum, scored.uci_rank, scored.country_id
    )::integer as division_rank,
    row_number() over (
      partition by scored.division, scored.group_code
      order by scored.points desc, scored.wins desc, scored.podiums desc,
        scored.rank_sum, scored.uci_rank, scored.country_id
    )::integer as group_rank
  from scored
$function$;
