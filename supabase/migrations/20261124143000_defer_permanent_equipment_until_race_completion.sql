begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

alter table public.rider_equipment_pending_assignments
  alter column equipment_item_id drop not null,
  add column blocking_race_edition_ids uuid[] not null default '{}';

-- A completed stage does not release a rider's permanent kit during a tour.
-- The timestamp is indicative only; official edition completion releases it.
create function private.get_rider_equipment_change_blockers(
  p_team_season_id uuid, p_rider_id uuid, p_now timestamptz default now()
)
returns table(blocking_race_edition_ids uuid[], effective_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(blocked.id order by blocked.id), '{}'::uuid[]),
    greatest(p_now, coalesce(max(blocked.estimated_finish), p_now))
  from (
    select distinct edition.id, schedule.estimated_finish
    from public.race_rosters as roster
    join public.team_seasons as owning_team on owning_team.id=p_team_season_id
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
      and (registration.team_season_id=p_team_season_id or registration.team_season_id is null)
      and registration.status in ('pending','accepted')
    join public.race_editions as edition
      on edition.id = registration.race_edition_id
      and edition.season_id=owning_team.season_id
      and edition.status not in ('completed','cancelled')
    left join lateral (
      select min(stage.departure_at) as first_departure,
        max(stage.departure_at + make_interval(mins => greatest(8,least(48,round(stage.distance_km/6.0)))::integer)) as estimated_finish
      from public.stages as stage
      where stage.race_edition_id = edition.id and stage.status <> 'cancelled'
    ) as schedule on true
    where roster.rider_id = p_rider_id
      and roster.status in ('selected','confirmed')
      and (edition.status = 'in_progress'
        or schedule.first_departure <= p_now + interval '5 minutes'
        or exists (select 1 from public.official_stage_simulations as frozen
          where frozen.race_edition_id = edition.id))
  ) as blocked;
$$;
revoke all on function private.get_rider_equipment_change_blockers(uuid,uuid,timestamptz)
  from public, anon, authenticated;
grant execute on function private.get_rider_equipment_change_blockers(uuid,uuid,timestamptz)
  to service_role;

