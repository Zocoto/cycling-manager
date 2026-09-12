begin;

-- The actual calendar is authoritative, including continent-specific dates.
-- Junior races are resolved by game day (they have no departure timestamp).
create or replace function public.get_national_federation_selection_schedule(
  p_country_id uuid, p_season_id uuid
)
returns table (
  slot_key text, label text, rider_category text, race_edition_id uuid,
  race_href text, departure_at timestamptz, closes_at timestamptz,
  is_open boolean
)
language sql stable security definer set search_path = ''
as $$
  select slot.slot_key, slot.label, slot.rider_category,
    coalesce(pro.id, junior.id),
    case when pro.id is not null then '/jeu/courses/' || pro.slug
      when junior.id is not null then '/jeu/resultats-juniors/' || junior.slug end,
    coalesce(pro.departure_at, junior.departure_at),
    deadline.closes_at,
    coalesce(season.status = 'active' and season.game_year >= 3
      and coalesce(pro.status, junior.status) not in ('completed', 'cancelled')
      and now() < deadline.closes_at, false)
  from public.national_federation_selection_slots as slot
  join public.countries as country on country.id = p_country_id
  join public.seasons as season on season.id = p_season_id
    and season.game_year >= slot.active_from_game_year
  left join lateral (
    select edition.id, race.slug, edition.status, min(stage.departure_at) as departure_at
    from public.race_editions as edition
    join public.races as race on race.id = edition.race_id
    join public.stages as stage on stage.race_edition_id = edition.id
    where slot.rider_category = 'professional'
      and edition.season_id = season.id
      and race.competition_type = slot.competition_code
      and (slot.competition_code <> 'continental_championship'
        or race.championship_continent_code = country.continent_code)
      and (
        (slot.competition_code = 'nations_cup' and stage.profile_type = case slot.profile_label
          when 'Montagne' then 'mountain' when 'Vallons' then 'hilly'
          when 'Sprint' then 'sprint' when 'Pavés' then 'cobbles' else 'time_trial' end)
        or (slot.competition_code <> 'nations_cup' and stage.stage_type = case
          when slot.profile_label = 'Chrono' then 'individual_time_trial' else 'road' end)
      )
    group by edition.id, race.slug
    order by (edition.status = 'cancelled'), min(stage.departure_at), edition.id limit 1
  ) as pro on true
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
    order by (edition.status = 'cancelled'), edition.start_day_number, edition.id limit 1
  ) as junior on true
  cross join lateral (
    select case when pro.id is not null then pro.departure_at - interval '1 hour'
      else junior.departure_at end as closes_at
  ) as deadline;
$$;
revoke all on function public.get_national_federation_selection_schedule(uuid,uuid) from public, anon;
grant execute on function public.get_national_federation_selection_schedule(uuid,uuid) to authenticated, service_role;

create or replace function public.assert_federation_selection_open(
  p_country_id uuid, p_season_id uuid, p_slot_key text
)
returns void language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.get_national_federation_selection_schedule(p_country_id, p_season_id) as schedule
    where schedule.slot_key = p_slot_key and schedule.is_open
  ) then
    raise exception 'La date limite de cette sélection est dépassée ou son calendrier est indisponible.';
  end if;
end;
$$;
revoke all on function public.assert_federation_selection_open(uuid,uuid,text) from public, anon, authenticated;

-- Reads only the authenticated manager's invitations, regardless of the
-- nationality of their own federation. No generation or publication on reads.
create or replace function public.get_current_director_federation_callups()
returns table (
  member_id uuid, country_code text, country_name text, slot_key text,
  competition_label text, rider_id uuid, rider_name text, rider_category text,
  response_status text, published_at timestamptz, closes_at timestamptz,
  can_respond boolean, race_href text
)
language sql stable security definer set search_path = ''
as $$
  select member.id, country.iso_alpha2, country.name, selection_list.slot_key,
    schedule.label, coalesce(member.professional_rider_id, member.junior_rider_id),
    coalesce(pro.first_name || ' ' || pro.last_name, junior.first_name || ' ' || junior.last_name),
    schedule.rider_category, member.response_status, selection_list.published_at,
    schedule.closes_at, member.response_status = 'pending' and schedule.is_open, schedule.race_href
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment on assignment.sporting_director_id = director.id
    and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.national_federation_selection_members as member on member.owner_team_id = assignment.team_id
    and member.owner_director_id = director.id
  join public.national_federation_selection_lists as selection_list on selection_list.id = member.selection_list_id
  join public.seasons as season on season.id = selection_list.season_id and season.status = 'active'
  join public.countries as country on country.id = selection_list.country_id
  cross join lateral public.get_national_federation_selection_schedule(country.id, season.id) as schedule
  left join public.riders as pro on pro.id = member.professional_rider_id
  left join public.youth_academy_riders as junior on junior.id = member.junior_rider_id
  where director.auth_user_id = (select auth.uid()) and director.status = 'active'
    and schedule.slot_key = selection_list.slot_key
    and member.response_status <> 'draft'
    and selection_list.published_at is not null
  order by schedule.closes_at, schedule.label, member.created_at, member.id;
