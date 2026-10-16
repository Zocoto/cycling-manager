begin;
set local lock_timeout='3s';
set local statement_timeout='10s';

-- Owner-requested replacement of one impossible S4 objective, not a global
-- regeneration of signed contracts or a recruitment on the player's behalf.
do $$
declare v_objective public.sponsor_objectives%rowtype; v_contract uuid; v_rating numeric;
  v_old uuid:='9d979cd0-3321-423f-b3c4-b6102d443598';
  v_new uuid:='60edea22-3dc0-4511-9509-3ba647b4f903';
begin
  select * into strict v_objective from public.sponsor_objectives
    where id='e1ef99d9-208c-4854-8385-142bf7273d73' for update;
  if v_objective.target_details->>'riderId'=v_new::text then return; end if;
  if v_objective.objective_type<>'rider_recruitment' or v_objective.status<>'active'
    or v_objective.target_details->>'riderId' is distinct from v_old::text
    or not exists(select 1 from public.seasons where id=v_objective.season_id and game_year=4 and status='active')
    or not exists(select 1 from public.riders where id=v_old and status='retired') then
    raise exception 'The retired sponsor target no longer matches the reviewed case.';
  end if;
  select id into strict v_contract from public.team_sponsor_contracts
    where sponsor_offer_id=v_objective.sponsor_offer_id and start_season_id=v_objective.season_id
      and team_id='27948dd4-0dac-416d-8f6c-118771bcb6eb' and status='active' for update;
  if exists(select 1 from public.team_sponsor_contracts where sponsor_offer_id=v_objective.sponsor_offer_id and id<>v_contract) then
    raise exception 'The offer is shared; refusing to change another team objective.';
  end if;
  perform 1 from public.riders r join public.countries c on c.id=r.country_id
    where r.id=v_new and r.status='free_agent' and c.iso_alpha2='RW' and c.is_active for update of r;
  if not found or exists(select 1 from public.rider_contracts where rider_id=v_new and status in('active','planned')) then
    raise exception 'The replacement is no longer a free Rwandan rider.';
  end if;
  select round((mountain+hills+flat+time_trial+cobbles+sprint+acceleration+downhill+endurance+resistance+recovery+breakaway+prologue)::numeric/13,2)
    into strict v_rating from public.rider_season_ratings where rider_id=v_new and season_id=v_objective.season_id;
  if v_rating>least(60,coalesce((v_objective.target_details->>'accessibilityMaximumOverall')::numeric,60)) then
    raise exception 'The replacement no longer has a comparable accessible level.';
  end if;
  perform 1 from public.objective_progress where sponsor_objective_id=v_objective.id and team_sponsor_contract_id=v_contract for update;
  if exists(select 1 from public.objective_progress where sponsor_objective_id=v_objective.id
    and (status='achieved' or current_value>0)) then raise exception 'Refusing to overwrite achieved progress.'; end if;
  update public.sponsor_objectives set name='Recruter Awet Khaled',
    description='Faire signer Awet Khaled, coureur RW au profil rouleur (note générale '||to_char(v_rating,'FM990.0')||'), avant la fin de la saison.',
    target_details=target_details||jsonb_build_object('riderId',v_new,'riderName','Awet Khaled','countryCode','RW',
      'sportingProfile','Rouleur','overallRating',v_rating,'replacedRetiredRiderId',v_old),updated_at=now()
    where id=v_objective.id;
  update public.objective_progress set status='in_progress',current_value=0,achieved_at=null,last_evaluated_at=null,
    details=coalesce(details,'{}'::jsonb)||jsonb_build_object('targetRiderId',v_new,'currentValue',0,'targetValue',1,
      'evaluatedStatus','in_progress','retiredTargetReplacement',jsonb_build_object('previousTarget',v_objective.target_details,
      'reason','Owner-approved replacement of retired recruitment target','replacedAt',now())),updated_at=now()
    where sponsor_objective_id=v_objective.id and team_sponsor_contract_id=v_contract and season_id=v_objective.season_id;
end $$;
commit;
