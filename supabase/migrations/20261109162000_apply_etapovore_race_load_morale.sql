begin;
set local application_name = 'etapovore-race-load-morale-install';
set local statement_timeout = '5s';
set local lock_timeout = '500ms';

-- Track applied excess slots from the first bonus onward, including a bonus
-- clipped to zero. Earlier ordinary debits retain the existing accounting.
-- The result ID has no FK: the delete trigger needs the slot after deletion.
create table private.rider_etapovore_race_load_slots (
  rider_id uuid not null,
  season_id uuid not null,
  stage_result_id uuid not null,
  slot_order bigint generated always as identity,
  is_bonus boolean not null,
  applied_delta numeric(3,2) not null,
  primary key (rider_id, season_id, stage_result_id),
  foreign key (rider_id, season_id)
    references public.rider_season_ratings(rider_id, season_id) on delete cascade,
  check (
    (is_bonus and applied_delta between 0 and 0.5)
    or (not is_bonus and applied_delta between -1 and 0)
  )
);
create index rider_etapovore_race_load_slots_order_idx
  on private.rider_etapovore_race_load_slots (rider_id, season_id, slot_order);
revoke all on private.rider_etapovore_race_load_slots from public, anon, authenticated, service_role;

create function private.adjust_rider_season_race_load(
  p_rider_id uuid, p_season_id uuid, p_stage_id uuid, p_stage_result_id uuid, p_delta integer
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_season record;
  v_rating record;
  v_slot private.rider_etapovore_race_load_slots%rowtype;
  v_days integer;
  v_old_excess integer;
  v_new_excess integer;
  v_debit numeric;
  v_delta numeric := 0;
  v_applied numeric := 0;
  v_event jsonb;
  v_day_id uuid;
  v_bonus boolean := false;
  v_track_slot boolean := false;
  v_tracked_count integer;
  v_tracked_debit numeric;
begin
  select game_year,status,current_day_number into v_season
  from public.seasons where id=p_season_id;
  if coalesce(v_season.game_year,0)<5 or p_delta not in (-1,1) then return; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_rider_id::text,0));
  select season_race_days,race_load_morale_debit into v_rating
  from public.rider_season_ratings where rider_id=p_rider_id and season_id=p_season_id for update;
  if not found then return; end if;

  v_days := greatest(0,v_rating.season_race_days+p_delta);
  v_debit := v_rating.race_load_morale_debit;
  v_old_excess := greatest(0,v_rating.season_race_days-30);
  v_new_excess := greatest(0,v_days-30);

  if v_new_excess > v_old_excess and v_season.status='active' then
    select exists (
      select 1
      from public.rider_special_abilities as ability
      join public.stages as stage on stage.id=p_stage_id
      where ability.rider_id=p_rider_id and ability.ability_code='etapovore'
        and ability.unlocked_at<=stage.departure_at
    ) into v_bonus;
    v_delta := case when v_bonus then 0.5 else -1 end;
    v_track_slot := v_bonus or exists (
      select 1 from private.rider_etapovore_race_load_slots as slot
      where slot.rider_id=p_rider_id and slot.season_id=p_season_id
    );
  elsif v_new_excess < v_old_excess then
    select * into v_slot
    from private.rider_etapovore_race_load_slots as slot
    where slot.rider_id=p_rider_id and slot.season_id=p_season_id
      and slot.stage_result_id=p_stage_result_id;

    if not found then
      select count(*)::integer,coalesce(sum(-least(slot.applied_delta,0)),0)
      into v_tracked_count,v_tracked_debit
      from private.rider_etapovore_race_load_slots as slot
      where slot.rider_id=p_rider_id and slot.season_id=p_season_id;

      if v_old_excess > v_tracked_count then
        v_delta := least(1,greatest(0,v_debit-v_tracked_debit));
      else
        -- Removing a start from the first 30 makes the oldest excess slot
        -- neutral. Consume its effect even when it was clipped to zero.
        select * into v_slot
        from private.rider_etapovore_race_load_slots as slot
        where slot.rider_id=p_rider_id and slot.season_id=p_season_id
        order by slot.slot_order
        limit 1;
      end if;
    end if;

    if v_slot.stage_result_id is not null then
      delete from private.rider_etapovore_race_load_slots as slot
      where slot.rider_id=p_rider_id and slot.season_id=p_season_id
        and slot.stage_result_id=v_slot.stage_result_id;
      v_bonus := v_slot.is_bonus;
      v_delta := case when v_bonus then -v_slot.applied_delta
        else least(v_debit,-v_slot.applied_delta) end;
    end if;
  end if;

  -- The existing morale engine handles clipping and preserves every other
  -- source of morale. Corrections in sealed seasons never alter old morale.
  if v_season.status='active' and v_delta<>0 then
    select id into v_day_id from public.season_days
    where season_id=p_season_id and day_number=coalesce(v_season.current_day_number,1);
    if v_day_id is not null then
      v_event:=public.apply_rider_morale_event(
        p_rider_id,v_day_id,'race_load',gen_random_uuid()::text,v_delta,
        case when v_bonus and p_delta=1 then 'Étapovore — '||v_days||' JDC cette saison (seuil : 30)'
          when v_bonus then 'Correction des jours de course — bonus Étapovore retiré'
          when v_delta<0 then 'Calendrier surchargé — '||v_days||' JDC cette saison (seuil : 30)'
          else 'Correction des jours de course — moral restitué' end,
        jsonb_build_object('seasonId',p_season_id,'stageId',p_stage_id,'stageResultId',p_stage_result_id,
          'raceDaysBefore',v_rating.season_race_days,'raceDaysAfter',v_days,'threshold',30,
          'ruleVersion',case when v_bonus then 's5-etapovore-v1' else 's5-race-load-v1' end)
      );
      v_applied:=coalesce((v_event->>'appliedDelta')::numeric,0);
      if p_delta=1 and not v_bonus then
        v_debit:=v_debit-v_applied;
      elsif p_delta=-1 and not v_bonus then
        -- Consume a refund clipped at 100 instead of banking it.
        v_debit:=greatest(0,v_debit-v_delta);
      end if;
    end if;
  end if;

  if v_track_slot then
    insert into private.rider_etapovore_race_load_slots (
      rider_id,season_id,stage_result_id,is_bonus,applied_delta
    ) values (p_rider_id,p_season_id,p_stage_result_id,v_bonus,v_applied);
  end if;

  update public.rider_season_ratings set season_race_days=v_days,
    race_load_morale_debit=least(v_debit,v_new_excess)
  where rider_id=p_rider_id and season_id=p_season_id;
end;
$$;

-- Keep the existing trigger and every participation/idempotence rule.
do $pass_result_identity$
declare
  v_definition text := replace(
    pg_get_functiondef('private.sync_season_race_load_from_stage_result()'::regprocedure),chr(13),''
  );
  v_remove constant text := 'v_old.rider_id,v_old.season_id,old.stage_id,-1';
  v_add constant text := 'v_new.rider_id,v_new.season_id,new.stage_id,1';
begin
  if length(v_definition)-length(replace(v_definition,v_remove,''))<>length(v_remove)
    or length(v_definition)-length(replace(v_definition,v_add,''))<>length(v_add) then
    raise exception 'Unexpected race load trigger signature';
  end if;
  execute replace(
    replace(v_definition,v_remove,'v_old.rider_id,v_old.season_id,old.stage_id,old.id,-1'),
    v_add,'v_new.rider_id,v_new.season_id,new.stage_id,new.id,1'
  );
end;
$pass_result_identity$;

drop function private.adjust_rider_season_race_load(uuid,uuid,uuid,integer);
revoke all on function private.adjust_rider_season_race_load(uuid,uuid,uuid,uuid,integer)
  from public, anon, authenticated, service_role;

commit;