create or replace function public.settle_due_equipment_assignments(p_team_season_id uuid)
returns integer language plpgsql security definer set search_path = ''
set statement_timeout = '15s'
as $$
declare v_settled integer;
begin
  if p_team_season_id is null then return 0; end if;
  -- Same order as writes and resale: team, pending, permanent assignments.
  perform 1 from public.team_seasons where id=p_team_season_id for update;
  delete from public.rider_equipment_pending_assignments as pending
  where pending.team_season_id=p_team_season_id and not exists (
    select 1 from public.team_seasons as team_season
    join public.rider_contracts as contract on contract.team_id=team_season.team_id
      and contract.rider_id=pending.rider_id and contract.status='active'
    where team_season.id=p_team_season_id
  );
  -- A departed mechanic or expired supplier cannot make a queued request
  -- invalid at a later race completion. Keep the worn loadout unchanged.
  delete from public.rider_equipment_pending_assignments as pending
  where pending.team_season_id=p_team_season_id and pending.equipment_item_id is not null
    and not exists (
      select 1 from public.team_seasons as team_season
      join public.seasons as season on season.id=team_season.season_id
      join public.equipment_catalog_items as item on item.id=pending.equipment_item_id
        and item.status='active'
      where team_season.id=p_team_season_id
        and public.equipment_slots_are_compatible(team_season.team_id,pending.slot_type,item.slot_type)
        and (item.acquisition_channel<>'equipment_partner' or exists (
          select 1 from public.equipment_partner_contracts as partner
          join public.seasons as start_season on start_season.id=partner.start_season_id
          join public.seasons as end_season on end_season.id=partner.end_season_id
          join public.equipment_partner_products as product on product.supplier_key=partner.supplier_key
            and product.equipment_item_id=item.id
            and (product.offer_type='core' or partner.reputation_extra_item_id=product.equipment_item_id)
          where partner.team_id=team_season.team_id and partner.status='active'
            and partner.supplier_key=item.supplier_key
            and season.game_year between start_season.game_year and end_season.game_year
        ))
    );
  -- A second race may have frozen before a delayed worker got this request.
  -- Remember that blocker too so its own completion can release the queue.
  with riders as materialized (
    select distinct pending.rider_id from public.rider_equipment_pending_assignments as pending
    where pending.team_season_id=p_team_season_id
  ), blockers as materialized (
    select rider.rider_id,current_blockers.blocking_race_edition_ids,current_blockers.effective_at
    from riders as rider cross join lateral private.get_rider_equipment_change_blockers(
      p_team_season_id,rider.rider_id,now()
    ) as current_blockers
  )
  update public.rider_equipment_pending_assignments as pending
  set blocking_race_edition_ids=array(select distinct edition_id
      from unnest(pending.blocking_race_edition_ids||blockers.blocking_race_edition_ids) as ids(edition_id)
      order by edition_id),
    effective_at=greatest(pending.effective_at,blockers.effective_at)
  from blockers where pending.team_season_id=p_team_season_id
    and pending.rider_id=blockers.rider_id
    and cardinality(blockers.blocking_race_edition_ids)>0
    and not pending.blocking_race_edition_ids @> blockers.blocking_race_edition_ids;
  with due as materialized (
    select pending.*
    from public.rider_equipment_pending_assignments as pending
    where pending.team_season_id=p_team_season_id
      and (pending.effective_at<=now() or cardinality(pending.blocking_race_edition_ids)>0)
      and not exists (
        select 1 from public.race_editions as edition
        where edition.id=any(pending.blocking_race_edition_ids)
          and edition.status not in ('completed','cancelled')
      )
      and not exists (
        select 1 from private.get_rider_equipment_change_blockers(
          pending.team_season_id,pending.rider_id,now()
        ) as blockers where cardinality(blockers.blocking_race_edition_ids)>0
      )
    order by pending.effective_at,pending.requested_at,pending.id
    for update of pending
  ), applied as (
    insert into public.rider_equipment_assignments(rider_id,slot_type,equipment_item_id,equipped_at)
    select due.rider_id,due.slot_type,due.equipment_item_id,now()
    from due where due.equipment_item_id is not null
    on conflict(rider_id,slot_type) do update set
      equipment_item_id=excluded.equipment_item_id,equipped_at=excluded.equipped_at
    returning rider_id,slot_type
  ), unequipped as (
    delete from public.rider_equipment_assignments as equipped
    using due where due.equipment_item_id is null
      and equipped.rider_id=due.rider_id and equipped.slot_type=due.slot_type
    returning equipped.rider_id,equipped.slot_type
  ), removed as (
    delete from public.rider_equipment_pending_assignments as pending
    using due where pending.id=due.id
      and (due.equipment_item_id is null or exists (
        select 1 from applied where applied.rider_id=due.rider_id and applied.slot_type=due.slot_type
      ))
    returning pending.id
  ) select count(*)::integer into v_settled from removed;
  return coalesce(v_settled,0);
end;
$$;

create or replace function public.settle_all_due_equipment_assignments()
returns integer language plpgsql security definer set search_path = ''
set statement_timeout = '30s'
as $$
declare v_team record; v_settled integer := 0;
begin
  for v_team in
    select team_season.id from public.team_seasons as team_season
    where exists (
      select 1 from public.rider_equipment_pending_assignments as pending
      where pending.team_season_id=team_season.id
        and (pending.effective_at<=now() or cardinality(pending.blocking_race_edition_ids)>0)
    )
    order by team_season.id for update of team_season skip locked
  loop
    v_settled := v_settled + public.settle_due_equipment_assignments(v_team.id);
  end loop;
  return v_settled;
end;
$$;

-- Bulk validation is patched below from the live definition, preserving its
-- ownership, wheel compatibility, partner, inventory and timeout policies.

