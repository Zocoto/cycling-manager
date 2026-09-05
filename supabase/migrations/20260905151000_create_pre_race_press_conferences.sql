begin;

alter table public.reward_events
  drop constraint if exists reward_events_source_type_allowed;
alter table public.reward_events
  add constraint reward_events_source_type_allowed check (
    source_type in (
      'race_result', 'stage_result', 'mountain_prime',
      'intermediate_sprint', 'secondary_classification',
      'game_objective', 'sponsor_objective', 'division_bonus',
      'special_ability', 'staff_daily', 'mixed_zone_event',
      'gazette_game', 'pre_race_press'
    )
  );

create table public.pre_race_press_conferences (
  id uuid primary key default gen_random_uuid(),
  race_edition_id uuid not null references public.race_editions(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  team_season_id uuid not null references public.team_seasons(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  sporting_director_id uuid not null references public.sporting_directors(id) on delete cascade,
  leader_rider_id uuid not null references public.riders(id) on delete restrict,
  race_name text not null,
  team_name text not null,
  director_name text not null,
  leader_name text not null,
  ambition text not null,
  race_intent text not null,
  public_statement text not null,
  status text not null default 'published',
  target_met boolean,
  leader_final_rank integer,
  reputation_delta integer,
  submitted_at timestamptz not null default now(),
  settled_at timestamptz,
  constraint pre_race_press_conferences_ambition_allowed
    check (ambition in ('victory', 'podium', 'top_10', 'visibility')),
  constraint pre_race_press_conferences_intent_allowed
    check (race_intent in ('control', 'attack', 'sprint', 'development')),
  constraint pre_race_press_conferences_statement_length
    check (char_length(btrim(public_statement)) between 10 and 500),
  constraint pre_race_press_conferences_status_allowed
    check (status in ('published', 'settled', 'cancelled')),
  constraint pre_race_press_conferences_rank_valid
    check (leader_final_rank is null or leader_final_rank > 0),
  constraint pre_race_press_conferences_resolution_valid
    check (
      (status = 'published' and target_met is null and reputation_delta is null and settled_at is null)
      or (status = 'settled' and target_met is not null and reputation_delta is not null and settled_at is not null)
      or status = 'cancelled'
    ),
  unique (race_edition_id, team_id)
);

create index pre_race_press_conferences_edition_idx
  on public.pre_race_press_conferences (race_edition_id, submitted_at);
create index pre_race_press_conferences_team_idx
  on public.pre_race_press_conferences (team_id, submitted_at desc);

alter table public.pre_race_press_conferences enable row level security;

create policy pre_race_press_conferences_select_authenticated
  on public.pre_race_press_conferences
  for select to authenticated
  using (true);

grant select on public.pre_race_press_conferences to authenticated;
grant all privileges on public.pre_race_press_conferences to service_role;

create or replace function public.submit_current_team_pre_race_press_conference(
  p_race_edition_id uuid,
  p_leader_rider_id uuid,
  p_ambition text,
  p_race_intent text,
  p_public_statement text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_conference_id uuid;
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
  if char_length(btrim(coalesce(p_public_statement, ''))) not between 10 and 500 then
    raise exception 'La déclaration doit contenir entre 10 et 500 caractères.';
  end if;

  select
    edition.id as race_edition_id,
    edition.season_id,
    edition.display_name as race_name,
    edition.status as edition_status,
    team_season.id as team_season_id,
    team_season.team_id,
    team_season.display_name as team_name,
    director.id as sporting_director_id,
    director.display_name as director_name,
    registration.id as registration_id,
    category.minimum_roster_size
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.race_editions as edition
    on edition.id = p_race_edition_id
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = edition.season_id
  join public.race_registrations as registration
    on registration.race_edition_id = edition.id
   and registration.team_season_id = team_season.id
   and registration.status = 'accepted'
  join public.race_categories as category
    on category.id = edition.race_category_id
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if not found then
    raise exception 'La conférence est disponible après validation de la startlist.';
  end if;
  if v_context.edition_status in ('in_progress', 'completed', 'cancelled') then
    raise exception 'La conférence d’avant-course est désormais fermée.';
  end if;
  if (
    select count(*)
    from public.race_rosters as roster
    where roster.race_registration_id = v_context.registration_id
      and roster.status in ('selected', 'confirmed')
  ) < v_context.minimum_roster_size then
    raise exception 'La startlist doit être complète avant la conférence.';
  end if;
  if not exists (
    select 1
    from public.race_rosters as roster
    where roster.race_registration_id = v_context.registration_id
      and roster.rider_id = p_leader_rider_id
      and roster.status in ('selected', 'confirmed')
  ) then
    raise exception 'Le leader annoncé doit appartenir à la startlist validée.';
  end if;

  insert into public.pre_race_press_conferences (
    race_edition_id, season_id, team_season_id, team_id,
    sporting_director_id, leader_rider_id, race_name, team_name,
    director_name, leader_name, ambition, race_intent, public_statement
  )
  select
    v_context.race_edition_id, v_context.season_id, v_context.team_season_id,
    v_context.team_id, v_context.sporting_director_id, rider.id,
    v_context.race_name, v_context.team_name, v_context.director_name,
    btrim(rider.first_name || ' ' || rider.last_name),
    p_ambition, p_race_intent, btrim(p_public_statement)
  from public.riders as rider
  where rider.id = p_leader_rider_id
  on conflict (race_edition_id, team_id) do nothing
  returning id into v_conference_id;

  if v_conference_id is null then
    raise exception 'Votre conférence d’avant-course a déjà été publiée.';
  end if;

  return v_conference_id;
end;
$$;

revoke all on function public.submit_current_team_pre_race_press_conference(uuid, uuid, text, text, text)
  from public, anon;
grant execute on function public.submit_current_team_pre_race_press_conference(uuid, uuid, text, text, text)
  to authenticated;

create or replace function public.get_pre_race_press_conferences(
  p_race_edition_id uuid
)
returns table (
  conference_id uuid,
  team_name text,
  director_name text,
  leader_rider_id uuid,
  leader_name text,
  ambition text,
  race_intent text,
  public_statement text,
  status text,
  target_met boolean,
  leader_final_rank integer,
  reputation_delta integer,
  submitted_at timestamptz,
  is_own boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    conference.id,
    conference.team_name,
    conference.director_name,
    conference.leader_rider_id,
    conference.leader_name,
    conference.ambition,
    conference.race_intent,
    conference.public_statement,
    conference.status,
    conference.target_met,
    conference.leader_final_rank,
    conference.reputation_delta,
    conference.submitted_at,
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

create or replace function public.get_current_team_pending_press_conferences()
returns table (
  race_edition_id uuid,
  race_slug text,
  race_name text,
  start_day_number integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    edition.id,
    race.slug,
    edition.display_name,
    min(season_day.day_number)::integer
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.status = 'active'
  join public.race_registrations as registration
    on registration.team_season_id = team_season.id
   and registration.status = 'accepted'
  join public.race_editions as edition
    on edition.id = registration.race_edition_id
   and edition.season_id = team_season.season_id
   and edition.status not in ('in_progress', 'completed', 'cancelled')
  join public.races as race on race.id = edition.race_id
  join public.race_categories as category on category.id = edition.race_category_id
  join public.stages as stage on stage.race_edition_id = edition.id
  join public.season_days as season_day on season_day.id = stage.season_day_id
  where director.auth_user_id = auth.uid()
    and not exists (
      select 1
      from public.pre_race_press_conferences as conference
      where conference.race_edition_id = edition.id
        and conference.team_id = team_season.team_id
        and conference.status <> 'cancelled'
    )
    and (
      select count(*)
      from public.race_rosters as roster
      where roster.race_registration_id = registration.id
        and roster.status in ('selected', 'confirmed')
    ) >= category.minimum_roster_size
  group by edition.id, race.slug, edition.display_name
  order by min(season_day.day_number), edition.display_name;
$$;

revoke all on function public.get_current_team_pending_press_conferences() from public, anon;
grant execute on function public.get_current_team_pending_press_conferences() to authenticated;

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
  v_previous_reputation integer;
  v_applied_delta integer;
  v_settled integer := 0;
begin
  for v_conference in
    select conference.*
    from public.pre_race_press_conferences as conference
    where conference.race_edition_id = p_race_edition_id
      and conference.status = 'published'
    for update
  loop
    select result.final_rank
    into v_rank
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

    select reputation_points
    into v_previous_reputation
    from public.sporting_directors
    where id = v_conference.sporting_director_id
    for update;

    update public.sporting_directors
    set reputation_points = least(1000, greatest(0, reputation_points + v_requested_delta))
    where id = v_conference.sporting_director_id;

    v_applied_delta := least(1000, greatest(0, v_previous_reputation + v_requested_delta))
      - v_previous_reputation;

    insert into public.reward_events (
      source_reference, source_type, sporting_director_id, team_season_id,
      rider_id, reputation_points, description
    ) values (
      'pre-race-press:' || v_conference.id,
      'pre_race_press', v_conference.sporting_director_id,
      v_conference.team_season_id, v_conference.leader_rider_id,
      v_applied_delta,
      case when v_target_met
        then 'Objectif médiatique atteint sur ' || v_conference.race_name
        else 'Objectif médiatique manqué sur ' || v_conference.race_name
      end
    ) on conflict (source_reference) do nothing;

    update public.pre_race_press_conferences
    set status = 'settled', target_met = v_target_met,
        leader_final_rank = v_rank, reputation_delta = v_applied_delta,
        settled_at = now()
    where id = v_conference.id;

    v_settled := v_settled + 1;
  end loop;

  return v_settled;
end;
$$;

revoke all on function private.settle_pre_race_press_conferences(uuid)
  from public, anon, authenticated;
grant execute on function private.settle_pre_race_press_conferences(uuid) to service_role;

create or replace function private.settle_pre_race_press_after_race_completion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    perform private.settle_pre_race_press_conferences(new.id);
  elsif new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update public.pre_race_press_conferences
    set status = 'cancelled', settled_at = now()
    where race_edition_id = new.id and status = 'published';
  end if;
  return new;
end;
$$;

revoke all on function private.settle_pre_race_press_after_race_completion()
  from public, anon, authenticated;

create trigger settle_pre_race_press_after_race_completion
after update of status on public.race_editions
for each row execute function private.settle_pre_race_press_after_race_completion();

commit;
