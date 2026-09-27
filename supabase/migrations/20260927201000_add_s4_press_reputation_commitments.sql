begin;

alter table public.pre_race_press_conferences
  add column if not exists reputation_commitment_id uuid
    references public.reputation_commitments(id) on delete set null,
  add column if not exists commitment_amount integer not null default 0,
  add column if not exists sponsor_bonus smallint not null default 0;

alter table public.pre_race_press_conferences
  add constraint pre_race_press_commitment_amount_allowed
    check (commitment_amount in (0, 15, 35, 60)),
  add constraint pre_race_press_sponsor_bonus_allowed
    check (sponsor_bonus between 0 and 4);

drop function if exists public.submit_current_team_pre_race_press_conference(uuid, uuid, text, text, text);
create function public.submit_current_team_pre_race_press_conference(
  p_race_edition_id uuid,
  p_leader_rider_id uuid,
  p_ambition text,
  p_race_intent text,
  p_public_statement text,
  p_commitment_amount integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_conference_id uuid := gen_random_uuid();
  v_commitment_id uuid;
  v_sponsor_bonus smallint := case p_commitment_amount
    when 15 then 1 when 35 then 2 when 60 then 4 else 0 end;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Vous devez être connecté.';
  end if;
  if p_ambition not in ('victory', 'podium', 'top_10', 'visibility') then
    raise exception 'Objectif de conférence invalide.';
  end if;
  if p_race_intent not in ('control', 'attack', 'sprint', 'development') then
    raise exception 'Intention de course invalide.';
  end if;
  if coalesce(p_commitment_amount, 0) not in (0, 15, 35, 60) then
    raise exception 'Niveau d’engagement de réputation invalide.';
  end if;
  if char_length(btrim(coalesce(p_public_statement, ''))) not between 10 and 500 then
    raise exception 'La déclaration doit contenir entre 10 et 500 caractères.';
  end if;

  select
    edition.id as race_edition_id, edition.season_id,
    season.game_year, edition.display_name as race_name,
    edition.status as edition_status, team_season.id as team_season_id,
    team_season.team_id, team_season.display_name as team_name,
    director.id as sporting_director_id,
    director.display_name as director_name,
    director.reputation_points, registration.id as registration_id,
    category.minimum_roster_size
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.race_editions as edition on edition.id = p_race_edition_id
  join public.seasons as season on season.id = edition.season_id
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = edition.season_id
  join public.race_registrations as registration
    on registration.race_edition_id = edition.id
   and registration.team_season_id = team_season.id
   and registration.status = 'accepted'
  join public.race_categories as category on category.id = edition.race_category_id
  where director.auth_user_id = auth.uid() and director.status = 'active'
  limit 1;

  if not found then
    raise exception 'La conférence est disponible après validation de la startlist.';
  end if;
  if v_context.edition_status in ('in_progress', 'completed', 'cancelled') then
    raise exception 'La conférence d’avant-course est désormais fermée.';
  end if;
  if (
    select count(*) from public.race_rosters as roster
    where roster.race_registration_id = v_context.registration_id
      and roster.status in ('selected', 'confirmed')
  ) < v_context.minimum_roster_size then
    raise exception 'La startlist doit être complète avant la conférence.';
  end if;
  if not exists (
    select 1 from public.race_rosters as roster
    where roster.race_registration_id = v_context.registration_id
      and roster.rider_id = p_leader_rider_id
      and roster.status in ('selected', 'confirmed')
  ) then
    raise exception 'Le leader annoncé doit appartenir à la startlist validée.';
  end if;
  if p_commitment_amount > 0 and v_context.game_year < 4 then
    raise exception 'Le renforcement de l’engagement ouvre en saison 4.';
  end if;
  if p_commitment_amount > 0 and v_context.reputation_points < 400 then
    raise exception 'Le renforcement de l’engagement exige 400 points de réputation.';
  end if;

  insert into public.pre_race_press_conferences (
    id, race_edition_id, season_id, team_season_id, team_id,
    sporting_director_id, leader_rider_id, race_name, team_name,
    director_name, leader_name, ambition, race_intent, public_statement,
    commitment_amount, sponsor_bonus
  )
  select
    v_conference_id, v_context.race_edition_id, v_context.season_id,
    v_context.team_season_id, v_context.team_id,
    v_context.sporting_director_id, rider.id, v_context.race_name,
    v_context.team_name, v_context.director_name,
    btrim(rider.first_name || ' ' || rider.last_name),
    p_ambition, p_race_intent, btrim(p_public_statement),
    p_commitment_amount, v_sponsor_bonus
  from public.riders as rider
  where rider.id = p_leader_rider_id
  on conflict (race_edition_id, team_id) do nothing;

  if not found then raise exception 'Votre conférence d’avant-course a déjà été publiée.'; end if;

  if p_commitment_amount > 0 then
    v_commitment_id := private.create_reputation_commitment(
      v_context.sporting_director_id, v_context.season_id, v_context.team_id,
      'pre_race_press', v_conference_id, p_commitment_amount,
      jsonb_build_object('raceEditionId', p_race_edition_id, 'ambition', p_ambition)
    );
    update public.pre_race_press_conferences
    set reputation_commitment_id = v_commitment_id
    where id = v_conference_id;
  end if;

  return v_conference_id;
end;
$$;

revoke all on function public.submit_current_team_pre_race_press_conference(uuid, uuid, text, text, text, integer)
  from public, anon;
grant execute on function public.submit_current_team_pre_race_press_conference(uuid, uuid, text, text, text, integer)
  to authenticated;

drop function if exists public.get_pre_race_press_conferences(uuid);
create function public.get_pre_race_press_conferences(p_race_edition_id uuid)
returns table (
  conference_id uuid, team_name text, director_name text,
  leader_rider_id uuid, leader_name text, ambition text, race_intent text,
  public_statement text, status text, target_met boolean,
  leader_final_rank integer, reputation_delta integer,
  commitment_amount integer, sponsor_bonus smallint,
  submitted_at timestamptz, is_own boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    conference.id, conference.team_name, conference.director_name,
    conference.leader_rider_id, conference.leader_name, conference.ambition,
    conference.race_intent, conference.public_statement, conference.status,
    conference.target_met, conference.leader_final_rank,
    conference.reputation_delta, conference.commitment_amount,
    conference.sponsor_bonus, conference.submitted_at,
    director.auth_user_id = auth.uid()
  from public.pre_race_press_conferences as conference
  join public.sporting_directors as director
    on director.id = conference.sporting_director_id
  where auth.uid() is not null
    and conference.race_edition_id = p_race_edition_id
    and conference.status <> 'cancelled'
  order by conference.submitted_at, conference.team_name;
$$;
revoke all on function public.get_pre_race_press_conferences(uuid) from public, anon;
grant execute on function public.get_pre_race_press_conferences(uuid) to authenticated;

alter table public.sponsor_satisfaction_events
  drop constraint if exists sponsor_satisfaction_events_type_allowed;
alter table public.sponsor_satisfaction_events
  add constraint sponsor_satisfaction_events_type_allowed
    check (event_type in ('race_result', 'uci_ranking', 'pre_race_commitment'));

create or replace function public.get_sponsor_performance_satisfaction_score(
  p_contract_id uuid
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select (
    least(25, coalesce(sum(event.points) filter (
      where event.event_type in ('race_result', 'uci_ranking')
    ), 0))
    + least(8, coalesce(sum(event.points) filter (
      where event.event_type = 'pre_race_commitment'
    ), 0))
  )::integer
  from public.sponsor_satisfaction_events as event
  where event.team_sponsor_contract_id = p_contract_id;
$$;

create or replace function public.synchronize_s3_sponsor_satisfaction_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_game_year integer;
  v_objective_score integer;
  v_performance_score integer;
begin
  if new.role <> 'principal' or new.sponsor_offer_id is null then return new; end if;
  select season.game_year into v_active_game_year
  from public.seasons as season where season.status = 'active'
  order by season.game_year desc limit 1;
  if coalesce(v_active_game_year, 0) < 3 then return new; end if;
  v_objective_score := public.get_sponsor_objective_satisfaction_score(new.id);
  v_performance_score := public.get_sponsor_performance_satisfaction_score(new.id);
  new.satisfaction_score := least(
    100, coalesce(v_objective_score, 0) + coalesce(v_performance_score, 0)
  );
  new.satisfaction_updated_at := now();
  return new;
end;
$$;

create or replace function private.settle_pre_race_press_conferences(
  p_race_edition_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conference record;
  v_rank integer;
  v_target_met boolean;
  v_requested_delta integer;
  v_regular_delta numeric;
  v_commitment_delta numeric;
  v_contract_id uuid;
  v_settled integer := 0;
begin
  for v_conference in
    select conference.*
    from public.pre_race_press_conferences as conference
    where conference.race_edition_id = p_race_edition_id
      and conference.status = 'published'
    for update
  loop
    select result.final_rank into v_rank
    from public.race_results as result
    join public.race_rosters as roster on roster.id = result.race_roster_id
    where result.race_edition_id = p_race_edition_id
      and roster.rider_id = v_conference.leader_rider_id
      and result.status = 'classified'
    limit 1;

    v_target_met := case v_conference.ambition
      when 'victory' then coalesce(v_rank = 1, false)
      when 'podium' then coalesce(v_rank <= 3, false)
      when 'top_10' then coalesce(v_rank <= 10, false)
      else coalesce(v_rank <= 20, false)
    end;
    v_requested_delta := case v_conference.ambition
      when 'victory' then case when v_target_met then 8 else -4 end
      when 'podium' then case when v_target_met then 5 else -3 end
      when 'top_10' then case when v_target_met then 3 else -2 end
      else case when v_target_met then 2 else -1 end
    end;

    v_regular_delta := private.apply_reputation_delta(
      v_conference.sporting_director_id, v_conference.season_id,
      v_requested_delta, 'pre_race_press',
      'pre-race-press-result:' || v_conference.id,
      case when v_target_met
        then 'Objectif médiatique atteint sur ' || v_conference.race_name
        else 'Objectif médiatique manqué sur ' || v_conference.race_name end,
      jsonb_build_object('raceEditionId', p_race_edition_id)
    );
    v_commitment_delta := 0;
    if v_conference.reputation_commitment_id is not null then
      v_commitment_delta := private.settle_reputation_commitment(
        v_conference.reputation_commitment_id,
        case when v_target_met then 'achieved' else 'failed' end,
        case when v_target_met then 0 else 1 end
      );
    end if;

    if v_target_met and v_conference.sponsor_bonus > 0 then
      select contract.id into v_contract_id
      from public.team_sponsor_contracts as contract
      join public.seasons as start_season on start_season.id = contract.start_season_id
      join public.seasons as race_season on race_season.id = v_conference.season_id
      where contract.team_id = v_conference.team_id
        and contract.role = 'principal' and contract.status = 'active'
        and start_season.game_year <= race_season.game_year
        and start_season.game_year + contract.contract_duration_seasons - 1 >= race_season.game_year
      order by contract.created_at desc limit 1;

      if v_contract_id is not null then
        insert into public.sponsor_satisfaction_events (
          team_sponsor_contract_id, season_id, event_type, source_key,
          race_edition_id, rider_id, points, title, description, metadata
        ) values (
          v_contract_id, v_conference.season_id, 'pre_race_commitment',
          'pre-race-commitment:' || v_conference.id, p_race_edition_id,
          v_conference.leader_rider_id, v_conference.sponsor_bonus,
          'Engagement public tenu',
          'La promesse renforcée sur ' || v_conference.race_name || ' a été tenue.',
          jsonb_build_object('conferenceId', v_conference.id)
        ) on conflict (team_sponsor_contract_id, source_key) do nothing;
      end if;
    end if;

    update public.pre_race_press_conferences
    set status = 'settled', target_met = v_target_met,
        leader_final_rank = v_rank,
        reputation_delta = round(v_regular_delta + v_commitment_delta)::integer,
        settled_at = now()
    where id = v_conference.id;
    v_settled := v_settled + 1;
  end loop;
  return v_settled;
end;
$$;

create or replace function private.settle_pre_race_press_after_race_completion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conference record;
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    perform private.settle_pre_race_press_conferences(new.id);
  elsif new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    for v_conference in
      select * from public.pre_race_press_conferences
      where race_edition_id = new.id and status = 'published'
      for update
    loop
      if v_conference.reputation_commitment_id is not null then
        perform private.settle_reputation_commitment(
          v_conference.reputation_commitment_id, 'cancelled', 0
        );
      end if;
      update public.pre_race_press_conferences
      set status = 'cancelled', settled_at = now()
      where id = v_conference.id;
    end loop;
  end if;
  return new;
end;
$$;

commit;