do $deferred_equipment_bulk$
declare v_definition text; v_old text;
begin
  v_definition:=replace(pg_get_functiondef('public.save_current_team_equipment_assignments(jsonb)'::regprocedure),chr(13),'');
  v_old:=replace($old0$  if exists (
    select 1
    from jsonb_to_recordset(p_assignments) as requested(
      "riderId" uuid,
      slot text,
      "equipmentItemId" uuid
    )
    left join public.rider_equipment_assignments as current_assignment
      on current_assignment.rider_id = requested."riderId"
     and current_assignment.slot_type = requested.slot
    where current_assignment.equipment_item_id
      is distinct from requested."equipmentItemId"
      and exists (
        select 1
        from public.race_rosters as roster
        join public.race_registrations as registration
          on registration.id = roster.race_registration_id
         and registration.team_season_id = v_context.team_season_id
         and registration.status in ('pending', 'accepted')
        join public.race_editions as edition
          on edition.id = registration.race_edition_id
         and edition.status not in ('completed', 'cancelled')
        join public.stages as stage
          on stage.race_edition_id = edition.id
         and stage.status not in ('completed', 'cancelled')
         and stage.departure_at is not null
        where roster.rider_id = requested."riderId"
          and roster.status in ('selected', 'confirmed')
          and now() >= stage.departure_at - interval '5 minutes'
          and now() < stage.departure_at
            + make_interval(
                mins => greatest(
                  8,
                  least(48, round(stage.distance_km / 6.0))
                )::integer
              )
      )
  ) then
    raise exception 'Le matériel d’un coureur sélectionné est figé jusqu’à la fin de sa course.';
  end if;$old0$,chr(13),'');
  if length(v_definition)-length(replace(v_definition,v_old,'')) <> 1*length(v_old) then
    raise exception 'Unexpected deferred equipment bulk marker 0';
  end if;
  v_definition:=replace(v_definition,v_old,replace($new0$  -- Decorate each validated request once. Returning to the currently worn
  -- item cancels its pending change, even while the rider is racing.
  with requested_riders as materialized (
    select distinct (entry.value->>'riderId')::uuid as rider_id
    from jsonb_array_elements(p_assignments) as entry(value)
  ), blockers_by_rider as materialized (
    select rider.rider_id,blockers.blocking_race_edition_ids,blockers.effective_at
    from requested_riders as rider
    cross join lateral private.get_rider_equipment_change_blockers(
      v_context.team_season_id,rider.rider_id,now()
    ) as blockers
  )
  select jsonb_agg(entry.value || jsonb_build_object(
    'blockingRaceEditionIds',case when current_assignment.equipment_item_id
      is not distinct from nullif(entry.value->>'equipmentItemId','')::uuid
      then '{}'::uuid[] else blockers.blocking_race_edition_ids end,
    'effectiveAt',blockers.effective_at
  )) into p_assignments
  from jsonb_array_elements(p_assignments) as entry(value)
  left join public.rider_equipment_assignments as current_assignment
    on current_assignment.rider_id=(entry.value->>'riderId')::uuid
    and current_assignment.slot_type=entry.value->>'slot'
  join blockers_by_rider as blockers on blockers.rider_id=(entry.value->>'riderId')::uuid;$new0$,chr(13),''));
  v_old:=replace($old1$  -- Les lignes déjà présentes sont verrouillées dans un ordre stable.$old1$,chr(13),'');
  if length(v_definition)-length(replace(v_definition,v_old,'')) <> 1*length(v_old) then
    raise exception 'Unexpected deferred equipment bulk marker 1';
  end if;
  v_definition:=replace(v_definition,v_old,replace($new1$  perform 1 from public.rider_equipment_pending_assignments as pending
  where pending.team_season_id=v_context.team_season_id
  order by pending.rider_id,pending.slot_type for update;

  -- Les lignes déjà présentes sont verrouillées dans un ordre stable.$new1$,chr(13),''));
  v_old:=replace($old2$      where requested."riderId" = equipped.rider_id
        and requested.slot = equipped.slot_type
    )

    union all$old2$,chr(13),'');
  if length(v_definition)-length(replace(v_definition,v_old,'')) <> 1*length(v_old) then
    raise exception 'Unexpected deferred equipment bulk marker 2';
  end if;
  v_definition:=replace(v_definition,v_old,replace($new2$      where requested."riderId" = equipped.rider_id
        and requested.slot = equipped.slot_type
        and coalesce(cardinality(requested."blockingRaceEditionIds"),0)=0
    )

    union all

    select pending.rider_id,pending.slot_type,pending.equipment_item_id
    from public.rider_equipment_pending_assignments as pending
    join active_riders as rider on rider.rider_id=pending.rider_id
    where pending.team_season_id=v_context.team_season_id
      and pending.equipment_item_id is not null
      and not exists(select 1 from requested
        where requested."riderId"=pending.rider_id and requested.slot=pending.slot_type)

    union all$new2$,chr(13),''));
  v_old:=replace($old3$      and requested."equipmentItemId" is null
  );$old3$,chr(13),'');
  if length(v_definition)-length(replace(v_definition,v_old,'')) <> 1*length(v_old) then
    raise exception 'Unexpected deferred equipment bulk marker 3';
  end if;
  v_definition:=replace(v_definition,v_old,replace($new3$      and requested."equipmentItemId" is null
      and coalesce(cardinality(requested."blockingRaceEditionIds"),0)=0
  );$new3$,chr(13),''));
  v_old:=replace($old4$  where requested."equipmentItemId" is not null
  on conflict (rider_id, slot_type) do update set$old4$,chr(13),'');
  if length(v_definition)-length(replace(v_definition,v_old,'')) <> 1*length(v_old) then
    raise exception 'Unexpected deferred equipment bulk marker 4';
  end if;
  v_definition:=replace(v_definition,v_old,replace($new4$  where requested."equipmentItemId" is not null
    and coalesce(cardinality(requested."blockingRaceEditionIds"),0)=0
  on conflict (rider_id, slot_type) do update set$new4$,chr(13),''));
  v_old:=replace($old5$  return v_assignment_count;$old5$,chr(13),'');
  if length(v_definition)-length(replace(v_definition,v_old,'')) <> 1*length(v_old) then
    raise exception 'Unexpected deferred equipment bulk marker 5';
  end if;
  v_definition:=replace(v_definition,v_old,replace($new5$  insert into public.rider_equipment_pending_assignments(
    team_season_id,rider_id,slot_type,equipment_item_id,effective_at,blocking_race_edition_ids
  )
  select v_context.team_season_id,requested."riderId",requested.slot,
    requested."equipmentItemId",requested."effectiveAt",requested."blockingRaceEditionIds"
  from jsonb_to_recordset(p_assignments) as requested(
    "riderId" uuid,slot text,"equipmentItemId" uuid,
    "blockingRaceEditionIds" uuid[],"effectiveAt" timestamptz
  )
  where cardinality(requested."blockingRaceEditionIds")>0;

  return v_assignment_count;$new5$,chr(13),''));
  v_old:=replace($old6$"equipmentItemId" uuid
$old6$,chr(13),'');
  if length(v_definition)-length(replace(v_definition,v_old,'')) <> 11*length(v_old) then
    raise exception 'Unexpected deferred equipment bulk marker 6';
  end if;
  v_definition:=replace(v_definition,v_old,replace($new6$"equipmentItemId" uuid,
      "blockingRaceEditionIds" uuid[],
      "effectiveAt" timestamptz
$new6$,chr(13),''));
  execute v_definition;
