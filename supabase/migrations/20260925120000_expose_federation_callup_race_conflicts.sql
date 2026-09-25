begin;

drop function if exists public.get_current_director_federation_callups();

create function public.get_current_director_federation_callups()
returns table (
  member_id uuid, country_code text, country_name text, slot_key text,
  competition_label text, rider_id uuid, rider_name text, rider_category text,
  response_status text, published_at timestamptz, closes_at timestamptz,
  can_respond boolean, race_href text, conflicting_race_names text[]
)
language sql stable security definer set search_path = ''
as $$
  select member.id, country.iso_alpha2, country.name,
    selection_list.slot_key, schedule.label,
    coalesce(member.professional_rider_id, member.junior_rider_id),
    coalesce(pro.first_name || ' ' || pro.last_name,
      junior.first_name || ' ' || junior.last_name),
    schedule.rider_category, member.response_status,
    selection_list.published_at, schedule.closes_at,
    member.response_status = 'pending' and schedule.is_open,
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
  cross join lateral public.get_national_federation_selection_schedule(
    country.id, season.id
  ) as schedule
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
  order by schedule.closes_at, schedule.label, member.created_at, member.id;
$$;

revoke all on function public.get_current_director_federation_callups()
from public, anon;
grant execute on function public.get_current_director_federation_callups()
to authenticated, service_role;

comment on function public.get_current_director_federation_callups() is
  'Convocations du DS avec les courses concurrentes automatiquement désengagées en cas d’acceptation.';

notify pgrst, 'reload schema';

commit;