$$;
revoke all on function public.get_current_director_federation_callups() from public, anon;
grant execute on function public.get_current_director_federation_callups() to authenticated, service_role;

-- Fail closed if a concurrently deployed definition no longer matches.
create function pg_temp.patch_callup(p_definition text, p_before text, p_after text)
returns text language plpgsql as $$
begin
  if position(p_before in p_definition) = 0 then
    raise exception 'Call-up migration anchor missing: %', left(p_before, 160);
  end if;
  return replace(p_definition, p_before, p_after);
end;
$$;

do $migration$
declare v_definition text; v_before text;
begin
  select replace(pg_get_functiondef('public.save_national_federation_preselection(text,text,uuid[])'::regprocedure), chr(13), '') into v_definition;
  v_definition := pg_temp.patch_callup(v_definition,
    '    status = ''draft'',', '    status = national_federation_selection_lists.status,');
  v_definition := pg_temp.patch_callup(v_definition,
    '    published_at = null,', '    published_at = national_federation_selection_lists.published_at,');
  v_definition := pg_temp.patch_callup(v_definition, $before$
  delete from public.national_federation_selection_members
  where selection_list_id = v_list_id;$before$, $after$
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
    and not (coalesce(professional_rider_id, junior_rider_id) = any(v_rider_ids));$after$);
  -- Retained members keep their id, response and invitation; only additions are drafts.
  v_definition := pg_temp.patch_callup(v_definition,
    '    ) as owner_assignment on true;', '    ) as owner_assignment on true on conflict do nothing;');
  execute v_definition;

  select replace(pg_get_functiondef('public.publish_national_federation_preselection(text,text)'::regprocedure), chr(13), '') into v_definition;
  v_definition := pg_temp.patch_callup(v_definition, '  v_notified integer := 0;', '  v_notified integer := 0;
  v_new_member_ids uuid[];');
  v_definition := pg_temp.patch_callup(v_definition, $before$
  update public.national_federation_selection_lists
  set status = 'pending_confirmation'$before$, $after$
  perform public.assert_federation_selection_open(v_list.country_id, v_list.season_id, v_list.slot_key);
  select coalesce(array_agg(id), '{}'::uuid[]) into v_new_member_ids
  from public.national_federation_selection_members
  where selection_list_id = v_list.id and response_status = 'draft';
  update public.national_federation_selection_lists
  set status = 'pending_confirmation'$after$);
  v_definition := pg_temp.patch_callup(v_definition,
    '  where selection_list_id = v_list.id;', '  where selection_list_id = v_list.id and id = any(v_new_member_ids);');
  v_definition := pg_temp.patch_callup(v_definition,
    '    and member.owner_director_id is not null', '    and member.owner_director_id is not null
    and member.id = any(v_new_member_ids)');
  v_definition := pg_temp.patch_callup(v_definition,
    '  set status = ''pending_confirmation'', published_at = now(), updated_at = now()',
    '  set status = case when exists (
      select 1 from public.national_federation_selection_members
      where selection_list_id = v_list.id and owner_director_id is not null
        and response_status in (''draft'', ''pending'')
    ) then ''pending_confirmation'' else ''finalized'' end,
    published_at = coalesce(published_at, now()), updated_at = now()');
  v_definition := pg_temp.patch_callup(v_definition,
    '''/jeu/federations/'' || lower(btrim(p_country_code)) || ''?onglet=selections''',
    '''/jeu/selections-internationales''');
  execute v_definition;

  select replace(pg_get_functiondef('public.respond_to_national_federation_preselection(uuid,boolean)'::regprocedure), chr(13), '') into v_definition;
  v_definition := pg_temp.patch_callup(v_definition, $before$
  select * into v_member
  from public.national_federation_selection_members
  where id = p_member_id
  for update;
  select * into v_list
  from public.national_federation_selection_lists
  where id = v_member.selection_list_id;$before$, $after$
  -- Lock parent first: a simultaneous save cannot delete a newly accepted rider.
  select selection_list.* into v_list
  from public.national_federation_selection_lists as selection_list
  join public.national_federation_selection_members as member on member.selection_list_id = selection_list.id
  where member.id = p_member_id for update of selection_list;
  select * into v_member from public.national_federation_selection_members
  where id = p_member_id for update;$after$);
  v_definition := pg_temp.patch_callup(v_definition, $before$
  select * into v_identity
  from public.get_current_federation_identity(v_country_code);$before$, $after$
  -- A Belgian DS must also be able to answer for a French rider, for example.
  select director.id as sporting_director_id, team.id as team_id,
    coalesce(team.amateur_name, team.internal_name) as team_name into v_identity
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment on assignment.sporting_director_id = director.id
    and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.teams as team on team.id = assignment.team_id and team.status = 'active'
  where director.auth_user_id = (select auth.uid()) and director.status = 'active'
    and director.id = v_member.owner_director_id and team.id = v_member.owner_team_id
  limit 1;$after$);
  v_definition := pg_temp.patch_callup(v_definition,
    '     or v_member.owner_director_id <> v_identity.sporting_director_id then',
    '     or v_member.owner_director_id is distinct from v_identity.sporting_director_id then');
  v_definition := pg_temp.patch_callup(v_definition, $before$
  update public.national_federation_selection_members
  set$before$, $after$
  perform public.assert_federation_selection_open(v_list.country_id, v_list.season_id, v_list.slot_key);
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
  set$after$);
  -- Confirmation and startlist are a single transaction, never a best-effort follow-up.
  v_definition := pg_temp.patch_callup(v_definition,
    '  return case when p_accept then ''confirmed'' else ''declined'' end;', $after$
  perform public.sync_national_federation_championship_lineup(v_list.id);
  if p_accept and v_member.professional_rider_id is not null and not exists (
    select 1 from public.national_federation_selection_race_links as link
    join public.race_rosters as roster on roster.race_registration_id = link.race_registration_id
    where link.selection_list_id = v_list.id and roster.rider_id = v_member.professional_rider_id
      and roster.status in ('selected', 'confirmed')
  ) then
    raise exception 'La participation ne peut pas être confirmée : le coureur est indisponible pour cette épreuve (tour verrouillé ou commencé notamment).';
  end if;
  return case when p_accept then 'confirmed' else 'declined' end;$after$);
  execute v_definition;

  -- Changing the default mode does not revoke invitations or accepted entries.
  select replace(pg_get_functiondef('public.set_national_federation_selection_mode(text,boolean)'::regprocedure), chr(13), '') into v_definition;
  v_before := substring(v_definition from position('  if p_automatic_selection then' in v_definition)
    for position('  insert into public.national_federation_journal_entries' in v_definition)
      - position('  if p_automatic_selection then' in v_definition));
  if v_before not like '%set response_status = ''draft''%' then raise exception 'Unexpected selection mode reset'; end if;
  v_definition := pg_temp.patch_callup(v_definition, v_before, $after$
  if p_automatic_selection then
    update public.national_federation_selection_lists as selection_list
    set created_by_director_id = null
    where selection_list.country_id = v_identity.country_id
      and selection_list.season_id = v_season.id;
  end if;

$after$);
  v_definition := pg_temp.patch_callup(v_definition,
    'extract(epoch from now())::bigint::text', 'gen_random_uuid()::text');
  execute v_definition;

  -- On automatic takeover, unresolved invitations cannot remain confirmable
  -- on top of the automatically filled quota. Already confirmed members stay.
  select replace(pg_get_functiondef('public.prepare_due_automatic_federation_professional_lineups(timestamptz)'::regprocedure), chr(13), '') into v_definition;
  v_definition := pg_temp.patch_callup(v_definition, '      elsif v_automatic then', $after$
      elsif v_automatic then
        update public.national_federation_selection_members
        set response_status = 'declined', responded_at = p_now
        where selection_list_id = v_list.id and response_status in ('draft', 'pending');$after$);
  execute v_definition;

  -- Junior automatic filling must also retain confirmed riders on every retry.
  select replace(pg_get_functiondef('public.ensure_automatic_federation_junior_lineups(uuid)'::regprocedure), chr(13), '') into v_definition;
  v_definition := pg_temp.patch_callup(v_definition,
    '    where selection_list_id = v_list_id;',
    '    where selection_list_id = v_list_id and response_status in (''draft'', ''pending'');');
  v_definition := pg_temp.patch_callup(v_definition,
    '    where academy.country_id = v_country.id', '    where academy.country_id = v_country.id
      and not exists (select 1 from public.national_federation_selection_members as kept
        where kept.selection_list_id = v_list_id and kept.junior_rider_id = academy.id)');
  v_definition := pg_temp.patch_callup(v_definition,
    '    limit v_edition.selection_maximum;', '    limit greatest(0, v_edition.selection_maximum - (
      select count(*) from public.national_federation_selection_members
      where selection_list_id = v_list_id and response_status = ''confirmed''));');
  execute v_definition;
end;
$migration$;

notify pgrst, 'reload schema';
commit;
