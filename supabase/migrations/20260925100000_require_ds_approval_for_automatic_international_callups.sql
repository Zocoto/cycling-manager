begin;

-- The countries admitted to the continental and world championships must be
-- known before call-ups are sent.  The snapshot is deliberately immutable:
-- later UCI results cannot silently add or remove a national team.
create table public.international_nation_qualification_snapshots (
  season_id uuid not null references public.seasons(id) on delete cascade,
  competition_code text not null,
  country_id uuid not null references public.countries(id) on delete cascade,
  continent_code text,
  qualification_rank integer not null,
  current_season_points bigint not null default 0,
  previous_season_points bigint not null default 0,
  qualification_score numeric(18, 2) not null default 0,
  is_qualified boolean not null,
  ranking_day_number smallint not null default 8,
  captured_day_number smallint not null,
  captured_at timestamptz not null default now(),
  primary key (season_id, competition_code, country_id),
  constraint international_nation_qualification_competition_allowed check (
    competition_code in ('continental_championship', 'world_championship')
  ),
  constraint international_nation_qualification_rank_positive check (
    qualification_rank > 0
  ),
  constraint international_nation_qualification_points_non_negative check (
    current_season_points >= 0 and previous_season_points >= 0
  ),
  constraint international_nation_qualification_day_valid check (
    ranking_day_number = 8 and captured_day_number between 8 and 28
  )
);

create index international_nation_qualification_lookup_idx
  on public.international_nation_qualification_snapshots (
    season_id, competition_code, is_qualified, continent_code,
    qualification_rank
  );

alter table public.international_nation_qualification_snapshots
  enable row level security;
create policy international_nation_qualification_read_authenticated
on public.international_nation_qualification_snapshots
for select to authenticated
using (true);
revoke all on table public.international_nation_qualification_snapshots
  from public, anon, authenticated;
grant select on table public.international_nation_qualification_snapshots
  to authenticated;
grant all on table public.international_nation_qualification_snapshots
  to service_role;

