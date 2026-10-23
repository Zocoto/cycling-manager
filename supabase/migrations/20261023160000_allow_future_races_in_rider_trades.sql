begin;
set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- Rider exchanges only. Cash transfers, contracts, budgets and camps retain
-- their existing rules. No existing offer or entry is rewritten at delivery.
create function private.assert_trade_races_not_started(p_rider_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_edition record; v_name text;
begin
  select concat_ws(' ', first_name, last_name) into v_name from public.riders where id=p_rider_id;
  -- Match roster editing's edition lock, but never wait while holding the
  -- transfer's team/rider/contract locks. The scope is one rider's entries.
  for v_edition in
    select edition.id,edition.status from public.race_editions edition
    where edition.status not in ('completed','cancelled') and exists (
      select 1 from public.race_rosters roster
      join public.race_registrations registration on registration.id=roster.race_registration_id
      where roster.rider_id=p_rider_id and roster.status in ('selected','confirmed')
        and registration.status in ('pending','accepted') and registration.race_edition_id=edition.id
    ) order by edition.id for update nowait
  loop
    perform stage.id from public.stages stage where stage.race_edition_id=v_edition.id
      order by stage.id for update nowait;
    if v_edition.status='in_progress' or exists (
      select 1 from public.stages stage where stage.race_edition_id=v_edition.id
        and stage.status<>'cancelled' and (
          stage.status in ('in_progress','completed')
          -- Precomputation looks six minutes ahead. One extra minute keeps a
          -- bounded transfer from crossing that boundary with a stale snapshot.
          or stage.departure_at <= clock_timestamp()+interval '7 minutes'
          or exists(select 1 from public.official_stage_simulations simulation where simulation.stage_id=stage.id)
          or exists(select 1 from public.official_stage_simulation_claims claim where claim.stage_id=stage.id)
        )
    ) then
      raise exception '% participe à une course commencée ou dont le départ est déjà figé. Attendez la fin de l’épreuve pour proposer ou accepter l’échange.',v_name;
    end if;
  end loop;
exception when lock_not_available then
  raise exception 'Une opération sur les courses de ces coureurs est en cours. Réessayez dans quelques secondes.' using errcode='55P03';
end;
$$;

create function private.withdraw_trade_future_races(p_rider_id uuid,p_offer_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_entry record; v_count integer; v_minimum integer;
begin
  -- Both riders have already passed the guarded eligibility checks. Repeat
  -- at acceptance because new future entries can be made while an offer waits.
  for v_entry in
    select roster.id roster_id, registration.id registration_id,registration.team_season_id,
      registration.status registration_status,edition.id edition_id,edition.display_name,race.slug,
      race.competition_type,category.minimum_roster_size,
      concat_ws(' ',rider.first_name,rider.last_name) rider_name
    from public.race_rosters roster
    join public.race_registrations registration on registration.id=roster.race_registration_id
    join public.race_editions edition on edition.id=registration.race_edition_id
    join public.races race on race.id=edition.race_id
    left join public.race_categories category on category.id=edition.race_category_id
    join public.riders rider on rider.id=roster.rider_id
    where roster.rider_id=p_rider_id and roster.status in ('selected','confirmed')
      and registration.status in ('pending','accepted')
      and edition.status in ('planned','registration_open','registration_closed')
    order by edition.id,registration.id,roster.id for update of roster nowait
  loop
    update public.race_rosters set status='withdrawn' where id=v_entry.roster_id;
    -- A national lineup must not silently reinsert a withdrawn confirmed rider
    -- at its next sync. Preserve the selection and its history, mark the reply.
    perform selection_list.id from public.national_federation_selection_lists selection_list
    join public.national_federation_selection_race_links link on link.selection_list_id=selection_list.id
    where link.race_registration_id=v_entry.registration_id order by selection_list.id for update of selection_list nowait;
    update public.national_federation_selection_members member
      set response_status='declined',responded_at=now()
    from public.national_federation_selection_race_links link
    where link.race_registration_id=v_entry.registration_id and member.selection_list_id=link.selection_list_id
      and member.professional_rider_id=p_rider_id and member.response_status in ('pending','confirmed');
    if found then
      update public.national_federation_selection_lists selection_list set updated_at=now(),
        status=case when selection_list.status='draft' then 'draft' when exists (
          select 1 from public.national_federation_selection_members member
          where member.selection_list_id=selection_list.id and member.response_status='pending'
        ) then 'pending_confirmation' else 'finalized' end
      from public.national_federation_selection_race_links link
      where link.selection_list_id=selection_list.id and link.race_registration_id=v_entry.registration_id;
    end if;
    if v_entry.team_season_id is null or v_entry.registration_status<>'accepted' then continue; end if;
    select count(*)::integer into v_count from public.race_rosters
      where race_registration_id=v_entry.registration_id and status in ('selected','confirmed');
    v_minimum:=case when v_entry.competition_type in ('national_road','national_time_trial') then 1
      else greatest(coalesce(v_entry.minimum_roster_size,1),1) end;
    if v_count<v_minimum then
      insert into public.sporting_director_messages (
        sporting_director_id,season_id,team_season_id,message_type,sender_name,subject,preview,body,
        action_href,action_label,source_reference,is_important
      ) select director.id,team_season.season_id,team_season.id,'system','Bureau des transferts',
        'Start-list à corriger · '||v_entry.display_name,
        v_entry.rider_name||' a été désinscrit dans le cadre d’une offre d’échange.',
        format('%s a été désinscrit de %s dans le cadre d’une offre d’échange. Il reste %s coureur(s) pour un minimum de %s. Complétez votre composition avant le départ.',
          v_entry.rider_name,v_entry.display_name,v_count,v_minimum),
        '/jeu/courses/'||v_entry.slug||'#inscription','Corriger la composition',
        'trade-withdrawal:'||p_offer_id::text||':'||v_entry.registration_id::text||':'||p_rider_id::text,true
      from public.team_seasons team_season
      join public.team_manager_assignments assignment on assignment.team_id=team_season.team_id
        and assignment.role='general_manager' and assignment.status='active'
      join public.sporting_directors director on director.id=assignment.sporting_director_id and director.status='active'
      where team_season.id=v_entry.team_season_id
      on conflict (sporting_director_id,source_reference) do nothing;
    end if;
  end loop;
end;
$$;

-- Exact anchors preserve every salary, roster, season, cash and message rule
-- from the reviewed exchange implementation. Abort on drift, not partial edits.
do $trade_future_races$
declare v_definition text; v_old text; v_new text;
begin
  select replace(pg_get_functiondef('private.assert_rider_trade_eligible(uuid,uuid,uuid,integer)'::regprocedure),chr(13),'') into v_definition;
  v_old:=$old$  if exists (
    select 1 from public.race_rosters as roster
    join public.race_registrations as registration on registration.id = roster.race_registration_id
    join public.race_editions as edition on edition.id = registration.race_edition_id
    where roster.rider_id = p_rider_id and roster.status in ('selected', 'confirmed')
      and registration.status in ('pending', 'accepted')
      and edition.status not in ('completed', 'cancelled')
  ) then
    raise exception '% est engagé sur une course non terminée. Retirez-le de cette course avant l’échange, ou attendez la fin de l’épreuve.', v_name;
  end if;$old$;
  if position(v_old in v_definition)=0 then raise exception 'Unexpected trade race eligibility: review required'; end if;
  execute replace(v_definition,v_old,'  perform private.assert_trade_races_not_started(p_rider_id);');

  select replace(pg_get_functiondef('public.submit_direct_transfer_trade_offer(uuid,numeric,uuid,text)'::regprocedure),chr(13),'') into v_definition;
  v_old:=$old$  ) returning id into v_offer_id;

  select concat_ws(' ', first_name, last_name) into v_rider_name$old$;
  v_new:=$new$  ) returning id into v_offer_id;

  perform private.withdraw_trade_future_races(p_offered_rider_id,v_offer_id);

  select concat_ws(' ', first_name, last_name) into v_rider_name$new$;
  if position(v_old in v_definition)=0 then raise exception 'Unexpected trade submission: review required'; end if;
  execute replace(v_definition,v_old,v_new);

  select replace(pg_get_functiondef('public.respond_to_direct_transfer_offer(uuid,boolean)'::regprocedure),chr(13),'') into v_definition;
  v_old:=$old$  -- Accepted first so departure triggers invalidate only competing offers.$old$;
  v_new:=$new$  perform private.withdraw_trade_future_races(v_offer.rider_id,v_offer.id);
  perform private.withdraw_trade_future_races(v_offer.offered_rider_id,v_offer.id);

  -- Accepted first so departure triggers invalidate only competing offers.$new$;
  if position(v_old in v_definition)=0 then raise exception 'Unexpected trade acceptance: review required'; end if;
  execute replace(v_definition,v_old,v_new);
end;
$trade_future_races$;

revoke all on function private.assert_trade_races_not_started(uuid) from public,anon,authenticated,service_role;
revoke all on function private.withdraw_trade_future_races(uuid,uuid) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