end;
$deferred_equipment_bulk$;

do $pending_equipment_removal$
declare v_definition text; v_needle text:=replace($needle$begin
$needle$,chr(13),'');
begin
  v_definition:=replace(pg_get_functiondef('public.enforce_equipment_assignment_slot()'::regprocedure),chr(13),'');
  if strpos(v_definition,'public.equipment_slots_are_compatible')=0
    or length(v_definition)-length(replace(v_definition,v_needle,''))<>length(v_needle)
  then raise exception 'Unexpected pending equipment slot validator'; end if;
  execute replace(v_definition,v_needle,replace($nullable$begin
  if new.equipment_item_id is null and TG_TABLE_SCHEMA='public'
    and TG_TABLE_NAME='rider_equipment_pending_assignments' then return new; end if;
$nullable$,chr(13),''));
end;
$pending_equipment_removal$;

create or replace function public.equip_current_team_rider(
  p_rider_id uuid,p_slot_type text,p_equipment_item_id uuid
)
returns timestamptz language plpgsql security definer set search_path = ''
as $$
declare v_effective_at timestamptz;
begin
  if p_equipment_item_id is null then
    raise exception 'Ce matériel ne correspond pas à cet emplacement.';
  end if;
  perform public.save_current_team_equipment_assignments(jsonb_build_array(jsonb_build_object(
    'riderId',p_rider_id,'slot',p_slot_type,'equipmentItemId',p_equipment_item_id
  )));
  select pending.effective_at into v_effective_at
  from public.rider_equipment_pending_assignments as pending
  where pending.rider_id=p_rider_id and pending.slot_type=p_slot_type;
  return coalesce(v_effective_at,now());
end;
$$;

