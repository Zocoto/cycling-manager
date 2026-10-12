begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';

-- Only the active S4 programme is converted. Never rewrite a live/replayed race.
do $preflight$
begin
  perform edition.id from public.race_editions edition
    join public.national_federation_nations_cup_heats heat on heat.race_edition_id=edition.id
    join public.seasons season on season.id=heat.season_id
    where season.game_year=4 and season.status='active' for update of edition nowait;
  perform stage.id from public.stages stage
    join public.national_federation_nations_cup_heats heat on heat.race_edition_id=stage.race_edition_id
    join public.seasons season on season.id=heat.season_id
    where season.game_year=4 and season.status='active' for update of stage nowait;
  if exists(
    select 1 from public.national_federation_nations_cup_heats heat
    join public.seasons season on season.id=heat.season_id
    join public.race_editions edition on edition.id=heat.race_edition_id
    join public.stages stage on stage.race_edition_id=edition.id
    where season.game_year=4 and season.status='active'
      and (edition.status not in('planned','registration_open','registration_closed','cancelled')
        or stage.status not in('planned','cancelled') or stage.departure_at<=now()
        or exists(select 1 from public.stage_results r where r.stage_id=stage.id)
        or exists(select 1 from public.race_results r where r.race_edition_id=edition.id)
        or exists(select 1 from public.official_stage_simulations s where s.stage_id=stage.id)
        or exists(select 1 from public.official_stage_simulation_claims c where c.stage_id=stage.id))
  ) then raise exception 'Olympic programme already started, claimed or simulated: no rewrite permitted'; end if;
end;
$preflight$;

create or replace function public.federation_selection_slot_is_available(p_slot_key text, p_game_year integer)
returns boolean language sql immutable strict set search_path='' as $$
  select p_game_year<4 or p_game_year%4<>0
    or p_slot_key not in('nc-mountain','nc-sprint','nc-cobbles','nc-time-trial');
$$;
create or replace function public.federation_selection_slot_label(p_slot_key text, p_label text, p_game_year integer)
returns text language sql immutable strict set search_path='' as $$
  select case when p_game_year>=4 and p_game_year%4=0 and p_slot_key='nc-hills'
    then 'Jeux quadriennaux · Course en ligne' else p_label end;
$$;
create or replace function public.get_federation_professional_event_profile_segments(p_slot_key text, p_game_year integer)
returns table(segment_number smallint, distance_km numeric, terrain_type text, surface_type text, average_gradient_pct numeric)
language sql immutable strict set search_path='' as $$
  select route.* from (values
    (1::smallint, 40::numeric, 'flat', 'asphalt', 0::numeric),
    (2::smallint, 5::numeric, 'climb', 'asphalt', 4::numeric),
    (3::smallint, 5::numeric, 'descent', 'asphalt', -4::numeric),
    (4::smallint, 6::numeric, 'flat', 'cobbles', 0::numeric),
    (5::smallint, 10::numeric, 'flat', 'asphalt', 0::numeric),
    (6::smallint, 9::numeric, 'climb', 'asphalt', 6.5::numeric),
    (7::smallint, 9::numeric, 'descent', 'asphalt', -6.5::numeric),
    (8::smallint, 12::numeric, 'flat', 'asphalt', 0::numeric),
    (9::smallint, 4::numeric, 'climb', 'asphalt', 5::numeric),
    (10::smallint, 4::numeric, 'descent', 'asphalt', -5::numeric),
    (11::smallint, 7::numeric, 'flat', 'cobbles', 0::numeric),
    (12::smallint, 13::numeric, 'flat', 'asphalt', 0::numeric),
    (13::smallint, 10::numeric, 'climb', 'asphalt', 6::numeric),
    (14::smallint, 10::numeric, 'descent', 'asphalt', -6::numeric),
    (15::smallint, 14::numeric, 'flat', 'asphalt', 0::numeric),
    (16::smallint, 3::numeric, 'climb', 'asphalt', 5.5::numeric),
    (17::smallint, 3::numeric, 'descent', 'asphalt', -5.5::numeric),
    (18::smallint, 6::numeric, 'flat', 'cobbles', 0::numeric),
    (19::smallint, 8::numeric, 'climb', 'asphalt', 7::numeric),
    (20::smallint, 8::numeric, 'descent', 'asphalt', -7::numeric),
    (21::smallint, 8::numeric, 'flat', 'asphalt', 0::numeric)
  ) route(segment_number,distance_km,terrain_type,surface_type,average_gradient_pct)
  where p_game_year>=4 and p_game_year%4=0 and p_slot_key='nc-hills'
  union all
  select legacy.* from public.get_professional_nations_cup_profile_segments(p_slot_key) legacy
  where not(p_game_year>=4 and p_game_year%4=0)
  order by segment_number;
