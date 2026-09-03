begin;

create table public.national_federation_selection_race_links (
  selection_list_id uuid primary key
    references public.national_federation_selection_lists(id) on delete cascade,
  race_edition_id uuid not null
    references public.race_editions(id) on delete cascade,
  race_registration_id uuid not null unique
    references public.race_registrations(id) on delete cascade,
  synced_at timestamptz not null default now(),
  constraint national_federation_selection_race_links_edition_unique
    unique (selection_list_id, race_edition_id)
);

create index national_federation_selection_race_links_edition_idx
  on public.national_federation_selection_race_links (race_edition_id);

alter table public.national_federation_selection_race_links enable row level security;

create policy national_federation_selection_race_links_select_authenticated
on public.national_federation_selection_race_links
for select to authenticated
using (true);

grant select on table public.national_federation_selection_race_links
to authenticated;
grant all on table public.national_federation_selection_race_links
to service_role;

-- Une sélection internationale prime les engagements de club du même créneau,
-- mais un même coureur peut disputer le CLM et la course en ligne de son
-- championnat. Ce traitement reste hors des lectures de page.
create or replace function public.prioritize_federation_championship_rider(
  p_race_edition_id uuid,
  p_rider_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_season_id uuid;
  v_target_start_day integer;
  v_target_end_day integer;
  v_target_competition_type text;
  v_target_continent_code text;
begin
  select
    edition.season_id,
    race.competition_type,
    race.championship_continent_code,
    min(day.day_number),
    max(day.day_number)
  into
    v_season_id,
    v_target_competition_type,
    v_target_continent_code,
    v_target_start_day,
    v_target_end_day
  from public.race_editions as edition
  join public.races as race on race.id = edition.race_id
  join public.stages as stage on stage.race_edition_id = edition.id
  join public.season_days as day on day.id = stage.season_day_id
  where edition.id = p_race_edition_id
  group by
    edition.season_id,
    race.competition_type,
    race.championship_continent_code;

  if v_season_id is null or v_target_competition_type not in (
    'world_championship', 'continental_championship'
  ) then
    return;
  end if;

  update public.race_rosters as roster
  set status = 'withdrawn'
  from public.race_registrations as registration,
       public.race_editions as other_edition,
       public.races as other_race
  where registration.id = roster.race_registration_id
    and other_edition.id = registration.race_edition_id
    and other_race.id = other_edition.race_id
    and other_edition.season_id = v_season_id
    and other_edition.id <> p_race_edition_id
    and roster.rider_id = p_rider_id
    and roster.status in ('selected', 'confirmed')
    and registration.status = 'accepted'
    and not (
      other_race.competition_type = v_target_competition_type
      and (
        v_target_competition_type = 'world_championship'
        or other_race.championship_continent_code = v_target_continent_code
      )
    )
    and exists (
      select 1
      from public.stages as other_stage
      join public.season_days as other_day
        on other_day.id = other_stage.season_day_id
      where other_stage.race_edition_id = other_edition.id
        and other_day.day_number between v_target_start_day and v_target_end_day
    );

  update public.race_registrations as registration
  set status = 'withdrawn', decided_at = now()
  where registration.status = 'accepted'
    and registration.race_edition_id <> p_race_edition_id
    and exists (
      select 1
      from public.race_rosters as affected_roster
      where affected_roster.race_registration_id = registration.id
        and affected_roster.rider_id = p_rider_id
        and affected_roster.status = 'withdrawn'
    )
    and not exists (
      select 1
      from public.race_rosters as active_roster
      where active_roster.race_registration_id = registration.id
        and active_roster.status in ('selected', 'confirmed')
    );

  update public.rider_form_camps as camp
  set status = 'cancelled', completed_at = now()
  where camp.rider_id = p_rider_id
    and camp.season_id = v_season_id
    and camp.status in ('planned', 'active')
    and camp.start_day_number <= v_target_end_day
    and camp.end_day_number >= v_target_start_day;
end;
$$;

revoke all
on function public.prioritize_federation_championship_rider(uuid, uuid)
from public, anon, authenticated;
grant execute
on function public.prioritize_federation_championship_rider(uuid, uuid)
to service_role;

create or replace function public.sync_national_federation_championship_lineup(
  p_selection_list_id uuid
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_list public.national_federation_selection_lists%rowtype;
  v_slot public.national_federation_selection_slots%rowtype;
  v_country public.countries%rowtype;
  v_season public.seasons%rowtype;
  v_edition_id uuid;
  v_departure_at timestamptz;
  v_registration_id uuid;
  v_member record;
  v_roster_count integer := 0;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('federation-startlist:' || p_selection_list_id::text, 0)
  );

  select * into v_list
  from public.national_federation_selection_lists
  where id = p_selection_list_id
  for update;
  if v_list.id is null or v_list.status not in ('pending_confirmation', 'finalized') then
    return 0;
  end if;

  select * into v_slot
  from public.national_federation_selection_slots
  where slot_key = v_list.slot_key;
  select * into v_country from public.countries where id = v_list.country_id;
  select * into v_season from public.seasons where id = v_list.season_id;

  if v_season.game_year < 3
     or v_slot.rider_category <> 'professional'
     or v_slot.competition_code not in (
       'world_championship', 'continental_championship'
     ) then
    return 0;
  end if;

  select edition.id, min(stage.departure_at)
  into v_edition_id, v_departure_at
  from public.race_editions as edition
  join public.races as race on race.id = edition.race_id
  join public.stages as stage on stage.race_edition_id = edition.id
  where edition.season_id = v_list.season_id
    and edition.status not in ('completed', 'cancelled')
    and race.competition_type = v_slot.competition_code
    and (
      v_slot.competition_code = 'world_championship'
      or race.championship_continent_code = v_country.continent_code
    )
    and stage.stage_type = case
      when v_slot.profile_label = 'Chrono' then 'individual_time_trial'
      else 'road'
    end
  group by edition.id
  order by min(stage.departure_at), edition.id
  limit 1;

  if v_edition_id is null or v_departure_at <= now() then
    return 0;
  end if;

  select link.race_registration_id into v_registration_id
  from public.national_federation_selection_race_links as link
  where link.selection_list_id = v_list.id;

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
    ) values (
      v_list.id, v_edition_id, v_registration_id, now()
    );
  else
    update public.race_registrations
    set status = 'accepted', historical_team_name = v_country.name,
        decided_at = now()
    where id = v_registration_id;
    update public.national_federation_selection_race_links
    set synced_at = now()
    where selection_list_id = v_list.id;
  end if;

  -- Une nouvelle publication remplace les éventuels choix automatiques de la
  -- même nation, y compris lorsqu'ils étaient portés par une équipe de club.
  update public.race_rosters as roster
  set status = 'withdrawn'
  from public.race_registrations as registration,
       public.riders as rider
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
      select 1
      from public.national_federation_selection_members as member
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
      and rider.country_id = v_list.country_id
      and rider.status in ('active', 'free_agent')
    order by member.created_at, member.id
  loop
    begin
      perform public.prioritize_federation_championship_rider(
        v_edition_id, v_member.rider_id
      );

      insert into public.race_rosters (
        race_registration_id, rider_id, race_role, status, selected_at
      ) values (
        v_registration_id, v_member.rider_id, 'auto', 'confirmed', now()
      )
      on conflict (race_registration_id, rider_id) do update set
        race_role = 'auto', status = 'confirmed', selected_at = excluded.selected_at;
    exception
      when sqlstate 'P0001' then
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
$$;