create or replace function public.unequip_current_team_rider(p_rider_id uuid,p_slot_type text)
returns timestamptz language plpgsql security definer set search_path = ''
as $$
declare v_effective_at timestamptz;
begin
  perform public.save_current_team_equipment_assignments(jsonb_build_array(jsonb_build_object(
    'riderId',p_rider_id,'slot',p_slot_type,'equipmentItemId',null
  )));
  select pending.effective_at into v_effective_at
  from public.rider_equipment_pending_assignments as pending
  where pending.rider_id=p_rider_id and pending.slot_type=p_slot_type;
  return coalesce(v_effective_at,now());
end;
$$;

create index rider_equipment_pending_blocking_editions_idx
  on public.rider_equipment_pending_assignments using gin(blocking_race_edition_ids);

create function private.settle_equipment_after_race_edition_completion()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_team record;
begin
  for v_team in
    select team_season.id from public.team_seasons as team_season
    where exists (
      select 1 from public.rider_equipment_pending_assignments as pending
      where pending.team_season_id=team_season.id
        and pending.blocking_race_edition_ids @> array[new.id]
    )
    order by team_season.id for update of team_season skip locked
  loop
    begin
      perform public.settle_due_equipment_assignments(v_team.id);
    exception when others then
      -- A pending loadout must never roll back official race homologation.
      -- Existing maintenance retries only the affected team's queue.
      raise log 'Deferred equipment settlement for team % after edition % failed (%): %',
        v_team.id,new.id,SQLSTATE,SQLERRM;
    end;
  end loop;
  return new;
end;
$$;
revoke all on function private.settle_equipment_after_race_edition_completion()
  from public,anon,authenticated;

create trigger settle_equipment_after_race_edition_completion
after update of status on public.race_editions
for each row when (new.status in ('completed','cancelled') and old.status is distinct from new.status)
execute function private.settle_equipment_after_race_edition_completion();

comment on function public.save_current_team_equipment_assignments(jsonb) is
  'Enregistre les montages permanents; réserve les changements des coureurs en course jusqu’à la fin réelle de toute l’épreuve, sans modifier sa préparation.';
comment on function public.equip_current_team_rider(uuid,text,uuid) is
  'Equipe un coureur ou réserve son nouveau matériel après la fin réelle de son épreuve en cours.';
comment on function public.unequip_current_team_rider(uuid,text) is
  'Retire le matériel ou programme son retrait après la fin réelle de son épreuve en cours.';

-- Reselling may cancel a future request, but cannot remove the loadout still
-- inherited by the remaining stages of a running tour.
do $protect_worn_equipment_resale$
declare
  v_definition text;
  v_start integer;
  v_end integer;
  v_anchor text:=replace($anchor$    if exists(
      select 1 from jsonb_to_recordset(v_unequip)$anchor$,chr(13),'');
  v_next text:='    delete from public.rider_equipment_pending_assignments as pending';
  v_old text;
begin
  v_definition:=replace(pg_get_functiondef('public.sell_current_team_equipment_batch(jsonb,uuid)'::regprocedure),chr(13),'');
  if length(v_definition)-length(replace(v_definition,v_anchor,''))<>length(v_anchor)
    or length(v_definition)-length(replace(v_definition,v_next,''))<>length(v_next)
  then raise exception 'Unexpected deferred equipment resale validator'; end if;
  v_start:=strpos(v_definition,v_anchor);
  v_end:=strpos(v_definition,v_next);
  v_old:=substring(v_definition from v_start for v_end-v_start);
  if v_end<=v_start or strpos(v_old,'stage.departure_at')=0
    or strpos(v_old,'Le matériel d’un coureur à déséquiper est figé')=0
  then raise exception 'Unexpected deferred equipment resale body'; end if;
  execute replace(v_definition,v_old,replace($guard$    if exists(
      select 1 from jsonb_to_recordset(v_unequip) as removed("riderId" uuid,slot text)
      cross join lateral private.get_rider_equipment_change_blockers(
        v_context.team_season_id,removed."riderId",now()
      ) as blockers
      where cardinality(blockers.blocking_race_edition_ids)>0
    ) then raise exception 'Le matériel d’un coureur à déséquiper est figé jusqu’à la fin de sa course.'; end if;
$guard$,chr(13),''));
end;
$protect_worn_equipment_resale$;

notify pgrst,'reload schema';
commit;
