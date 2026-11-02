begin;
set local application_name = 's5-race-load-morale-install';
set local statement_timeout = '5s';
set local lock_timeout = '500ms';

-- New season rows start at zero; transfers retain the same rider/season row.
-- No S4 result, condition or morale event is recalculated during installation.
alter table public.rider_season_ratings
  add column season_race_days integer not null default 0,
  add column race_load_morale_debit numeric(5,2) not null default 0,
  add constraint rider_season_race_load_valid check (
    season_race_days >= 0 and race_load_morale_debit >= 0
    and race_load_morale_debit <= greatest(0, season_race_days - 30)
  );

-- Extend the audited morale source list without replacing the existing engine.
do $allow_race_load_source$
declare
  v_definition text;
  v_constraint text;
  v_anchor text := '''academy_promotion'', ''manual_adjustment''';
begin
  select replace(pg_get_functiondef('public.apply_rider_morale_event(uuid,uuid,text,text,numeric,text,jsonb)'::regprocedure),chr(13),'') into v_definition;
  if (length(v_definition)-length(replace(v_definition,v_anchor,'')))/length(v_anchor) <> 1 then
    raise exception 'Unexpected morale source validation; review required';
  end if;
  select pg_get_constraintdef(oid) into v_constraint from pg_constraint
  where conrelid='public.rider_morale_events'::regclass and conname='rider_morale_events_source_allowed';
  if v_constraint is null or position('manual_adjustment' in v_constraint)=0 then
    raise exception 'Unexpected morale source constraint';
  end if;
  execute replace(v_definition,v_anchor,v_anchor||', ''race_load''');
  alter table public.rider_morale_events drop constraint rider_morale_events_source_allowed;
  -- Keep every previously permitted source, including sources added elsewhere.
  execute 'alter table public.rider_morale_events add constraint rider_morale_events_source_allowed '||
    replace(v_constraint,'''manual_adjustment''::text','''manual_adjustment''::text, ''race_load''::text');
end;
$allow_race_load_source$;

create function private.adjust_rider_season_race_load(
  p_rider_id uuid, p_season_id uuid, p_stage_id uuid, p_delta integer
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_season record;
  v_rating record;
  v_days integer;
  v_debit numeric;
  v_delta numeric;
  v_event jsonb;
  v_day_id uuid;
begin
  select id,game_year,status,current_day_number into v_season
  from public.seasons where id=p_season_id;
  if coalesce(v_season.game_year,0)<5 or p_delta not in (-1,1) then return; end if;

  -- Same per-rider serialization as the persistent morale engine. Only one
  -- existing rating row is updated; no repeated scan of all stage results.
  perform pg_advisory_xact_lock(hashtextextended(p_rider_id::text,0));
  select season_race_days,race_load_morale_debit into v_rating
  from public.rider_season_ratings where rider_id=p_rider_id and season_id=p_season_id for update;
  -- Archived/purged ratings must never prevent an official result from saving.
  if not found then return; end if;
  v_days := greatest(0,v_rating.season_race_days+p_delta);
  v_debit := v_rating.race_load_morale_debit;
  v_delta := greatest(0,v_rating.season_race_days-30)-greatest(0,v_days-30);
  if v_delta>0 then v_delta:=least(v_delta,v_debit); end if;

  -- Corrections to sealed seasons adjust their count only, never old morale.
  if v_season.status='active' and v_delta<>0 then
    select id into v_day_id from public.season_days
    where season_id=p_season_id and day_number=coalesce(v_season.current_day_number,1);
    if v_day_id is not null then
      v_event:=public.apply_rider_morale_event(
        p_rider_id,v_day_id,'race_load',gen_random_uuid()::text,v_delta,
        case when v_delta<0 then 'Calendrier surchargé — '||v_days||' JDC cette saison (seuil : 30)'
          else 'Correction des jours de course — moral restitué' end,
        jsonb_build_object('seasonId',p_season_id,'stageId',p_stage_id,
          'raceDaysBefore',v_rating.season_race_days,'raceDaysAfter',v_days,
          'threshold',30,'ruleVersion','s5-race-load-v1')
      );
      if v_delta<0 then
        v_debit:=v_debit-coalesce((v_event->>'appliedDelta')::numeric,0);
      else
        -- A correction never refunds more than was actually lost. A refund
        -- clipped at 100 is consumed rather than banked for a future bonus.
        v_debit:=greatest(0,v_debit-v_delta);
      end if;
    end if;
  end if;
  update public.rider_season_ratings set season_race_days=v_days,
    race_load_morale_debit=least(v_debit,greatest(0,v_days-30))
  where rider_id=p_rider_id and season_id=p_season_id;
end;
$$;

create function private.sync_season_race_load_from_stage_result()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_old record; v_new record; v_has_old boolean:=false; v_has_new boolean:=false;
begin
  -- Ordinary result upserts/re-rankings have no participation change.
  if tg_op='UPDATE' and old.stage_id=new.stage_id and old.race_roster_id=new.race_roster_id
    and (old.status<>'did_not_start')=(new.status<>'did_not_start') then return new; end if;
  if tg_op<>'INSERT' and old.status<>'did_not_start' then
    select roster.rider_id,edition.season_id into v_old
    from public.race_rosters roster cross join public.stages stage
    join public.race_editions edition on edition.id=stage.race_edition_id
    join public.seasons season on season.id=edition.season_id and season.game_year>=5
    where roster.id=old.race_roster_id and stage.id=old.stage_id;
    v_has_old:=found;
  end if;
  if tg_op<>'DELETE' and new.status<>'did_not_start' then
    select roster.rider_id,edition.season_id into v_new
    from public.race_rosters roster cross join public.stages stage
    join public.race_editions edition on edition.id=stage.race_edition_id
    join public.seasons season on season.id=edition.season_id and season.game_year>=5
    where roster.id=new.race_roster_id and stage.id=new.stage_id;
    v_has_new:=found;
  end if;
  -- A roster/registration remap for the same rider and season changes no JDC.
  -- Avoid a temporary refund/debit pair, including at the morale ceiling.
  if v_has_old and v_has_new then
    if v_old.rider_id=v_new.rider_id and v_old.season_id=v_new.season_id then return null; end if;
  end if;
  if v_has_old then perform private.adjust_rider_season_race_load(v_old.rider_id,v_old.season_id,old.stage_id,-1); end if;
  if v_has_new then perform private.adjust_rider_season_race_load(v_new.rider_id,v_new.season_id,new.stage_id,1); end if;
  return null;
end;
$$;

create trigger zz_stage_results_season_race_load
after insert or update of status,stage_id,race_roster_id or delete on public.stage_results
for each row execute function private.sync_season_race_load_from_stage_result();

revoke all on function private.adjust_rider_season_race_load(uuid,uuid,uuid,integer) from public,anon,authenticated;
revoke all on function private.sync_season_race_load_from_stage_result() from public,anon,authenticated;
comment on column public.rider_season_ratings.season_race_days is
  'Official stage starts in this season, from S5 onward; DNS excluded, including starts ending in DNF/OTL.';
notify pgrst,'reload schema';
commit;