$$;
revoke all on function public.federation_selection_slot_is_available(text,integer),
  public.federation_selection_slot_label(text,text,integer),
  public.get_federation_professional_event_profile_segments(text,integer) from public,anon,authenticated;
grant execute on function public.federation_selection_slot_is_available(text,integer),
  public.federation_selection_slot_label(text,text,integer),
  public.get_federation_professional_event_profile_segments(text,integer) to service_role;

-- Patch the latest installed functions in place, preserving permissions,
-- DS approval, nationality-independent ownership checks, deadlines and locks.
do $patch$
declare v_patch record; v_definition text; v_count integer;
begin
  for v_patch in select * from (values
    ('public.get_national_federation_selection_target(uuid,uuid,text)', $before$  where slot.slot_key = p_slot_key$before$, $after$  where public.federation_selection_slot_is_available(slot.slot_key, (select s.game_year from public.seasons s where s.id=p_season_id))
    and slot.slot_key = p_slot_key$after$, 1),
    ('public.get_national_federation_selection_schedule(uuid,uuid)', $before$  select slot.slot_key, slot.label, slot.rider_category,$before$, $after$  select slot.slot_key, public.federation_selection_slot_label(slot.slot_key, slot.label, season.game_year), slot.rider_category,$after$, 1),
    ('public.get_national_federation_selection_schedule(uuid,uuid)', $before$  ) as deadline;$before$, $after$  ) as deadline
  where public.federation_selection_slot_is_available(slot.slot_key, season.game_year);$after$, 1),
    ('public.save_national_federation_preselection(text,text,uuid[])', $before$  if v_slot.slot_key is null then$before$, $after$  if v_slot.slot_key is null or not public.federation_selection_slot_is_available(v_slot.slot_key, v_season.game_year) then$after$, 1),
    ('public.save_national_federation_preselection(text,text,uuid[])', $before$and other_list.slot_key <> v_slot.slot_key$before$, $after$and other_list.slot_key <> v_slot.slot_key
      and public.federation_selection_slot_is_available(other_list.slot_key, v_season.game_year)$after$, 1),
    ('public.prepare_due_automatic_federation_professional_lineups(timestamp with time zone)', $before$and other_list.id <> v_list.id$before$, $after$and other_list.id <> v_list.id
                and public.federation_selection_slot_is_available(other_list.slot_key, v_season.game_year)$after$, 1),
    ('public.prepare_due_automatic_federation_professional_lineups(timestamp with time zone)', $before$case v_slot.profile_label$before$, $after$case (case when v_season.game_year % 4 = 0 and v_slot.slot_key = 'nc-hills' then 'Olympique' else v_slot.profile_label end)$after$, 1),
    ('public.prepare_due_automatic_federation_professional_lineups(timestamp with time zone)', $before$when 'Montagne' then$before$, $after$when 'Olympique' then rating.mountain * .26 + rating.hills * .18 + rating.cobbles * .16
          + rating.endurance * .15 + rating.resistance * .10 + rating.sprint * .09 + rating.acceleration * .06
        when 'Montagne' then$after$, 1),
    ('public.refill_national_federation_professional_selection(uuid,timestamp with time zone)', $before$and other_list.id <> v_list.id$before$, $after$and other_list.id <> v_list.id
                and public.federation_selection_slot_is_available(other_list.slot_key, v_season.game_year)$after$, 1),
    ('public.refill_national_federation_professional_selection(uuid,timestamp with time zone)', $before$case v_slot.profile_label$before$, $after$case (case when v_season.game_year % 4 = 0 and v_slot.slot_key = 'nc-hills' then 'Olympique' else v_slot.profile_label end)$after$, 1),
    ('public.refill_national_federation_professional_selection(uuid,timestamp with time zone)', $before$when 'Montagne' then$before$, $after$when 'Olympique' then rating.mountain * .26 + rating.hills * .18 + rating.cobbles * .16
          + rating.endurance * .15 + rating.resistance * .10 + rating.sprint * .09 + rating.acceleration * .06
        when 'Montagne' then$after$, 1),
    ('public.prepare_due_automatic_federation_professional_lineups(timestamp with time zone)', $before$and slot.active_from_game_year <= v_season.game_year$before$, $after$and slot.active_from_game_year <= v_season.game_year
      and public.federation_selection_slot_is_available(slot.slot_key, v_season.game_year)$after$, 1),
    ('public.refill_national_federation_professional_selection(uuid,timestamp with time zone)', $before$or v_slot.rider_category <> 'professional'$before$, $after$or v_slot.rider_category <> 'professional'
     or not public.federation_selection_slot_is_available(v_slot.slot_key, v_season.game_year)$after$, 1),
    ('public.save_national_federation_preselection(text,text,uuid[])', $before$v_slot.label$before$, $after$public.federation_selection_slot_label(v_slot.slot_key, v_slot.label, v_season.game_year)$after$, 1),
    ('public.publish_national_federation_preselection(text,text)', $before$v_slot.label$before$, $after$public.federation_selection_slot_label(v_slot.slot_key, v_slot.label, v_season.game_year)$after$, 2),
    ('public.respond_to_national_federation_preselection(uuid,boolean)', $before$v_slot.label$before$, $after$public.federation_selection_slot_label(v_slot.slot_key, v_slot.label, v_season.game_year)$after$, 1),
    ('public.prepare_due_automatic_federation_professional_lineups(timestamp with time zone)', $before$v_slot.label$before$, $after$public.federation_selection_slot_label(v_slot.slot_key, v_slot.label, v_season.game_year)$after$, 2),
    ('public.refill_national_federation_professional_selection(uuid,timestamp with time zone)', $before$v_slot.label$before$, $after$public.federation_selection_slot_label(v_slot.slot_key, v_slot.label, v_season.game_year)$after$, 2),
    ('public.ensure_professional_nations_cup(uuid)', $before$and award.event_type = 'nations_cup_pro'$before$, $after$and award.event_type = case when v_season.game_year % 4 = 0 then 'quadrennial_games_pro' else 'nations_cup_pro' end$after$, 1),
    ('public.ensure_professional_nations_cup(uuid)', $before$    )
  loop
    for v_pool in$before$, $after$    )
    where public.federation_selection_slot_is_available(definition.slot_key, v_season.game_year)
  loop
    if v_season.game_year % 4 = 0 then
      v_definition.base_name := 'Jeux quadriennaux · Course en ligne';
      v_definition.base_short_name := 'JQ Route';
      v_definition.profile_type := 'mixed';
      v_definition.distance_km := 194;
    end if;
    for v_pool in$after$, 1),
    ('public.ensure_professional_nations_cup(uuid)', $before$name = excluded.name,
        short_name = excluded.short_name,$before$, $after$name = case when v_season.game_year % 4 = 0 then public.races.name else excluded.name end,
        short_name = case when v_season.game_year % 4 = 0 then public.races.short_name else excluded.short_name end,$after$, 1),
    ('public.ensure_professional_nations_cup(uuid)', $before$from public.get_professional_nations_cup_profile_segments(
          v_definition.slot_key$before$, $after$from public.get_federation_professional_event_profile_segments(
          v_definition.slot_key, v_season.game_year$after$, 1),
    ('public.seed_nations_cup_assignments_for_season(uuid)', $before$and race.status = 'active';$before$, $after$and race.status = 'active'
      and edition.status <> 'cancelled';$after$, 1),
    ('public.seed_nations_cup_assignments_for_season(uuid)', $before$v_expected_events < 5$before$, $after$v_expected_events < (case when v_source.game_year % 4 = 0 then 1 else 5 end)$after$, 1),
    ('public.seed_nations_cup_assignments_for_season(uuid)', $before$v_expected_events >= 5$before$, $after$v_expected_events >= (case when v_source.game_year % 4 = 0 then 1 else 5 end)$after$, 1)
  ) patch(signature, previous, replacement, expected_count)
  loop
    select replace(pg_get_functiondef(v_patch.signature::regprocedure),chr(13),'') into v_definition;
    v_count := (length(v_definition)-length(replace(v_definition,v_patch.previous,'')))/length(v_patch.previous);
    if v_count<>v_patch.expected_count then
      raise exception 'Olympic patch anchor drift: % (% instead of %)',v_patch.signature,v_count,v_patch.expected_count;
    end if;
    execute replace(v_definition,v_patch.previous,v_patch.replacement);
  end loop;
end;
$patch$;

-- Private, targeted snapshot for recovery; no gameplay rows are deleted.
create table public.quadrennial_programme_migration_audits(
  season_id uuid primary key references public.seasons(id), snapshot jsonb not null,
  migrated_at timestamptz not null default now()
);
alter table public.quadrennial_programme_migration_audits enable row level security;
revoke all on public.quadrennial_programme_migration_audits from public,anon,authenticated;
grant select,insert on public.quadrennial_programme_migration_audits to service_role;
insert into public.quadrennial_programme_migration_audits(season_id,snapshot)
select season.id,jsonb_build_object(
  'editions',(select jsonb_agg(to_jsonb(e)) from public.race_editions e join public.national_federation_nations_cup_heats h on h.race_edition_id=e.id where h.season_id=season.id),
  'stages',(select jsonb_agg(to_jsonb(s)) from public.stages s join public.national_federation_nations_cup_heats h on h.race_edition_id=s.race_edition_id where h.season_id=season.id),
  'segments',(select jsonb_agg(to_jsonb(s)) from public.stage_segments s join public.stages t on t.id=s.stage_id join public.national_federation_nations_cup_heats h on h.race_edition_id=t.race_edition_id where h.season_id=season.id),
  'lists',(select jsonb_agg(to_jsonb(l)) from public.national_federation_selection_lists l where l.season_id=season.id and l.slot_key in('nc-mountain','nc-hills','nc-sprint','nc-cobbles','nc-time-trial')),
  'members',(select jsonb_agg(to_jsonb(m)) from public.national_federation_selection_members m join public.national_federation_selection_lists l on l.id=m.selection_list_id where l.season_id=season.id and l.slot_key in('nc-mountain','nc-hills','nc-sprint','nc-cobbles','nc-time-trial')),
  'registrations',(select jsonb_agg(to_jsonb(r)) from public.race_registrations r join public.national_federation_nations_cup_heats h on h.race_edition_id=r.race_edition_id where h.season_id=season.id),
  'rosters',(select jsonb_agg(to_jsonb(r)) from public.race_rosters r join public.race_registrations g on g.id=r.race_registration_id join public.national_federation_nations_cup_heats h on h.race_edition_id=g.race_edition_id where h.season_id=season.id)
) from public.seasons season where season.game_year=4 and season.status='active'
on conflict(season_id) do nothing;

-- Retire four obsolete disciplines, retaining history instead of deleting IDs.
update public.race_rosters r set status='withdrawn'
from public.race_registrations g,public.national_federation_nations_cup_heats h,public.seasons s
where g.id=r.race_registration_id and h.race_edition_id=g.race_edition_id and s.id=h.season_id
  and s.game_year=4 and s.status='active' and h.slot_key<>'nc-hills'
  and r.status in('selected','confirmed');
update public.race_registrations g set status='withdrawn',decided_at=now()
from public.national_federation_nations_cup_heats h,public.seasons s
where h.race_edition_id=g.race_edition_id and s.id=h.season_id
  and s.game_year=4 and s.status='active' and h.slot_key<>'nc-hills' and g.status<>'withdrawn';
update public.stages t set status='cancelled'
from public.national_federation_nations_cup_heats h,public.seasons s
where t.race_edition_id=h.race_edition_id and s.id=h.season_id
  and s.game_year=4 and s.status='active' and h.slot_key<>'nc-hills';
update public.race_editions e set status='cancelled'
from public.national_federation_nations_cup_heats h,public.seasons s
where e.id=h.race_edition_id and s.id=h.season_id
  and s.game_year=4 and s.status='active' and h.slot_key<>'nc-hills';
update public.national_federation_selection_members m set response_status='declined',responded_at=now()
from public.national_federation_selection_lists l,public.seasons s
where l.id=m.selection_list_id and s.id=l.season_id and s.game_year=4 and s.status='active'
  and l.slot_key in('nc-mountain','nc-sprint','nc-cobbles','nc-time-trial') and m.response_status<>'declined';
update public.national_federation_selection_lists l set status='finalized',updated_at=now()
from public.seasons s where s.id=l.season_id and s.game_year=4 and s.status='active'
  and l.slot_key in('nc-mountain','nc-sprint','nc-cobbles','nc-time-trial');
update public.sporting_director_messages message set archived_at=coalesce(message.archived_at,now())
from public.national_federation_selection_members m,public.national_federation_selection_lists l,public.seasons s
where l.id=m.selection_list_id and s.id=l.season_id and s.game_year=4 and s.status='active'
  and l.slot_key in('nc-mountain','nc-sprint','nc-cobbles','nc-time-trial')
  and message.sporting_director_id=m.owner_director_id and message.season_id=s.id
  and (message.source_reference='federation-auto-callup:'||m.id::text
    or message.source_reference like 'federation-selection:'||m.id::text||':%');

-- No replacement callups now. Normal J23 jobs and DS approvals stay in control.
select public.ensure_professional_nations_cup(id) from public.seasons where game_year=4 and status='active';
notify pgrst,'reload schema';
commit;