revoke all
on function public.sync_national_federation_championship_lineup(uuid)
from public, anon, authenticated;
grant execute
on function public.sync_national_federation_championship_lineup(uuid)
to service_role;

create or replace function public.sync_due_national_federation_championship_lineups(
  p_now timestamptz default now(),
  p_force boolean default false
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  v_list record;
  v_synced_count integer := 0;
begin
  for v_list in
    select selection_list.id
    from public.national_federation_selection_lists as selection_list
    join public.national_federation_selection_slots as slot
      on slot.slot_key = selection_list.slot_key
    join public.seasons as season
      on season.id = selection_list.season_id
     and season.status = 'active'
     and season.game_year >= 3
    left join public.national_federation_selection_race_links as link
      on link.selection_list_id = selection_list.id
    where selection_list.status in ('pending_confirmation', 'finalized')
      and slot.rider_category = 'professional'
      and slot.competition_code in (
        'world_championship', 'continental_championship'
      )
      and (
        p_force
        or link.selection_list_id is null
        or link.synced_at < selection_list.updated_at
        or exists (
          select 1
          from public.national_federation_selection_members as changed_member
          where changed_member.selection_list_id = selection_list.id
            and changed_member.responded_at > link.synced_at
        )
      )
    order by selection_list.updated_at, selection_list.id
  loop
    perform public.sync_national_federation_championship_lineup(v_list.id);
    v_synced_count := v_synced_count + 1;
  end loop;
  return v_synced_count;
end;
$$;

revoke all
on function public.sync_due_national_federation_championship_lineups(timestamptz, boolean)
from public, anon, authenticated;
grant execute
on function public.sync_due_national_federation_championship_lineups(timestamptz, boolean)
to service_role;

notify pgrst, 'reload schema';

commit;
