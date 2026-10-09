begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

-- The original initializer only ran at S3 J1. Resolve the current mandate
-- instead, both on affiliation and in the existing maintenance catch-up.
create or replace function private.ensure_federation_presidency(
  p_country_id uuid, p_season_id uuid
)
returns text
language plpgsql security definer set search_path = ''
set statement_timeout = '15s'
as $$
declare
  v_season public.seasons%rowtype;
  v_country public.countries%rowtype;
  v_term public.national_federation_terms%rowtype;
  v_solo record;
  v_player_count integer;
  v_start_year integer;
begin
  select * into v_season from public.seasons
  where id = p_season_id and status = 'active';
  select * into v_country from public.countries
  where id = p_country_id and is_active;
  if v_season.id is null or v_season.game_year < 3 or v_country.id is null then
    return 'unchanged';
  end if;

  -- Keep the term -> exceptional-election lock order used by the nationality
  -- guard. Re-read after the advisory lock when a term did not yet exist.
  select * into v_term from public.national_federation_terms
  where country_id = p_country_id
    and v_season.game_year between start_game_year and end_game_year
  order by start_game_year desc limit 1 for update;
  if v_term.president_director_id is not null then return 'unchanged'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_country_id::text || ':exceptional-election', 0)
  );
  select * into v_term from public.national_federation_terms
  where country_id = p_country_id
    and v_season.game_year between start_game_year and end_game_year
  order by start_game_year desc limit 1 for update;
  if v_term.president_director_id is not null then return 'unchanged'; end if;

  -- Never bypass an ongoing vote, or touch the next mandate's regular election.
  if exists (
    select 1 from public.national_federation_elections
    where country_id = p_country_id and status in ('applications', 'voting')
      and v_season.game_year between term_start_game_year and term_end_game_year
  ) then return 'unchanged'; end if;

  select count(distinct assignment.sporting_director_id)::integer
  into v_player_count
  from public.team_seasons as team_season
  join public.teams as team on team.id = team_season.team_id and team.status = 'active'
  join public.team_manager_assignments as assignment
    on assignment.team_id = team.id and assignment.role = 'general_manager'
    and assignment.status = 'active'
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id and director.status = 'active'
    and director.auth_user_id is not null
  where team_season.season_id = v_season.id
    and team_season.registration_country_id = p_country_id
    and team_season.status in ('planned', 'active');
  if v_player_count = 0 then return 'unchanged'; end if;

  if v_term.id is null then
    v_start_year := v_season.game_year - case when mod(v_season.game_year, 2) = 0 then 1 else 0 end;
    insert into public.national_federation_terms (
      country_id, start_game_year, end_game_year, governance_mode
    ) values (p_country_id, v_start_year, v_start_year + 1, 'automatic')
    on conflict (country_id, start_game_year) do nothing;
    select * into v_term from public.national_federation_terms
    where country_id = p_country_id and start_game_year = v_start_year for update;
  end if;

  if v_player_count > 1 then
    -- Do not restart a completed, unsuccessful exceptional election on every
    -- maintenance run. A later vacancy is handled by the nationality guard.
    if exists (
      select 1 from public.national_federation_elections
      where country_id = p_country_id and election_type = 'exceptional'
        and term_start_game_year = v_term.start_game_year
    ) then return 'unchanged'; end if;
    if public.open_exceptional_federation_election(p_country_id, v_term.id, v_season.id) is not null then
      return 'exceptional';
    end if;
    return 'unchanged';
  end if;

  select team_season.id as team_season_id, team.id as team_id, assignment.sporting_director_id
  into v_solo
  from public.team_seasons as team_season
  join public.teams as team on team.id = team_season.team_id and team.status = 'active'
  join public.team_manager_assignments as assignment
    on assignment.team_id = team.id and assignment.role = 'general_manager'
    and assignment.status = 'active'
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id and director.status = 'active'
    and director.auth_user_id is not null
  where team_season.season_id = v_season.id
    and team_season.registration_country_id = p_country_id
    and team_season.status in ('planned', 'active')
  order by assignment.created_at, assignment.id limit 1;

  -- 'elected' is the existing human-governance permission mode. The journal
  -- records the automatic nomination; historical ballots are not rewritten.
  update public.national_federation_terms
  set governance_mode = 'elected', president_director_id = v_solo.sporting_director_id
  where id = v_term.id and president_director_id is null;

  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail, source_reference, metadata
  ) values (
    p_country_id, v_season.id, v_season.current_day_number, 'governance',
    'Présidence attribuée automatiquement',
    format('La fédération ne compte qu’un seul DS actif : il devient président jusqu’à la fin de la Saison %s.', v_term.end_game_year),
    'federation-term:' || v_term.id::text || ':sole-member:' || v_solo.sporting_director_id::text,
    jsonb_build_object('presidentDirectorId', v_solo.sporting_director_id, 'teamId', v_solo.team_id,
      'playerCount', 1, 'appointmentType', 'sole-member')
  ) on conflict (source_reference) do nothing;
  insert into public.sporting_director_messages (
    sporting_director_id, season_id, team_season_id, message_type, sender_name,
    subject, preview, body, action_href, action_label, source_reference, is_important
  ) values (
    v_solo.sporting_director_id, v_season.id, v_solo.team_season_id, 'system',
    'Fédération de ' || v_country.name, 'Vous devenez président de votre fédération',
    'Vous êtes l’unique DS actif affilié : la présidence vous est attribuée automatiquement.',
    format('Vous prenez immédiatement vos fonctions jusqu’à la fin de la Saison %s. Vous pouvez piloter les sélections, le budget et les projets fédéraux.', v_term.end_game_year),
    '/jeu/federations/' || lower(v_country.iso_alpha2) || '?onglet=governance', 'Ouvrir la fédération',
    'federation-term:' || v_term.id::text || ':sole-member-message:' || v_solo.sporting_director_id::text, true
  ) on conflict (sporting_director_id, source_reference) do nothing;
  return 'automatic';
