begin;
set local lock_timeout='500ms';
set local statement_timeout='8s';
set local application_name='cyclostratege-owner-approved-pawar-return-20261106';

-- Owner-requested correction of this one recruitment. No other free agent,
-- historical result, reward or draft pool is rewritten.
do $restore_pawar$
declare
  v_rider constant uuid := 'ed560026-792d-456c-b4d6-484e46d9020a';
  v_season constant uuid := '7ea43c15-30fd-4878-b18f-ab2a43ad3be8';
  v_next constant uuid := 'a626036c-b5c7-4d5e-be10-9d4b748e6c25';
  v_buyer constant uuid := '6d29ce14-c55f-4e3e-bd73-59f410484210';
  v_samuel constant uuid := 'c7d4f299-3430-4aaf-a029-ac9b97a07ed2';
  v_buyer_ts constant uuid := '3704d760-5161-469b-baae-5395b7726503';
  v_samuel_ts constant uuid := '36dfc2d7-6102-456d-b49a-64bfdcb090a2';
  v_invalid_contract constant uuid := '08c6c30e-c972-4213-b31c-df6a5358c856';
  v_future_contract constant uuid := '9f63fedb-0738-4bb9-a601-69bd9d918f71';
  v_offer constant uuid := '70012872-d73e-497a-be9d-b7bcda127eeb';
  v_return_contract constant uuid := '83d8990f-25ce-4e45-9f0a-11f201a78af0';
  v_receipt constant text := 'owner-approved-pawar-return:20261106';
  v_acquired constant timestamptz := '2026-11-06T09:43:51.369774Z';
  v_samuel_cash numeric; v_buyer_cash numeric; v_rebate numeric; v_refund numeric;
  v_existing public.team_finance_transactions%rowtype;
