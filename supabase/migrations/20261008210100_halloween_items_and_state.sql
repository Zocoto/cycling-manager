begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

create function public.halloween_use_item(p_user uuid,p_item text,p_target uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_context record;v_wallet public.halloween_wallets%rowtype;v_rider public.riders%rowtype;
  v_injury public.rider_injuries%rowtype;v_project public.infrastructure_projects%rowtype;
  v_form numeric;v_fatigue integer;v_after numeric;v_rating_age integer;v_inventory integer;v_game_day integer;v_equipment uuid;
begin
  select ts.id as team_season_id,ts.team_id,s.id as season_id,s.current_day_number,s.game_year,day.id as season_day_id
  into v_context from public.sporting_directors d join public.team_manager_assignments a on a.sporting_director_id=d.id and a.status='active' and a.role='general_manager'
    join public.seasons s on s.status='active' join public.team_seasons ts on ts.team_id=a.team_id and ts.season_id=s.id
    join public.season_days day on day.season_id=s.id and day.day_number=s.current_day_number
  where d.auth_user_id=p_user and d.status='active' limit 1;
  if v_context is null then raise exception 'Aucune équipe active.'; end if;
  select * into strict v_wallet from public.halloween_wallets where edition_id='halloween-2026' and user_id=p_user for update;
  v_inventory:=coalesce((v_wallet.inventory->>p_item)::integer,0);
  if v_inventory<1 then raise exception 'Vous ne possédez pas cet objet.'; end if;
  v_game_day:=v_context.game_year*28+v_context.current_day_number-1;
  if p_item='headless-frame-claim' then
    select id into strict v_equipment from public.equipment_catalog_items where catalog_key='halloween-2026-headless-frame';
    insert into public.team_equipment_inventory(team_season_id,equipment_item_id,quantity,last_purchase_price) values(v_context.team_season_id,v_equipment,1,0)
      on conflict(team_season_id,equipment_item_id) do update set quantity=public.team_equipment_inventory.quantity+1,updated_at=now();
  elsif p_item='scouts-candy' then
    update public.team_seasons set scouting_reports_revealed_until=greatest(now(),coalesce(scouting_reports_revealed_until,now()))+interval '24 hours' where id=v_context.team_season_id;
  elsif p_item in('gravediggers-hourglass','cursed-builders-seal') then
    select * into v_project from public.infrastructure_projects where id=p_target and team_id=v_context.team_id and status='active' for update;
    if v_project.id is null or v_project.infrastructure_code='international_youth_center' or v_project.country_id is not null then raise exception 'Choisissez un chantier d’équipe payé et en cours, hors école internationale.'; end if;
    if p_item='gravediggers-hourglass' then
      v_after:=greatest(v_game_day+1,v_project.completes_game_day_index-2);
      if v_after>=v_project.completes_game_day_index then raise exception 'Ce chantier ne peut plus être raccourci.'; end if;
      -- Keep the existing duration invariant; no free level is granted here.
      update public.infrastructure_projects set completes_game_day_index=v_after,final_duration_days=v_after-starts_game_day_index,updated_at=now() where id=v_project.id;
    else
      -- Existing completion path handles every infrastructure and its notifications.
      update public.infrastructure_projects set starts_game_day_index=v_game_day-1,completes_game_day_index=v_game_day,final_duration_days=1,updated_at=now() where id=v_project.id;
      perform public.settle_due_infrastructure_projects();
    end if;
  else
    if not exists(select 1 from public.rider_contracts c where c.rider_id=p_target and c.team_id=v_context.team_id and c.status='active') then raise exception 'Choisissez un coureur professionnel de votre équipe.'; end if;
    select * into v_rider from public.riders where id=p_target for update;
    if to_jsonb(v_rider)->>'status'='retired' or to_jsonb(v_rider)->>'retired_at' is not null then raise exception 'Un coureur retraité ne peut pas recevoir cet objet.'; end if;
    if exists(select 1 from public.race_rosters rr join public.race_registrations reg on reg.id=rr.race_registration_id
      join public.stages st on st.race_edition_id=reg.race_edition_id
      where rr.rider_id=p_target and reg.status='accepted' and st.status<>'cancelled'
        and (st.status='in_progress' or (st.departure_at<=now() and st.departure_at+make_interval(mins=>greatest(8,least(48,round(st.distance_km/6.0)::integer)))>now()))) then raise exception 'Ce coureur participe à une course en cours.'; end if;
    if p_item in('spectres-tea','giants-syrup','witches-star','youth-fountain','immortality-pact') then
      if exists(select 1 from public.halloween_rider_effects where rider_id=p_target and item_id=p_item) then raise exception 'Ce coureur a déjà bénéficié de cet objet sur sa carrière.'; end if;
    end if;
    if p_item in('pumpkin-juice','full-moon-elixir') then
      select state.form,state.fatigue into v_form,v_fatigue from public.rider_condition_states state join public.season_days day on day.id=state.season_day_id
        where state.rider_id=p_target and day.season_id=v_context.season_id and day.day_number<=v_context.current_day_number order by day.day_number desc,state.updated_at desc limit 1;
      v_form:=coalesce(v_form,75);v_fatigue:=coalesce(v_fatigue,0);
      if v_form>=100 then raise exception 'Ce coureur a déjà 100 %% de forme.'; end if;
      v_after:=case when p_item='full-moon-elixir' then 100 else least(100,v_form+5) end;
      insert into public.rider_condition_states(rider_id,season_day_id,form,fatigue,source) values(p_target,v_context.season_day_id,v_after,v_fatigue,'daily_reward')
        on conflict(rider_id,season_day_id) do update set form=excluded.form,updated_at=now();
    elsif p_item in('mummy-bandage','mummy-resurrection') then
      select * into v_injury from public.rider_injuries where rider_id=p_target and status='active' and expected_recovery_at>now() order by expected_recovery_at desc limit 1 for update;
      if v_injury.id is null then raise exception 'Ce coureur n’a aucune blessure active.'; end if;
      if p_item='mummy-bandage' and v_injury.diagnosis_code='fatigue_exhaustion' then raise exception 'Les blessures de fatigue ne peuvent pas être raccourcies par un bandage.'; end if;
      update public.rider_injuries set expected_recovery_at=case when p_item='mummy-resurrection' then now() else greatest(now(),expected_recovery_at-interval '12 hours') end,
        status=case when p_item='mummy-resurrection' or expected_recovery_at<=now()+interval '12 hours' then 'recovered' else 'active' end,
        recovered_at=case when p_item='mummy-resurrection' or expected_recovery_at<=now()+interval '12 hours' then now() else recovered_at end,updated_at=now() where id=v_injury.id;
    elsif p_item='midnight-chocolate' then update public.riders set career_race_days=career_race_days+1 where id=p_target;
    elsif p_item in('spectres-tea','giants-syrup') then
      if v_rider.height_cm is null or v_rider.weight_kg is null then raise exception 'Morphologie indisponible.'; end if;
      v_after:=case when p_item='spectres-tea' then v_rider.weight_kg-1 else v_rider.weight_kg end;
      if (p_item='giants-syrup' and v_rider.height_cm+2>210) or v_after<greatest(45,18*power((v_rider.height_cm+case when p_item='giants-syrup' then 2 else 0 end)/100.0,2)) then raise exception 'Cette potion dépasserait les limites physiques autorisées.'; end if;
      update public.riders set weight_kg=v_after,height_cm=height_cm+case when p_item='giants-syrup' then 2 else 0 end where id=p_target;
    elsif p_item='witches-star' then
      if v_rider.potential_steps>6 or v_rider.potential_steps is null then raise exception 'Cette étoile est réservée aux coureurs de 3 étoiles ou moins.'; end if;
      update public.riders set potential_steps=potential_steps+2 where id=p_target;
    elsif p_item='youth-fountain' then
      select age into v_rating_age from public.rider_season_ratings where rider_id=p_target and season_id=v_context.season_id for update;
      if v_rating_age is null or v_rating_age<25 then raise exception 'Cette potion est réservée aux professionnels actifs de 25 ans ou plus.'; end if;
      update public.rider_season_ratings rating set age=age-1,updated_at=now() where rider_id=p_target and exists(select 1 from public.seasons s where s.id=rating.season_id and s.game_year>=v_context.game_year and s.status in('active','planned','upcoming'));
    elsif p_item<>'immortality-pact' then raise exception 'Cet objet ne peut pas être utilisé sur un coureur.';
    end if;
    if p_item in('spectres-tea','giants-syrup','witches-star','youth-fountain','immortality-pact') then
      insert into public.halloween_rider_effects(rider_id,item_id,user_id,protection_expires_at) values(p_target,p_item,p_user,
        case when p_item='immortality-pact' then ((((now() at time zone 'Europe/Paris')::date+84+case when (now() at time zone 'Europe/Paris')::time>=time '08:00' then 1 else 0 end)::timestamp+time '08:00') at time zone 'Europe/Paris') end);
    end if;
  end if;
  update public.halloween_wallets set inventory=jsonb_set(inventory,array[p_item],to_jsonb(v_inventory-1)) where edition_id='halloween-2026' and user_id=p_user;
end $$;
revoke all on function public.halloween_use_item(uuid,text,uuid) from public,anon,authenticated;

create function public.get_current_halloween_state()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_edition public.halloween_editions%rowtype;v_wallet public.halloween_wallets%rowtype;
  v_curse public.halloween_curses%rowtype;v_team uuid;v_day date:=(now() at time zone 'Europe/Paris')::date;
  v_state text;v_ranking jsonb;v_daily jsonb;v_run jsonb;v_riders jsonb;v_targets jsonb;v_projects jsonb;
begin
  if auth.uid() is null then raise exception 'Connexion requise.'; end if;
  select * into strict v_edition from public.halloween_editions where id='halloween-2026';
  v_state:=case when not v_edition.enabled then 'paused' when now()<v_edition.starts_at then 'scheduled' when now()<v_edition.ends_at then 'open' when now()<v_edition.shop_ends_at then 'shop' else 'archived' end;
  select * into v_wallet from public.halloween_wallets where edition_id=v_edition.id and user_id=auth.uid();
  select * into v_curse from public.halloween_curses where edition_id=v_edition.id and user_id=auth.uid() and expires_at>now();
  select a.team_id into v_team from public.team_manager_assignments a join public.sporting_directors d on d.id=a.sporting_director_id where d.auth_user_id=auth.uid() and d.status='active' and a.status='active' and a.role='general_manager' limit 1;
  select coalesce(jsonb_agg(x),'[]') into v_ranking from (
    select d.display_name as name,record.user_id as "userId",record.score,record.distance,record.coins from (
      select distinct on(user_id) user_id,score,distance,coins,finished_at from public.halloween_runs where edition_id=v_edition.id and status='finished'
      order by user_id,score desc,distance desc,finished_at asc
    ) record join public.sporting_directors d on d.auth_user_id=record.user_id order by record.score desc,record.distance desc,record.finished_at asc,record.user_id limit 100
  ) x;
  select coalesce(jsonb_agg(x),'[]') into v_daily from (
    select d.display_name as name,record.user_id as "userId",record.score,record.distance,record.coins from (
      select distinct on(user_id) user_id,score,distance,coins,finished_at from public.halloween_runs where edition_id=v_edition.id and day=v_day and status='finished'
      order by user_id,score desc,distance desc,finished_at asc
    ) record join public.sporting_directors d on d.auth_user_id=record.user_id order by record.score desc,record.distance desc,record.finished_at asc,record.user_id limit 100
  ) x;
  select jsonb_build_object('id',id,'seed',seed,'startedAt',started_at,'expiresAt',expires_at) into v_run from public.halloween_runs where edition_id=v_edition.id and user_id=auth.uid() and status='running' and expires_at>now() order by started_at desc limit 1;
  select coalesce(jsonb_agg(x),'[]') into v_riders from (select r.id,r.first_name||' '||r.last_name as name from public.riders r join public.rider_contracts c on c.rider_id=r.id where c.team_id=v_team and c.status='active' order by r.last_name limit 100) x;
  select coalesce(jsonb_agg(x),'[]') into v_targets from (select w.user_id as id,d.display_name as name from public.halloween_wallets w join public.sporting_directors d on d.auth_user_id=w.user_id where w.edition_id=v_edition.id and w.user_id<>auth.uid() and d.status='active' order by d.display_name limit 500) x;
  select coalesce(jsonb_agg(x),'[]') into v_projects from (select id,replace(infrastructure_code,'_',' ')||' · niveau '||target_level as name from public.infrastructure_projects where team_id=v_team and status='active' and country_id is null and infrastructure_code<>'international_youth_center' order by created_at limit 20) x;
  return jsonb_build_object('state',v_state,'startsAt',v_edition.starts_at,'endsAt',v_edition.ends_at,'shopEndsAt',v_edition.shop_ends_at,
    'avatarKey',(select avatar_key from public.sporting_directors where auth_user_id=auth.uid() limit 1),
    'joined',v_wallet.user_id is not null,'coins',coalesce(v_wallet.coins,0),'tickets',coalesce(v_wallet.tickets,0),
    'inventory',coalesce(v_wallet.inventory,'{}'),'obtained',coalesce(v_wallet.obtained,'{}'),'purchases',coalesce(v_wallet.purchases,'{}'),'cosmetics',coalesce(v_wallet.cosmetics,'{}'),
    'curse',case when v_curse.id is null then null else jsonb_build_object('id',v_curse.id,'kind',v_curse.kind,'expiresAt',v_curse.expires_at,'sender',(select display_name from public.sporting_directors where auth_user_id=v_curse.sender_id limit 1)) end,
    'pendingGift',v_curse.pending_gift,'bandages',coalesce(v_curse.bandages,0),'activeRun',v_run,
    'attempts',(select count(*) from public.halloween_runs where edition_id=v_edition.id and user_id=auth.uid() and day=v_day),
    'drawn',exists(select 1 from public.halloween_requests where edition_id=v_edition.id and user_id=auth.uid() and kind='draw' and (created_at at time zone 'Europe/Paris')::date=v_day),
    'ranking',v_ranking,'dailyRanking',v_daily,'riders',v_riders,'targets',v_targets,'projects',v_projects);
end $$;
revoke all on function public.get_current_halloween_state() from public,anon;
grant execute on function public.get_current_halloween_state() to authenticated,service_role;
notify pgrst,'reload schema';
commit;