end;
$$;
revoke all on function private.ensure_federation_presidency(uuid, uuid) from public, anon, authenticated;
grant execute on function private.ensure_federation_presidency(uuid, uuid) to service_role;

create or replace function public.initialize_due_federation_presidencies()
returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '30s'
as $$
declare
  v_season public.seasons%rowtype;
  v_country_id uuid;
  v_result text;
  v_automatic integer := 0;
  v_exceptional integer := 0;
begin
  select * into v_season from public.seasons where status = 'active' limit 1;
  if v_season.id is null or v_season.game_year < 3 then
    return jsonb_build_object('automatic', 0, 'exceptional', 0);
  end if;
  for v_country_id in
    select distinct team_season.registration_country_id
    from public.team_seasons as team_season
    join public.teams as team on team.id = team_season.team_id and team.status = 'active'
    join public.team_manager_assignments as assignment
      on assignment.team_id = team.id and assignment.role = 'general_manager' and assignment.status = 'active'
    join public.sporting_directors as director
      on director.id = assignment.sporting_director_id and director.status = 'active' and director.auth_user_id is not null
    where team_season.season_id = v_season.id and team_season.status in ('planned', 'active')
      and not exists (
        select 1 from public.national_federation_terms as term
        where term.country_id = team_season.registration_country_id
          and v_season.game_year between term.start_game_year and term.end_game_year
          and term.president_director_id is not null
      )
    order by team_season.registration_country_id
  loop
    v_result := private.ensure_federation_presidency(v_country_id, v_season.id);
    if v_result = 'automatic' then v_automatic := v_automatic + 1; end if;
    if v_result = 'exceptional' then v_exceptional := v_exceptional + 1; end if;
  end loop;
  return jsonb_build_object('automatic', v_automatic, 'exceptional', v_exceptional);
end;
$$;
revoke all on function public.initialize_due_federation_presidencies() from public, anon, authenticated;
grant execute on function public.initialize_due_federation_presidencies() to service_role;
comment on function public.initialize_due_federation_presidencies() is
  'À toute saison et journée, attribue une présidence vacante au seul DS actif, ou ouvre un scrutin exceptionnel à plusieurs.';

create or replace function private.initialize_federation_presidency_on_affiliation()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_affiliation record;
begin
  if tg_table_name = 'team_seasons' then
    perform private.ensure_federation_presidency(new.registration_country_id, new.season_id);
  else
    for v_affiliation in
      select registration_country_id, season_id from public.team_seasons
      where team_id = new.team_id and status in ('planned', 'active')
    loop
      perform private.ensure_federation_presidency(v_affiliation.registration_country_id, v_affiliation.season_id);
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function private.initialize_federation_presidency_on_affiliation() from public, anon, authenticated;

