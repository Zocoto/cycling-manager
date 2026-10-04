begin;

-- La fédération fige sa liste selon son échéance propre, mais le DS garde une
-- fenêtre distincte pour accepter/refuser la convocation. Un CC est publié à
-- H-24 et reste répondable jusqu'à H-1 ; les Mondiaux ferment à H-24.
create or replace function public.get_national_federation_callup_response_closes_at(
  p_competition_code text,
  p_rider_category text,
  p_departure_at timestamptz
)
returns timestamptz
language sql
immutable
strict
set search_path = ''
as $$
  select p_departure_at - case
    when p_rider_category = 'junior' then interval '0 hours'
    when p_competition_code = 'world_championship'
      then interval '24 hours'
    else interval '1 hour'
  end;
$$;

revoke all
on function public.get_national_federation_callup_response_closes_at(
  text, text, timestamptz
)
from public, anon, authenticated;

grant execute
on function public.get_national_federation_callup_response_closes_at(
  text, text, timestamptz
)
to authenticated, service_role;

create or replace function public.assert_federation_callup_response_open(
  p_country_id uuid,
  p_season_id uuid,
  p_slot_key text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_slot public.national_federation_selection_slots%rowtype;
  v_schedule record;
  v_closes_at timestamptz;
  v_status text;
begin
  select * into v_slot
  from public.national_federation_selection_slots
  where slot_key = p_slot_key;

  select schedule.* into v_schedule
  from public.get_national_federation_selection_schedule(
    p_country_id, p_season_id
  ) as schedule
  where schedule.slot_key = p_slot_key;

  if v_slot.slot_key is null
     or v_schedule.race_edition_id is null
     or v_schedule.departure_at is null then
    raise exception
      'La date limite de cette convocation est dépassée ou son calendrier est indisponible.';
  end if;

  if v_slot.rider_category = 'professional' then
    select edition.status into v_status
    from public.race_editions as edition
    where edition.id = v_schedule.race_edition_id;
  else
    select edition.status into v_status
    from public.development_race_editions as edition
    where edition.id = v_schedule.race_edition_id;
  end if;

  v_closes_at :=
    public.get_national_federation_callup_response_closes_at(
      v_slot.competition_code,
      v_slot.rider_category,
      v_schedule.departure_at
    );

  if v_status is null
     or v_status in ('completed', 'cancelled')
     or now() >= v_closes_at then
    raise exception
      'La date limite de cette convocation est dépassée ou son calendrier est indisponible.';
  end if;
end;
$$;

revoke all
on function public.assert_federation_callup_response_open(uuid, uuid, text)
from public, anon, authenticated;

-- L'annuaire des convocations affiche l'échéance de réponse du DS, sans
-- modifier l'échéance de composition montrée au président de fédération.
create or replace function public.get_current_director_federation_callups()
returns table (
  member_id uuid, country_code text, country_name text, slot_key text,
  competition_label text, rider_id uuid, rider_name text, rider_category text,
  response_status text, published_at timestamptz, closes_at timestamptz,
  can_respond boolean, race_href text, conflicting_race_names text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select member.id, country.iso_alpha2, country.name,
    selection_list.slot_key, schedule.label,
    coalesce(member.professional_rider_id, member.junior_rider_id),
    coalesce(pro.first_name || ' ' || pro.last_name,
      junior.first_name || ' ' || junior.last_name),
    schedule.rider_category, member.response_status,
    selection_list.published_at, response_deadline.closes_at,
    member.response_status = 'pending'
      and coalesce(pro_edition.status, junior_edition.status)
        not in ('completed', 'cancelled')
      and now() < response_deadline.closes_at,
    schedule.race_href,
    coalesce(conflicts.race_names, array[]::text[])
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.national_federation_selection_members as member
    on member.owner_team_id = assignment.team_id
   and member.owner_director_id = director.id
  join public.national_federation_selection_lists as selection_list
    on selection_list.id = member.selection_list_id
  join public.seasons as season
    on season.id = selection_list.season_id and season.status = 'active'
  join public.countries as country on country.id = selection_list.country_id
  join public.national_federation_selection_slots as slot
    on slot.slot_key = selection_list.slot_key
  cross join lateral public.get_national_federation_selection_schedule(
    country.id, season.id
  ) as schedule
  cross join lateral (
    select public.get_national_federation_callup_response_closes_at(
      slot.competition_code,
      slot.rider_category,
      schedule.departure_at
    ) as closes_at
  ) as response_deadline
  left join public.race_editions as pro_edition
    on schedule.rider_category = 'professional'
   and pro_edition.id = schedule.race_edition_id
  left join public.development_race_editions as junior_edition
    on schedule.rider_category = 'junior'
   and junior_edition.id = schedule.race_edition_id
  left join public.riders as pro on pro.id = member.professional_rider_id
  left join public.youth_academy_riders as junior
    on junior.id = member.junior_rider_id
  left join lateral (
    select array_agg(distinct other_edition.display_name
      order by other_edition.display_name) as race_names
    from public.race_rosters as roster
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
     and registration.status = 'accepted'
    join public.race_editions as other_edition
      on other_edition.id = registration.race_edition_id
     and other_edition.id <> schedule.race_edition_id
     and other_edition.season_id = season.id
    join public.races as other_race on other_race.id = other_edition.race_id
    join public.race_editions as target_edition
      on target_edition.id = schedule.race_edition_id
    join public.races as target_race on target_race.id = target_edition.race_id
    where roster.rider_id = member.professional_rider_id
      and roster.status in ('selected', 'confirmed')
      and not (
        other_race.competition_type = target_race.competition_type
        and (
          target_race.competition_type = 'world_championship'
          or (
            target_race.competition_type = 'continental_championship'
            and other_race.championship_continent_code =
              target_race.championship_continent_code
          )
        )
      )
      and exists (
        select 1
        from public.stages as target_stage
        join public.stages as other_stage
          on other_stage.season_day_id = target_stage.season_day_id
         and other_stage.day_slot = target_stage.day_slot
         and other_stage.race_edition_id = other_edition.id
        where target_stage.race_edition_id = schedule.race_edition_id
      )
  ) as conflicts on true
  where director.auth_user_id = (select auth.uid())
    and director.status = 'active'
    and schedule.slot_key = selection_list.slot_key
    and member.response_status <> 'draft'
    and selection_list.published_at is not null
  order by response_deadline.closes_at, schedule.label,
    member.created_at, member.id;
$$;

revoke all on function public.get_current_director_federation_callups()
from public, anon;
grant execute on function public.get_current_director_federation_callups()
to authenticated, service_role;

create function pg_temp.patch_federation_response_window(
  p_definition text,
  p_before text,
  p_after text
)
returns text
language plpgsql
as $$
begin
  if position(p_before in p_definition) = 0 then
    raise exception 'Federation response-window migration anchor missing: %',
      left(p_before, 180);
  end if;
  return replace(p_definition, p_before, p_after);
end;
$$;

do $migration$
declare
  v_definition text;
begin
  select replace(pg_catalog.pg_get_functiondef(
    'public.respond_to_national_federation_preselection(uuid,boolean)'::regprocedure
  ), chr(13), '') into v_definition;
  v_definition := pg_temp.patch_federation_response_window(
    v_definition,
    '  perform public.assert_federation_selection_open(v_list.country_id, v_list.season_id, v_list.slot_key);',
    '  perform public.assert_federation_callup_response_open(v_list.country_id, v_list.season_id, v_list.slot_key);'
  );
  execute v_definition;

  select replace(pg_catalog.pg_get_functiondef(
    'public.prepare_due_automatic_federation_professional_lineups(timestamptz)'::regprocedure
  ), chr(13), '') into v_definition;
  v_definition := pg_temp.patch_federation_response_window(
    v_definition,
    $before$    cross join lateral public.get_national_federation_selection_schedule(
      selection_list.country_id, selection_list.season_id
    ) as schedule
    where selection_list.season_id = v_season.id
      and slot.rider_category = 'professional'
      and schedule.slot_key = selection_list.slot_key
      and schedule.closes_at <= p_now$before$,
    $after$    cross join lateral public.get_national_federation_selection_target(
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
      ) <= p_now$after$
  );
  v_definition := pg_temp.patch_federation_response_window(
    v_definition,
    $before$      v_closes_at := v_departure_at - case
        when v_slot.competition_code in (
          'continental_championship', 'world_championship'
        ) then interval '24 hours'
        else interval '1 hour'
      end;$before$,
    $after$      v_closes_at :=
        public.get_national_federation_callup_response_closes_at(
          v_slot.competition_code,
          v_slot.rider_category,
          v_departure_at
        );$after$
  );
  execute v_definition;

  select replace(pg_catalog.pg_get_functiondef(
    'public.refill_national_federation_professional_selection(uuid,timestamptz)'::regprocedure
  ), chr(13), '') into v_definition;
  v_definition := pg_temp.patch_federation_response_window(
    v_definition,
    $before$  v_closes_at := v_departure_at - case
    when v_slot.competition_code in (
      'continental_championship', 'world_championship'
    ) then interval '24 hours'
    else interval '1 hour'
  end;$before$,
    $after$  v_closes_at :=
    public.get_national_federation_callup_response_closes_at(
      v_slot.competition_code,
      v_slot.rider_category,
      v_departure_at
    );$after$
  );
  execute v_definition;
end;
$migration$;

comment on function public.get_national_federation_callup_response_closes_at(
  text, text, timestamptz
) is
  'Échéance de réponse du DS : H-24 aux Mondiaux, H-1 aux CC et à la Nations Cup, départ pour les juniors.';

comment on function public.assert_federation_callup_response_open(
  uuid, uuid, text
) is
  'Contrôle la réponse du DS sans rouvrir la date de composition du président.';

notify pgrst, 'reload schema';

commit;
