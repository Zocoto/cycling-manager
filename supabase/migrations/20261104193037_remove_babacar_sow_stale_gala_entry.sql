begin;
set local lock_timeout='500ms';
set local statement_timeout='5s';
set local application_name='gala-babacar-duplicate-repair';

-- Owner requested removing the obsolete club's duplicate, not changing other
-- historical registration-club snapshots after transfers (policy of Nov 2).
do $repair$
declare
  v_rider constant uuid := '9ae5e40f-1503-4537-9469-5232529db373';
  v_old_team constant uuid := 'a81d26fc-5b1f-4267-8c60-073d53389733';
  v_current_team constant uuid := '69b20e97-b88b-4c8c-b98b-b0fd28939913';
  v_season uuid;
  v_registration uuid;
  v_current_registration uuid;
  v_lineup jsonb;
  v_clubs uuid[];
  v_team uuid;
begin
  select id into strict v_season from public.seasons where game_year=4;
  foreach v_team in array array[v_current_team,v_old_team] loop
    if not pg_try_advisory_xact_lock(hashtextextended('gala-s4:'||v_team::text,0)) then
      raise exception 'Une inscription gala est en cours. Réessayer la livraison.';
    end if;
  end loop;
  select id into v_registration from public.season_gala_registrations
  where season_id=v_season and team_id=v_old_team and program='continental' for update;
  select id into v_current_registration from public.season_gala_registrations
  where season_id=v_season and team_id=v_current_team for update;
  if not exists(select 1 from public.season_gala_registration_riders
    where registration_id=v_registration and profile='mountain' and rider_id=v_rider) then
    return; -- Already removed; never reinsert a historical duplicate.
  end if;
  if exists(select 1 from public.season_gala_result_imports
    where season_id=v_season and event_key='continental:mountain') then
    raise exception 'Les résultats du gala ont déjà été importés.';
  end if;
  perform 1 from public.rider_contracts where rider_id=v_rider and status='active' for share;
  select array_agg(distinct team_id) into v_clubs from public.rider_contracts
  where rider_id=v_rider and status='active';
  if v_clubs is distinct from array[v_current_team] then
    raise exception 'Le club actuel de Babacar Sow a évolué. Réexaminer avant réparation.';
  end if;
  if not exists(select 1 from public.season_gala_registration_riders
    where registration_id=v_current_registration and rider_id=v_rider) then
    raise exception 'L’inscription dans le club actuel doit être conservée.';
  end if;
  perform 1 from public.season_gala_registration_riders
  where registration_id=v_registration and profile='mountain' for update;
  select jsonb_agg(to_jsonb(r) order by position) into v_lineup
  from public.season_gala_registration_riders r where registration_id=v_registration and profile='mountain';
  if jsonb_array_length(v_lineup)<>8 then
    raise exception 'Le retrait doit laisser sept coureurs : la composition a évolué.';
  end if;
  -- Reinsert the seven survivors together to compact 1..7 without transient
  -- violations of the immediate unique position constraint.
  delete from public.season_gala_registration_riders where registration_id=v_registration and profile='mountain';
  insert into public.season_gala_registration_riders(registration_id,profile,rider_id,position)
  select registration_id,profile,rider_id,row_number() over(order by position)::smallint
  from jsonb_populate_recordset(null::public.season_gala_registration_riders,v_lineup)
  where rider_id<>v_rider;
end;
$repair$;
commit;
