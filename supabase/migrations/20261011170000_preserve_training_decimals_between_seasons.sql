begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- An immutable receipt per rider/stat/target season prevents double recovery.
-- The old season and its daily training reports are never rewritten.
create table if not exists public.rider_training_season_carryovers (
  rider_id uuid not null references public.riders(id) on delete cascade,
  target_season_id uuid not null references public.seasons(id) on delete cascade,
  source_season_id uuid not null references public.seasons(id) on delete restrict,
  stat_code text not null check (stat_code in ('mountain','hills','flat','time_trial','cobbles','sprint',
    'acceleration','downhill','endurance','resistance','recovery','breakaway','prologue')),
  carried_milli integer not null check (carried_milli between -999 and 999 and carried_milli <> 0),
  balance_before integer not null,
  balance_after integer not null,
  rating_before smallint not null check (rating_before between 0 and 100),
  rating_change smallint not null,
  applied_at timestamptz not null default now(),
  primary key (rider_id, target_season_id, stat_code)
);
alter table public.rider_training_season_carryovers enable row level security;
revoke all on table public.rider_training_season_carryovers from public, anon, authenticated;
grant all on table public.rider_training_season_carryovers to service_role;

create or replace function private.apply_training_season_carryover(
  p_rider_id uuid, p_target_season_id uuid, p_stat_code text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_source_season_id uuid; v_carry integer; v_progress record; v_rating record;
  v_current integer; v_balance integer; v_change integer := 0; v_gain_cap integer; v_cap integer;
begin
  if p_stat_code <> all(array['mountain','hills','flat','time_trial','cobbles','sprint',
    'acceleration','downhill','endurance','resistance','recovery','breakaway','prologue'])
    or p_stat_code is null then raise exception 'Unknown training stat.'; end if;
  select source.id, previous.balance_milli % 1000 into v_source_season_id, v_carry
  from public.seasons target join public.seasons source on source.game_year=target.game_year-1 and source.status='completed'
  join public.rider_training_stat_progress previous on previous.season_id=source.id
    and previous.rider_id=p_rider_id and previous.stat_code=p_stat_code
  where target.id=p_target_season_id;
  if not found or v_carry=0 then return false; end if;

  -- Same lock order as the engines: stat progress first, then current ratings.
  select * into v_progress from public.rider_training_stat_progress
  where rider_id=p_rider_id and season_id=p_target_season_id and stat_code=p_stat_code for update;
  if not found then return false; end if;
  if exists(select 1 from public.rider_training_season_carryovers
    where rider_id=p_rider_id and target_season_id=p_target_season_id and stat_code=p_stat_code) then return false; end if;
  select rating.*, rider.potential_steps into v_rating from public.rider_season_ratings rating
  join public.riders rider on rider.id=rating.rider_id
  where rating.rider_id=p_rider_id and rating.season_id=p_target_season_id for update of rating;
  if not found then return false; end if;
  v_current := (to_jsonb(v_rating)->>p_stat_code)::integer;
  v_balance := v_progress.balance_milli + v_carry;
  v_cap := public.get_rider_potential_stat_cap(v_rating.potential_steps);
  v_gain_cap := case when v_progress.initial_rating < 60 then 18 when v_progress.initial_rating < 70 then 12
    when v_progress.initial_rating < 80 then 8 when v_progress.initial_rating < 90 then 4 else 2 end;

  -- Normalize only the recovered remainder plus the CURRENT balance. Keep all
  -- gains, items and sessions acquired since J1; do not replay past training.
  if v_rating.age < 32 then
    if v_balance >= 1000 and v_current < 100 and v_progress.rating_gain < v_gain_cap and v_current < v_cap then
      v_change := least(floor(v_balance/1000.0)::integer, 100-v_current, v_gain_cap-v_progress.rating_gain, v_cap-v_current);
      v_balance := v_balance-v_change*1000;
    elsif v_progress.rating_gain >= v_gain_cap or v_current >= 100 or v_current >= v_cap then
      v_balance := least(v_balance,999);
    end if;
  else
    if v_balance <= -1000 and v_current > 0 then
      v_change := -least(floor(abs(v_balance)/1000.0)::integer,v_current);
      v_balance := v_balance-v_change*1000;
    elsif v_balance >= 1000 and v_current < v_progress.initial_rating and v_current < v_cap then
      v_change := least(floor(v_balance/1000.0)::integer,v_progress.initial_rating-v_current,v_cap-v_current);
      v_balance := v_balance-v_change*1000;
    elsif v_current >= v_progress.initial_rating or v_current >= v_cap then
      v_balance := least(v_balance,999);
    end if;
  end if;
  insert into public.rider_training_season_carryovers(rider_id,target_season_id,source_season_id,stat_code,
    carried_milli,balance_before,balance_after,rating_before,rating_change)
  values(p_rider_id,p_target_season_id,v_source_season_id,p_stat_code,v_carry,
    v_progress.balance_milli,v_balance,v_current,v_change)
  on conflict(rider_id,target_season_id,stat_code) do nothing;
  if not found then return false; end if;
  update public.rider_training_stat_progress set balance_milli=v_balance,
    rating_gain=rating_gain+greatest(0,v_change),rating_loss=rating_loss+greatest(0,-v_change),updated_at=now()
  where rider_id=p_rider_id and season_id=p_target_season_id and stat_code=p_stat_code;
  if v_change <> 0 then
    execute format('update public.rider_season_ratings set %I=%I+$1, updated_at=now() where rider_id=$2 and season_id=$3',p_stat_code,p_stat_code)
    using v_change,p_rider_id,p_target_season_id;
  end if;
  return true;
end;
$$;

-- AFTER INSERT does not run on the engines' ON CONFLICT DO NOTHING retries.
-- Covers club training, free agents, transfers, and other lazy initializers.
create or replace function private.carry_training_fraction_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.apply_training_season_carryover(new.rider_id,new.season_id,new.stat_code);
  return new;
end;
$$;
drop trigger if exists carry_training_fraction_after_insert on public.rider_training_stat_progress;
create trigger carry_training_fraction_after_insert after insert on public.rider_training_stat_progress
for each row execute function private.carry_training_fraction_after_insert();

create or replace function private.seed_season_training_progress(p_target_season_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer; v_missing record;
begin
  insert into public.rider_training_stat_progress(rider_id,season_id,stat_code,initial_rating)
  select rating.rider_id,rating.season_id,stat.code,(to_jsonb(rating)->>stat.code)::integer
  from public.rider_season_ratings rating cross join (values
    ('mountain'),('hills'),('flat'),('time_trial'),('cobbles'),('sprint'),('acceleration'),
    ('downhill'),('endurance'),('resistance'),('recovery'),('breakaway'),('prologue')) stat(code)
  where rating.season_id=p_target_season_id
  on conflict(rider_id,season_id,stat_code) do nothing;
  get diagnostics v_count=row_count;
  -- Also handle a row initialized while the next season was still a draft.
  for v_missing in select progress.rider_id,progress.stat_code from public.rider_training_stat_progress progress
    join public.seasons target on target.id=progress.season_id
    join public.seasons source on source.game_year=target.game_year-1 and source.status='completed'
    join public.rider_training_stat_progress previous on previous.rider_id=progress.rider_id
      and previous.season_id=source.id and previous.stat_code=progress.stat_code and previous.balance_milli % 1000 <> 0
    where progress.season_id=p_target_season_id and not exists(select 1 from public.rider_training_season_carryovers receipt
      where receipt.rider_id=progress.rider_id and receipt.target_season_id=progress.season_id and receipt.stat_code=progress.stat_code)
    order by progress.rider_id,progress.stat_code
  loop perform private.apply_training_season_carryover(v_missing.rider_id,p_target_season_id,v_missing.stat_code); end loop;
  return v_count;
end;
$$;

-- Seed at rollover, before J1 08:00, not just on the first training session.
-- Patch one stable anchor; leave all economic/sporting closure logic intact.
do $patch$
declare v_definition text; v_anchor constant text := '  get diagnostics v_copied_riders = row_count;'; v_count integer;
begin
  v_definition := replace(pg_get_functiondef('public.rollover_game_season(uuid,boolean)'::regprocedure),E'\r\n',E'\n');
  if position('training_season_fraction_carry_v1' in v_definition)=0 then
    v_count := (length(v_definition)-length(replace(v_definition,v_anchor,'')))/length(v_anchor);
    if v_count <> 1 then raise exception 'Unexpected season rollover ratings anchor; nothing patched.'; end if;
    execute replace(v_definition,v_anchor,v_anchor || E'\n  -- training_season_fraction_carry_v1\n  perform private.seed_season_training_progress(v_target.id);');
  end if;
end;
$patch$;

-- Real catch-up is applied separately in small committed batches. Never call
-- this function for a completed historical season or replay daily sessions.
create or replace function private.repair_training_season_carryovers(p_target_season_id uuid,p_rider_limit integer default 50)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_rider record; v_stat record; v_before integer; v_after integer; v_riders integer := 0; v_stats integer := 0;
begin
  if not exists(select 1 from public.seasons where id=p_target_season_id and status='active') then
    raise exception 'Only the active season can receive a training carry-over catch-up.';
  end if;
  if not pg_try_advisory_xact_lock(hashtextextended('cycling-manager:training-fraction-catchup',0)) then
    return jsonb_build_object('busy',true,'repairedRiders',0,'repairedStats',0);
  end if;
  for v_rider in select distinct previous.rider_id from public.seasons target
    join public.seasons source on source.game_year=target.game_year-1 and source.status='completed'
    join public.rider_training_stat_progress previous on previous.season_id=source.id and previous.balance_milli % 1000 <> 0
    join public.rider_season_ratings rating on rating.rider_id=previous.rider_id and rating.season_id=target.id
    where target.id=p_target_season_id and not exists(select 1 from public.rider_training_season_carryovers receipt
      where receipt.rider_id=previous.rider_id and receipt.target_season_id=target.id and receipt.stat_code=previous.stat_code)
    order by previous.rider_id limit least(100,greatest(1,coalesce(p_rider_limit,50)))
  loop
    select count(*) into v_before from public.rider_training_season_carryovers
    where rider_id=v_rider.rider_id and target_season_id=p_target_season_id;
    for v_stat in select previous.stat_code,(to_jsonb(rating)->>previous.stat_code)::integer current_rating
      from public.seasons target join public.seasons source on source.game_year=target.game_year-1 and source.status='completed'
      join public.rider_training_stat_progress previous on previous.season_id=source.id and previous.rider_id=v_rider.rider_id
        and previous.balance_milli % 1000 <> 0
      join public.rider_season_ratings rating on rating.rider_id=previous.rider_id and rating.season_id=target.id
      where target.id=p_target_season_id order by previous.stat_code
    loop
      insert into public.rider_training_stat_progress(rider_id,season_id,stat_code,initial_rating)
      values(v_rider.rider_id,p_target_season_id,v_stat.stat_code,v_stat.current_rating)
      on conflict(rider_id,season_id,stat_code) do nothing;
      perform private.apply_training_season_carryover(v_rider.rider_id,p_target_season_id,v_stat.stat_code);
    end loop;
    select count(*) into v_after from public.rider_training_season_carryovers
    where rider_id=v_rider.rider_id and target_season_id=p_target_season_id;
    if v_after>v_before then v_riders:=v_riders+1; v_stats:=v_stats+v_after-v_before; end if;
  end loop;
  return jsonb_build_object('busy',false,'repairedRiders',v_riders,'repairedStats',v_stats);
end;
$$;
revoke all on function private.apply_training_season_carryover(uuid,uuid,text) from public, anon, authenticated;
revoke all on function private.carry_training_fraction_after_insert() from public, anon, authenticated;
revoke all on function private.seed_season_training_progress(uuid) from public, anon, authenticated;
revoke all on function private.repair_training_season_carryovers(uuid,integer) from public, anon, authenticated;
grant execute on function private.repair_training_season_carryovers(uuid,integer) to service_role;
comment on table public.rider_training_season_carryovers is
  'Signed fractional training/decline carried from the previous completed season, once per rider/stat. Seasonal training totals reset normally.';
notify pgrst, 'reload schema';
commit;
