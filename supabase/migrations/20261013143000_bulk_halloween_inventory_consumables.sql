begin;
set local lock_timeout='3s';
set local statement_timeout='10s';

-- Preserve the already reviewed effects; repair only form writes and their guards.
do $patch$
declare v_def text; v_old text; v_new text;
begin
  v_def:=replace(pg_get_functiondef('public.halloween_use_item(uuid,text,uuid)'::regprocedure),chr(13),'');
  if position('halloween_bulk_inventory_v1' in v_def)>0 then raise exception 'Bulk consumables already installed without a receipt.'; end if;
  if position('halloween_repeat_consumables_v1' in v_def)=0 then raise exception 'Repeat-consumables prerequisite missing.'; end if;
  v_old:=$old$    if p_item in('pumpkin-juice','full-moon-elixir') then
      select state.form$old$;
  v_new:=$new$    if p_item in('pumpkin-juice','full-moon-elixir') then
      -- halloween_bulk_inventory_v1: fatigue injury locks form at zero.
      if exists(select 1 from public.rider_injuries where rider_id=p_target and status='active'
        and diagnosis_code='fatigue_exhaustion' and expected_recovery_at>now()) then
        raise exception 'La blessure de fatigue doit être soignée avant de remonter la forme. Aucun objet consommé.';
      end if;
      select state.form$new$;
  if position(v_old in v_def)=0 then raise exception 'Unexpected form-effect anchor.'; end if;
  v_def:=replace(v_def,v_old,v_new);
  v_old:=$old$        on conflict(rider_id,season_day_id) do update set form=excluded.form,updated_at=now();$old$;
  v_new:=$new$        on conflict(rider_id,season_day_id) do update set form=excluded.form,source=excluded.source,updated_at=now()
        returning form into v_after;
      if v_after<=v_form then raise exception 'La forme ne peut pas augmenter actuellement. Aucun objet consommé.'; end if;
      -- A pre-existing next-day snapshot must retain the actual, capped gain.
      update public.rider_condition_states state set form=least(100,state.form+v_after-v_form),source='daily_reward',updated_at=now()
        from public.season_days day where state.season_day_id=day.id and state.rider_id=p_target
          and day.season_id=v_context.season_id and day.day_number>v_context.current_day_number;$new$;
  if position(v_old in v_def)=0 then raise exception 'Unexpected condition-write anchor.'; end if;
  execute replace(v_def,v_old,v_new);
end $patch$;