-- Deferred until COMMIT: onboarding order and a whole sponsor/season rollover
-- must finish before counting members. Budget/points updates do not queue work.
drop trigger if exists initialize_federation_presidency_on_team_season_insert on public.team_seasons;
create constraint trigger initialize_federation_presidency_on_team_season_insert
after insert on public.team_seasons deferrable initially deferred
for each row execute function private.initialize_federation_presidency_on_affiliation();
drop trigger if exists initialize_federation_presidency_on_team_season_update on public.team_seasons;
create constraint trigger initialize_federation_presidency_on_team_season_update
after update on public.team_seasons deferrable initially deferred
for each row when (
  old.registration_country_id is distinct from new.registration_country_id
  or old.season_id is distinct from new.season_id or old.status is distinct from new.status
) execute function private.initialize_federation_presidency_on_affiliation();
drop trigger if exists initialize_federation_presidency_on_manager_insert on public.team_manager_assignments;
create constraint trigger initialize_federation_presidency_on_manager_insert
after insert on public.team_manager_assignments deferrable initially deferred
for each row execute function private.initialize_federation_presidency_on_affiliation();
drop trigger if exists initialize_federation_presidency_on_manager_update on public.team_manager_assignments;
create constraint trigger initialize_federation_presidency_on_manager_update
after update on public.team_manager_assignments deferrable initially deferred
for each row when (
  old.team_id is distinct from new.team_id or old.sporting_director_id is distinct from new.sporting_director_id
  or old.status is distinct from new.status or old.role is distinct from new.role
) execute function private.initialize_federation_presidency_on_affiliation();

-- Explicit one-off administration approved by the owner: Rwanda already has
-- two players. This is NOT a rule allowing a new arrival to take precedence.
do $appoint_rwanda$
declare
  v_season public.seasons%rowtype;
  v_term public.national_federation_terms%rowtype;
  v_team_season_id uuid;
  v_director_id constant uuid := '8406962e-41b9-4181-a372-3d57043de3a8';
begin
  select * into v_season from public.seasons where game_year = 4 and status = 'active';
  if v_season.id is null then return; end if;
  select * into v_term from public.national_federation_terms
  where id = 'b61d9744-f51b-4125-a428-2c0bf599263d'
    and country_id = '3810ac68-ffbe-4d89-b2c5-615476ebc6f3'
    and start_game_year = 3 and end_game_year = 4 for update;
  if v_term.id is null or v_term.president_director_id = v_director_id then return; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_term.country_id::text || ':exceptional-election', 0)
  );
  if v_term.president_director_id is not null or exists (
    select 1 from public.national_federation_elections where country_id = v_term.country_id
      and status in ('applications', 'voting') and 4 between term_start_game_year and term_end_game_year
  ) then raise exception 'La présidence du Rwanda a changé depuis la validation administrative.'; end if;
  select team_season.id into strict v_team_season_id
  from public.team_seasons as team_season
  join public.teams as team on team.id = team_season.team_id and team.status = 'active'
  join public.team_manager_assignments as assignment
    on assignment.team_id = team.id and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id and director.status = 'active' and director.auth_user_id is not null
  where team.id = '27948dd4-0dac-416d-8f6c-118771bcb6eb'
    and assignment.sporting_director_id = v_director_id
    and team_season.season_id = v_season.id and team_season.registration_country_id = v_term.country_id
    and team_season.status in ('planned', 'active');
  update public.national_federation_terms
  set governance_mode = 'elected', president_director_id = v_director_id where id = v_term.id;
  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail, source_reference, metadata
  ) values (
    v_term.country_id, v_season.id, v_season.current_day_number, 'governance',
    'Président nommé : sevrinovitch',
    'Sur décision administrative, sevrinovitch (Kigali SafeRide) prend la présidence du Rwanda jusqu’à la fin de la Saison 4. Cette nomination est exceptionnelle ; à plusieurs membres, les prochaines présidences vacantes seront soumises à une élection.',
    'federation-presidency:s4:rw:sevrinovitch-administrative',
    jsonb_build_object('presidentDirectorId', v_director_id, 'appointmentType', 'administrative')
  ) on conflict (source_reference) do nothing;
  insert into public.sporting_director_messages (
    sporting_director_id, season_id, team_season_id, message_type, sender_name,
    subject, preview, body, action_href, action_label, source_reference, is_important
  ) values (
    v_director_id, v_season.id, v_team_season_id, 'system', 'Fédération du Rwanda',
    'Vous devenez président de la fédération du Rwanda', 'Votre nomination a été validée par l’administration.',
    'Vous prenez immédiatement la présidence jusqu’à la fin de la Saison 4. Vous pouvez développer la fédération, gérer son budget, ses projets et ses sélections. Il s’agit d’une nomination administrative exceptionnelle.',
    '/jeu/federations/rw?onglet=governance', 'Ouvrir la fédération',
    'federation-presidency:s4:rw:sevrinovitch-administrative-message', true
  ) on conflict (sporting_director_id, source_reference) do nothing;
end;
$appoint_rwanda$;

notify pgrst, 'reload schema';
commit;