create or replace function public.freeze_due_international_nation_qualifications(
  p_now timestamptz default now()
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '60s'
as $$
declare
  v_season public.seasons%rowtype;
  v_previous_season_id uuid;
  v_inserted integer := 0;
begin
  select * into v_season
  from public.seasons as season
  where season.status = 'active'
  limit 1;

  if v_season.id is null
     or v_season.game_year < 3
     or coalesce(v_season.current_day_number, 0) < 8 then
    return 0;
  end if;

  select season.id into v_previous_season_id
  from public.seasons as season
  where season.game_year = v_season.game_year - 1
  limit 1;

  with eligible_countries as (
    select country.id, country.continent_code, country.name
    from public.countries as country
    where country.is_active = true
      and country.continent_code is not null
      and exists (
        select 1
        from public.riders as rider
        join public.rider_season_ratings as rating
          on rating.rider_id = rider.id
         and rating.season_id = v_season.id
        where rider.country_id = country.id
          and rider.status in ('active', 'free_agent')
      )
  ), current_points as (
    select rider.country_id,
      sum(greatest(0, coalesce(summary.points, 0)))::bigint as points
    from public.rider_season_summaries as summary
    join public.riders as rider on rider.id = summary.rider_id
    where summary.season_id = v_season.id
      and rider.country_id is not null
    group by rider.country_id
  ), previous_points as (
    select rider.country_id,
      sum(greatest(0, coalesce(summary.points, 0)))::bigint as points
    from public.rider_season_summaries as summary
    join public.riders as rider on rider.id = summary.rider_id
    where summary.season_id = v_previous_season_id
      and rider.country_id is not null
    group by rider.country_id
  ), scored as (
    select eligible.id as country_id, eligible.continent_code,
      eligible.name,
      coalesce(current_points.points, 0)::bigint as current_points,
      coalesce(previous_points.points, 0)::bigint as previous_points,
      (
        coalesce(current_points.points, 0)::numeric
        + coalesce(previous_points.points, 0)::numeric * 0.25
      )::numeric(18, 2) as qualification_score
    from eligible_countries as eligible
    left join current_points on current_points.country_id = eligible.id
    left join previous_points on previous_points.country_id = eligible.id
  ), ranked as (
    select scored.*,
      row_number() over (
        order by scored.qualification_score desc,
          scored.current_points desc, scored.previous_points desc,
          scored.name, scored.country_id
      )::integer as world_rank,
      row_number() over (
        partition by scored.continent_code
        order by scored.qualification_score desc,
          scored.current_points desc, scored.previous_points desc,
          scored.name, scored.country_id
      )::integer as continental_rank
    from scored
  ), snapshots as (
    select 'world_championship'::text as competition_code,
      ranked.country_id, null::text as continent_code,
      ranked.world_rank as qualification_rank,
      ranked.current_points, ranked.previous_points,
      ranked.qualification_score, ranked.world_rank <= 30 as is_qualified
    from ranked
    union all
    select 'continental_championship'::text,
      ranked.country_id, ranked.continent_code,
      ranked.continental_rank,
      ranked.current_points, ranked.previous_points,
      ranked.qualification_score, ranked.continental_rank <= 20
    from ranked
  )
  insert into public.international_nation_qualification_snapshots (
    season_id, competition_code, country_id, continent_code,
    qualification_rank, current_season_points, previous_season_points,
    qualification_score, is_qualified, ranking_day_number,
    captured_day_number, captured_at
  )
  select v_season.id, snapshots.competition_code, snapshots.country_id,
    snapshots.continent_code, snapshots.qualification_rank,
    snapshots.current_points, snapshots.previous_points,
    snapshots.qualification_score, snapshots.is_qualified, 8,
    v_season.current_day_number, p_now
  from snapshots
  on conflict (season_id, competition_code, country_id) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.freeze_due_international_nation_qualifications(timestamptz)
  from public, anon, authenticated;
grant execute on function public.freeze_due_international_nation_qualifications(timestamptz)
  to service_role;

-- One resolver remains authoritative for the federation workbench, the
-- automatic producer and the startlist synchronizer.  A CC/World target does
-- not exist until the J8 snapshot says that the country qualified.
create or replace function public.get_national_federation_selection_target(
  p_country_id uuid,
  p_season_id uuid,
  p_slot_key text
)
returns table (
  race_edition_id uuid,
  race_slug text,
  edition_status text,
  departure_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select edition.id, race.slug, edition.status,
    min(stage.departure_at) as departure_at
  from public.national_federation_selection_slots as slot
  join public.countries as country on country.id = p_country_id
  join public.race_editions as edition on edition.season_id = p_season_id
  join public.races as race on race.id = edition.race_id
    and race.competition_type = slot.competition_code
  join public.stages as stage on stage.race_edition_id = edition.id
  where slot.slot_key = p_slot_key
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
$$;

revoke all on function public.get_national_federation_selection_target(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.get_national_federation_selection_target(uuid,uuid,text)
  to authenticated, service_role;

-- CC and Worlds close a full day before departure.  No answer at the cutoff
-- means no participation; it never becomes an implicit acceptance.
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
          when slot.competition_code in (
            'continental_championship', 'world_championship'
          ) then interval '24 hours'
          else interval '1 hour'
        end
      else junior.departure_at
    end as closes_at
  ) as deadline;
$$;

revoke all on function public.get_national_federation_selection_schedule(uuid,uuid)
  from public, anon;
grant execute on function public.get_national_federation_selection_schedule(uuid,uuid)
  to authenticated, service_role;

create or replace function public.prepare_due_automatic_federation_professional_lineups(
  p_now timestamptz default now()
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '150s'
as $$
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
    cross join lateral public.get_national_federation_selection_schedule(
      selection_list.country_id, selection_list.season_id
    ) as schedule
    where selection_list.season_id = v_season.id
      and slot.rider_category = 'professional'
      and schedule.slot_key = selection_list.slot_key
      and schedule.closes_at <= p_now
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

      v_closes_at := v_departure_at - case
        when v_slot.competition_code in (
          'continental_championship', 'world_championship'
        ) then interval '24 hours'
        else interval '1 hour'
      end;
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
                and other_slot.competition_code = 'nations_cup'
                and other_member.professional_rider_id = rider.id
                and other_member.response_status in ('pending', 'confirmed')
            )
          )
        order by
          case v_slot.profile_label
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
          || v_slot.label || '.',
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
          v_slot.label || ' · ' || v_added::text
            || ' nouvelle(s) convocation(s), sans validation implicite.',
          'federation-auto-callups:' || v_list.id::text || ':'
            || extract(epoch from p_now)::bigint::text
        ) on conflict (source_reference) do nothing;
      end if;
    end loop;
  end loop;
  return v_total;
end;
$$;

revoke all on function public.prepare_due_automatic_federation_professional_lineups(timestamptz)
  from public, anon, authenticated;
grant execute on function public.prepare_due_automatic_federation_professional_lineups(timestamptz)
  to service_role;

-- Reopen only the still-future approvals created by the previous automatic
-- producer.  Exact equality with published_at identifies its atomic insert;
-- a real DS response has its own later timestamp and is left untouched.
select public.freeze_due_international_nation_qualifications(now());