-- Only the trusted action endpoint may read/apply these target snapshots.
create function public.halloween_item_target_state(p_user uuid,p_item text,p_target uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_context record; v_result jsonb;
begin
  select ts.id team_season_id,ts.team_id,s.id season_id,s.current_day_number,s.game_year into v_context
    from public.sporting_directors d join public.team_manager_assignments a on a.sporting_director_id=d.id and a.status='active' and a.role='general_manager'
    join public.seasons s on s.status='active' join public.team_seasons ts on ts.team_id=a.team_id and ts.season_id=s.id
    where d.auth_user_id=p_user and d.status='active' limit 1;
  if v_context is null then raise exception 'Aucune équipe active.'; end if;
  if p_item='scouts-candy' then
    select jsonb_build_object('revealUntil',scouting_reports_revealed_until) into v_result from public.team_seasons where id=v_context.team_season_id for update;
  elsif p_item in('gravediggers-hourglass','cursed-builders-seal') then
    select jsonb_build_object('remainingDays',greatest(0,completes_game_day_index-(v_context.game_year*28+v_context.current_day_number-1)),
      'status',status) into v_result from public.infrastructure_projects where id=p_target and team_id=v_context.team_id for update;
    if v_result is null then raise exception 'Choisissez un chantier d’équipe en cours.'; end if;
  elsif p_item='headless-frame-claim' then v_result:='{}';
  else
    if not exists(select 1 from public.rider_contracts where rider_id=p_target and team_id=v_context.team_id and status='active') then
      raise exception 'Choisissez un coureur professionnel de votre équipe.';
    end if;
    perform 1 from public.riders where id=p_target for update;
    -- Serialize the baseline with normal condition writes, not only other potions.
    perform cs.rider_id from public.rider_condition_states cs join public.season_days sd on sd.id=cs.season_day_id
      where cs.rider_id=p_target and sd.season_id=v_context.season_id and sd.day_number<=v_context.current_day_number
      order by sd.day_number desc limit 1 for update of cs;
    select jsonb_build_object('form',coalesce((select cs.form from public.rider_condition_states cs join public.season_days sd on sd.id=cs.season_day_id
        where cs.rider_id=r.id and sd.season_id=v_context.season_id and sd.day_number<=v_context.current_day_number order by sd.day_number desc limit 1),75),
      'weightKg',r.weight_kg,'heightCm',r.height_cm,'potentialSteps',r.potential_steps,'experienceDays',r.career_race_days,
      'age',(select age from public.rider_season_ratings where rider_id=r.id and season_id=v_context.season_id),
      'injuryHours',coalesce((select ceil(extract(epoch from (expected_recovery_at-now()))/3600) from public.rider_injuries
        where rider_id=r.id and status='active' and expected_recovery_at>now() order by expected_recovery_at desc limit 1),0),
      'protectionExpiresAt',(select max(protection_expires_at) from public.halloween_rider_effects where rider_id=r.id and item_id='immortality-pact'))
      into v_result from public.riders r where r.id=p_target;
  end if;
  return coalesce(v_result,'{}');
end $$;

create function public.halloween_use_items(p_user uuid,p_item text,p_target uuid,p_quantity integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_stock integer; v_quantity integer:=p_quantity; v_before jsonb; v_after jsonb; v_name text; v_message text; n integer;
begin
  -- halloween_bulk_inventory_v1. The caller already locks wallet and request ID.
  if p_quantity is null or p_quantity<1 or p_quantity>30 then raise exception 'Choisissez une quantité entière entre 1 et 30.'; end if;
  if p_item not in('pumpkin-juice','full-moon-elixir','mummy-bandage','mummy-resurrection','scouts-candy','gravediggers-hourglass',
    'cursed-builders-seal','midnight-chocolate','spectres-tea','giants-syrup','witches-star','youth-fountain','immortality-pact','headless-frame-claim') or p_item is null then
    raise exception 'Cet objet n’est pas un consommable utilisable.';
  end if;
  if p_item in('full-moon-elixir','mummy-resurrection','cursed-builders-seal','headless-frame-claim') and p_quantity<>1 then
    raise exception 'Cet objet s’utilise un exemplaire à la fois.';
  end if;
  select coalesce((inventory->>p_item)::integer,0) into v_stock from public.halloween_wallets where edition_id='halloween-2026' and user_id=p_user for update;
  if coalesce(v_stock,0)<p_quantity then raise exception 'Quantité supérieure à votre stock disponible.'; end if;
  v_before:=public.halloween_item_target_state(p_user,p_item,p_target);
  if p_item in('gravediggers-hourglass','cursed-builders-seal') and v_before->>'status'<>'active' then raise exception 'Choisissez un chantier d’équipe en cours.'; end if;
  if p_item='pumpkin-juice' then v_quantity:=least(v_quantity,greatest(0,ceil((100-(v_before->>'form')::numeric)/5)::integer));
  elsif p_item='mummy-bandage' then v_quantity:=least(v_quantity,ceil(coalesce((v_before->>'injuryHours')::numeric,0)/12)::integer);
  elsif p_item='gravediggers-hourglass' then v_quantity:=least(v_quantity,greatest(0,ceil(((v_before->>'remainingDays')::numeric-1)/2)::integer)); end if;
  if v_quantity<1 then raise exception 'Aucun effet possible actuellement. Aucun objet consommé.'; end if;
  -- Any invalid dose rolls back the whole request, including inventory and history.
  for n in 1..v_quantity loop perform public.halloween_use_item(p_user,p_item,p_target); end loop;
  v_after:=public.halloween_item_target_state(p_user,p_item,p_target);
  select name into v_name from public.halloween_catalog where id=p_item;
  v_message:=format('%s : %s objet(s) utilisé(s).',coalesce(v_name,'Cadre exclusif'),v_quantity);
  if p_item in('pumpkin-juice','full-moon-elixir') then
    v_message:=format('%s : +%s en forme (%s → %s/100), %s objet(s) utilisé(s).',v_name,
      (v_after->>'form')::numeric-(v_before->>'form')::numeric,v_before->>'form',v_after->>'form',v_quantity);
  elsif p_item='midnight-chocolate' then v_message:=v_message||format(' Expérience : %s → %s jours.',v_before->>'experienceDays',v_after->>'experienceDays');
  elsif p_item='spectres-tea' then v_message:=v_message||format(' Poids : %s → %s kg.',v_before->>'weightKg',v_after->>'weightKg');
  elsif p_item='giants-syrup' then v_message:=v_message||format(' Taille : %s → %s cm.',v_before->>'heightCm',v_after->>'heightCm');
  elsif p_item='witches-star' then v_message:=v_message||format(' Potentiel : %s → %s étoiles.',(v_before->>'potentialSteps')::numeric/2,(v_after->>'potentialSteps')::numeric/2);
  elsif p_item='youth-fountain' then v_message:=v_message||format(' Âge : %s → %s ans.',v_before->>'age',v_after->>'age');
  elsif p_item in('mummy-bandage','mummy-resurrection') then v_message:=v_message||format(' Blessure : %s → %s h restantes.',v_before->>'injuryHours',v_after->>'injuryHours');
  elsif p_item in('gravediggers-hourglass','cursed-builders-seal') then v_message:=v_message||format(' Chantier : %s → %s jours restants.',v_before->>'remainingDays',v_after->>'remainingDays'); end if;
  if p_item='immortality-pact' then v_message:=v_message||format(' Protection jusqu’au %s (heure de Paris).',to_char((v_after->>'protectionExpiresAt')::timestamptz at time zone 'Europe/Paris','DD/MM/YYYY HH24:MI'));
  elsif p_item='scouts-candy' then v_message:=v_message||format(' Visibilité jusqu’au %s (heure de Paris).',to_char((v_after->>'revealUntil')::timestamptz at time zone 'Europe/Paris','DD/MM/YYYY HH24:MI')); end if;
  if v_quantity<p_quantity then v_message:=v_message||' Les exemplaires inutiles sont conservés.'; end if;
  return jsonb_build_object('message',v_message,'item',p_item,'target',p_target,'quantityRequested',p_quantity,'quantityApplied',v_quantity,'before',v_before,'after',v_after);
end $$;
revoke all on function public.halloween_item_target_state(uuid,text,uuid),public.halloween_use_items(uuid,text,uuid,integer) from public,anon,authenticated;

do $patch$
declare v_def text; v_old text;
begin
  v_def:=replace(pg_get_functiondef('public.halloween_action(uuid,uuid,text,jsonb)'::regprocedure),chr(13),'');
  v_old:=$old$    perform public.halloween_use_item(p_user,p_payload->>'item',(p_payload->>'target')::uuid);
    v_result:=jsonb_build_object('message','Objet utilisé.');$old$;
  if position(v_old in v_def)=0 then raise exception 'Unexpected action-use anchor.'; end if;
  v_def:=replace(v_def,v_old,$new$    if p_payload ? 'quantity' and (jsonb_typeof(p_payload->'quantity')<>'number' or (p_payload->>'quantity')!~'^[0-9]+$') then raise exception 'Quantité entière requise.'; end if;
    v_result:=public.halloween_use_items(p_user,p_payload->>'item',(p_payload->>'target')::uuid,coalesce((p_payload->>'quantity')::integer,1)); -- halloween_bulk_inventory_v1$new$);
  execute v_def;
end $patch$;

-- Enrich the existing inventory values without changing its ordinary items RPC.
create function public.get_current_halloween_item_target_values()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(jsonb_agg(entry.value||jsonb_build_object('weightKg',r.weight_kg,'heightCm',r.height_cm,'age',rating.age,
    'form',coalesce((select cs.form from public.rider_condition_states cs join public.season_days sd on sd.id=cs.season_day_id
      where cs.rider_id=r.id and sd.season_id=season.id and sd.day_number<=season.current_day_number order by sd.day_number desc limit 1),75),
    'protectionExpiresAt',(select max(protection_expires_at) from public.halloween_rider_effects where rider_id=r.id and item_id='immortality-pact')) order by entry.ordinal),'[]'::jsonb)
  from jsonb_array_elements(public.get_current_team_item_target_values()) with ordinality entry(value,ordinal)
  join public.riders r on r.id=(entry.value->>'id')::uuid
  join public.seasons season on season.status='active'
  join public.rider_season_ratings rating on rating.rider_id=r.id and rating.season_id=season.id;
$$;
revoke all on function public.get_current_halloween_item_target_values() from public,anon;
grant execute on function public.get_current_halloween_item_target_values() to authenticated,service_role;

notify pgrst,'reload schema';
commit;