begin
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(v_receipt,0)) then
    raise exception 'Pawar correction already running.' using errcode='55P03';
  end if;
  perform id from public.seasons where id=v_season and status='active' and game_year=5 and current_day_number=1 for share nowait;
  if not found then raise exception 'Expected active S5 J1 changed; audit again.'; end if;
  perform private.lock_direct_transfer_scope(v_season,array[v_buyer,v_samuel],array[v_rider]);
  perform id from public.riders where id=v_rider and first_name='Hemant' and last_name='Pawar' and status='active' for update nowait;
  if not found then raise exception 'Pawar identity/status changed; audit again.'; end if;
  select * into v_existing from public.team_finance_transactions where team_season_id=v_samuel_ts and source_reference=v_receipt;
  if found then
    if v_existing.status<>'posted' or v_existing.amount<=0 or not exists(
      select 1 from public.rider_contracts where id=v_return_contract and rider_id=v_rider and team_id=v_samuel
        and start_season_id=v_season and end_season_id=v_season
    ) or not exists(select 1 from public.rider_contracts where id=v_invalid_contract and status='cancelled')
      or not exists(select 1 from public.direct_transfer_offers where id=v_offer and status='cancelled') then
      raise exception 'Existing Pawar correction receipt is inconsistent.';
    end if;
    return;
  end if;
  select cash_balance into v_buyer_cash from public.team_seasons where id=v_buyer_ts and team_id=v_buyer and season_id=v_season and currency='EUR';
  select cash_balance into v_samuel_cash from public.team_seasons where id=v_samuel_ts and team_id=v_samuel and season_id=v_season and currency='EUR';
  if v_buyer_cash is null or v_samuel_cash is null then raise exception 'Expected team accounts changed.'; end if;
  perform id from public.direct_transfer_offers where id=v_offer and rider_id=v_rider and buyer_team_id=v_samuel and seller_team_id=v_buyer
    and season_id=v_season and effective_season_id=v_next and effective_contract_id=v_future_contract
    and status='accepted' and offered_amount=600 and offered_rider_id is null and escrowed_at is not null and released_at is null for update nowait;
  if not found then raise exception 'Expected accepted future transfer/escrow changed.'; end if;
  if not exists(select 1 from public.rider_contracts where id=v_invalid_contract and rider_id=v_rider and team_id=v_buyer
      and status='active' and acquisition_type='free_agent' and start_season_id=v_season and end_season_id=v_season and salary_per_season=13500)
    or not exists(select 1 from public.rider_contracts where id=v_future_contract and rider_id=v_rider and team_id=v_samuel
      and status='planned' and acquisition_type='direct_offer' and start_season_id=v_next and end_season_id=v_next and salary_per_season=12000 and transfer_fee=600)
    or exists(select 1 from public.rider_contracts where rider_id=v_rider and status in('active','planned') and id not in(v_invalid_contract,v_future_contract))
    or exists(select 1 from public.rider_contracts where rider_id=v_rider and team_id=v_samuel and start_season_id=v_season)
    or exists(select 1 from public.rider_contracts where id=v_return_contract) then
    raise exception 'Expected Pawar contracts changed; audit again.';
  end if;
  if not exists(select 1 from public.rider_contracts where id='a0862837-b113-42f1-b16d-87642b49f1b4' and rider_id=v_rider
    and team_id=v_samuel and status='completed' and salary_per_season=13000) then raise exception 'Historical Samuel contract changed.'; end if;
  if exists(select 1 from public.team_finance_transactions where team_season_id=v_buyer_ts and status='posted' and amount<0
      and source_reference like 'rider-salary:'||v_invalid_contract::text||':%') then raise exception 'Buyer has paid Pawar salary; audit refund first.'; end if;
  if exists(select 1 from public.rider_form_camps where rider_id=v_rider and team_season_id=v_buyer_ts and created_at>=v_acquired)
    or exists(select 1 from public.rider_performance_preparations where rider_id=v_rider and team_id=v_buyer and created_at>=v_acquired)
    or exists(select 1 from public.daily_reward_inventory where team_season_id=v_buyer_ts and used_at>=v_acquired and usage_payload->>'riderId'=v_rider::text)
    or exists(select 1 from public.halloween_rider_effects where rider_id=v_rider and used_at>=v_acquired)
    or exists(select 1 from public.rider_training_sessions where rider_id=v_rider and team_id=v_buyer and processed_at>=v_acquired)
    or exists(select 1 from public.rider_daily_nutrition_effects where rider_id=v_rider and team_id=v_buyer and applied_at>=v_acquired) then
    raise exception 'New Pawar investment appeared; audit compensation first.';
  end if;
  if exists(select 1 from public.race_rosters rr join public.race_registrations reg on reg.id=rr.race_registration_id
      join public.race_editions e on e.id=reg.race_edition_id where rr.rider_id=v_rider and reg.team_season_id=v_buyer_ts and e.status='in_progress') then
    raise exception 'Pawar has an in-progress race; audit again.';
  end if;
  if not exists(select 1 from public.team_finance_transactions where team_season_id=v_samuel_ts and status='posted' and amount=-600
    and source_reference='direct-transfer-purchase:'||v_offer::text) then raise exception 'Expected 600 EUR escrow debit missing.'; end if;
  select coalesce(sum(amount),0) into v_rebate from public.team_finance_transactions where team_season_id=v_samuel_ts and status='posted'
    and source_reference='data-room-transfer-rebate:'||v_future_contract::text;
  if v_rebate<0 or v_rebate>=600 then raise exception 'Unexpected transfer rebate; audit refund first.'; end if;
  v_refund:=600-v_rebate;

  -- Cancel the binding offer before changing either protected contract. Keep
  -- the already negotiated S6 salary/type, avoiding a second renewal discount.
  -- A cancelled deferred offer must release its contract/escrow pointers (the
  -- deferred_shape constraint). Keep its future season and audit the former
  -- pointers in the cancellation note; the S6 contract itself stays intact.
  update public.direct_transfer_offers set status='cancelled',
    response_note=format('Annulation exceptionnelle validée par le propriétaire : retour immédiat de Hemant Pawar chez SamuelRodri. Contrat S6 conservé : %s ; séquestre initial : %s ; remboursement net : %s EUR.',
      v_future_contract,escrowed_at,v_refund),
    effective_contract_id=null,offered_effective_contract_id=null,
    escrowed_at=null,released_at=null,released_team_season_id=null
  where id=v_offer;
  update public.rider_contracts set transfer_fee=0,transfer_locked_season_id=null where id=v_future_contract;
  -- Cancellation excludes the invalid signing from the seasonal team-change
  -- counter. Normal finance triggers cancel the four unpaid buyer salaries.
  update public.rider_contracts set status='cancelled',transfer_locked_season_id=null where id=v_invalid_contract;
  -- The preserved S6 successor suppresses generic departure cleanup, so detach
  -- this source club explicitly. Owned equipment stays in its inventory.
  perform public.detach_departing_rider(v_rider,v_buyer,v_season,1);
  delete from public.race_stage_equipment_assignments a using public.stages stage
  where a.rider_id=v_rider and a.team_season_id=v_buyer_ts and stage.id=a.stage_id and stage.status not in('in_progress','completed','cancelled');
  update public.rider_training_plan_versions set trainer_contract_id=null where rider_id=v_rider and team_id=v_buyer and season_id=v_season and effective_from_day_number>=1;
  insert into public.rider_contracts(id,rider_id,team_id,start_season_id,end_season_id,salary_per_season,currency,currency_code,
    status,signed_at,acquisition_type,transfer_locked_season_id,transfer_fee,squad_status)
  values(v_return_contract,v_rider,v_samuel,v_season,v_season,13000,'EUR','EUR','active',now(),'renewal',null,0,'absolute_leader');
  insert into public.team_finance_transactions(team_season_id,day_number,amount,category,status,description,source_reference,posted_at)
  values(v_samuel_ts,1,v_refund,'other','posted','Remboursement net de l’indemnité bloquée · retour exceptionnel de Hemant Pawar',v_receipt,now());
  update public.team_seasons set cash_balance=cash_balance+v_refund where id=v_samuel_ts;

  if (select cash_balance from public.team_seasons where id=v_buyer_ts)<>v_buyer_cash
    or (select cash_balance from public.team_seasons where id=v_samuel_ts)<>v_samuel_cash+v_refund
    or exists(select 1 from public.team_finance_transactions where team_season_id=v_buyer_ts and status='pending'
      and source_reference like 'rider-salary:'||v_invalid_contract::text||':%')
    or not exists(select 1 from public.rider_contracts where id=v_return_contract and status='active' and team_id=v_samuel and salary_per_season=13000)
    or not exists(select 1 from public.rider_contracts where id=v_future_contract and status='planned' and team_id=v_samuel and salary_per_season=12000 and transfer_fee=0)
  then raise exception 'Pawar restoration postconditions failed.'; end if;
end;
$restore_pawar$;

commit;