with reopened as (
  select member.id
  from public.national_federation_selection_members as member
  join public.national_federation_selection_lists as selection_list
    on selection_list.id = member.selection_list_id
  join public.national_federation_selection_slots as slot
    on slot.slot_key = selection_list.slot_key
  cross join lateral public.get_national_federation_selection_target(
    selection_list.country_id, selection_list.season_id,
    selection_list.slot_key
  ) as target
  left join public.national_federation_selection_preferences as preference
    on preference.country_id = selection_list.country_id
   and preference.season_id = selection_list.season_id
  where slot.rider_category = 'professional'
    and slot.competition_code in (
      'continental_championship', 'world_championship'
    )
    and selection_list.created_by_director_id is null
    and coalesce(preference.automatic_selection, true)
    and member.owner_director_id is not null
    and member.response_status = 'confirmed'
    and member.responded_at = selection_list.published_at
    and target.departure_at > now() + interval '24 hours'
)
update public.national_federation_selection_members as member
set response_status = 'pending', responded_at = null
from reopened
where member.id = reopened.id;

update public.national_federation_selection_lists as selection_list
set status = 'pending_confirmation', updated_at = now()
where selection_list.created_by_director_id is null
  and exists (
    select 1
    from public.national_federation_selection_members as member
    where member.selection_list_id = selection_list.id
      and member.response_status = 'pending'
  );

insert into public.sporting_director_messages (
  sporting_director_id, season_id, message_type, sender_name, subject,
  preview, body, action_href, action_label, source_reference, is_important
)
select member.owner_director_id, selection_list.season_id,
  'international_selection', country.name || ' · Fédération',
  'Convocation internationale à confirmer',
  rider.first_name || ' ' || rider.last_name || ' est convoqué pour '
    || slot.label || '.',
  'Cette participation exige désormais votre validation. Confirmez ou refusez avant la date limite ; sans réponse, le coureur ne sera pas mobilisé.',
  '/jeu/selections-internationales', 'Répondre à la convocation',
  'federation-auto-callup:' || member.id::text, true
from public.national_federation_selection_members as member
join public.national_federation_selection_lists as selection_list
  on selection_list.id = member.selection_list_id
join public.national_federation_selection_slots as slot
  on slot.slot_key = selection_list.slot_key
join public.countries as country on country.id = selection_list.country_id
join public.riders as rider on rider.id = member.professional_rider_id
cross join lateral public.get_national_federation_selection_target(
  selection_list.country_id, selection_list.season_id,
  selection_list.slot_key
) as target
where selection_list.created_by_director_id is null
  and slot.competition_code in (
    'continental_championship', 'world_championship'
  )
  and member.response_status = 'pending'
  and member.owner_director_id is not null
  and target.departure_at > now() + interval '24 hours'
on conflict (sporting_director_id, source_reference) do nothing;

do $migration$
declare
  v_list record;
begin
  for v_list in
    select distinct selection_list.id
    from public.national_federation_selection_lists as selection_list
    join public.national_federation_selection_members as member
      on member.selection_list_id = selection_list.id
     and member.response_status = 'pending'
    join public.national_federation_selection_slots as slot
      on slot.slot_key = selection_list.slot_key
    cross join lateral public.get_national_federation_selection_target(
      selection_list.country_id, selection_list.season_id,
      selection_list.slot_key
    ) as target
    where selection_list.created_by_director_id is null
      and slot.competition_code in (
        'continental_championship', 'world_championship'
      )
      and target.departure_at > now() + interval '24 hours'
  loop
    perform public.sync_national_federation_championship_lineup(v_list.id);
  end loop;
end;
$migration$;

-- Since S3 the federation lists are authoritative.  Keeping the legacy
-- automatic championship producer active as well creates duplicate calls and
-- can later promote a rider without going through the federation response.
do $migration$
declare
  v_definition text;
  v_anchor constant text := E'begin\n  -- Sans réponse explicite';
  v_replacement constant text := E'begin\n  if exists (\n    select 1 from public.seasons as season\n    where season.status = ''active'' and season.game_year >= 3\n  ) then\n    return query select 0::integer, 0::integer;\n    return;\n  end if;\n\n  -- Sans réponse explicite';
begin
  select replace(pg_catalog.pg_get_functiondef(
    'public.process_due_international_championship_selections(timestamptz)'::regprocedure
  ), chr(13), '') into v_definition;
  if position(v_anchor in v_definition) = 0 then
    raise exception 'Unexpected legacy international selection dispatcher; migration aborted.';
  end if;
  execute replace(v_definition, v_anchor, v_replacement);
end;
$migration$;

comment on function public.freeze_due_international_nation_qualifications(timestamptz) is
  'Fige à partir de J8 les nations des CC (top 20/continent) et Mondiaux (top 30), avec 25 % de report de la saison précédente.';
comment on function public.prepare_due_automatic_federation_professional_lineups(timestamptz) is
  'Envoie des convocations automatiques qui exigent la validation du DS ; un refus appelle le coureur suivant et une absence de réponse ne sélectionne jamais le coureur.';

notify pgrst, 'reload schema';

commit;
