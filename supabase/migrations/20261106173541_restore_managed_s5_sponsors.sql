begin;
set local lock_timeout='500ms';
set local statement_timeout='8s';
set local application_name='managed-s5-owner-approved-sponsor-renewals';

-- Owner-authorized exceptional S5 renewals. New legal S5 contracts preserve
-- every S4 contract, offer, payment and account; no immediate cash is granted.
do $restore_managed_sponsors$
declare
  v_s4 constant uuid:='c0c5824c-43a4-442e-907c-265c479efa0a';
  v_s5 constant uuid:='7ea43c15-30fd-4878-b18f-ab2a43ad3be8';
  v_teams constant uuid[]:=array['817db772-6373-4b4a-bb01-a78b1107d546'::uuid,'61c5aac7-4917-48ed-b861-ebf5eea2d754'::uuid];
  v_old_ids constant uuid[]:=array['b9032060-2683-44b4-8b89-1f490f3149fc'::uuid,'d77de87f-c544-43d2-897c-2ae80842cdcb'::uuid];
  v_new_ids constant uuid[]:=array['476e16f2-d644-41b0-9715-c4ac64ed9872'::uuid,'10e6063e-7928-43b8-a361-b9c2d0239413'::uuid];
  v_offer_ids constant uuid[]:=array['e9353b68-b7c6-4a9a-a1d7-a96f84a89e07'::uuid,'066e9270-cfd0-48ca-81b8-8ccad5d9f330'::uuid];
  v_spec record;v_fn record;v_old public.team_sponsor_contracts%rowtype;v_new public.team_sponsor_contracts%rowtype;
  v_old_contracts jsonb;v_old_offers jsonb;v_s4_accounts jsonb;v_s4_ledger text;v_s5_cash jsonb;
  v_count integer;v_expected numeric;v_existing integer;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('managed-s5-sponsor-renewals-20261106',0)) then
    raise exception 'Managed sponsor renewal is already running.' using errcode='55P03';
  end if;
  perform id from public.seasons where id=v_s5 and status='active' and game_year=5 and current_day_number=1 for share nowait;
  if not found then raise exception 'Expected active S5 J1 changed; audit again.';end if;
  for v_fn in select * from (values
    ('public.sync_sponsor_installments(uuid)','f3a2693e1e972dece7ed0a0dddfb4e62'),
    ('public.handle_finance_contract_change()','c8da313b5e85d68955b61f8666a9aa74'),
    ('public.initialize_professional_team_finances(uuid)','7c0eac1f5b1e59e73e69fa1184fdbba8'),
    ('private.prevent_sponsor_team_conflicts()','4e1b954c653266335f48aa5cb2d511fa'),
    ('private.enforce_global_sponsoring_unlock()','22a50cf2e87d1b7e1afa507370e980c6'),
    ('public.apply_media_sponsor_contract_bonus()','8e702323d74f30a89317b163d5583e3c')
  ) f(signature,expected_hash) loop
    if md5(replace(pg_get_functiondef(v_fn.signature::regprocedure),chr(13),''))<>v_fn.expected_hash then
      raise exception 'Sponsor renewal function changed: %',v_fn.signature;
    end if;
  end loop;
  perform id from public.team_sponsor_contracts where id=any(v_old_ids) order by id for update nowait;
  perform id from public.team_seasons where team_id=any(v_teams) and season_id in(v_s4,v_s5) order by id for update nowait;
  if (select count(*) from public.team_seasons where team_id=any(v_teams) and season_id in(v_s4,v_s5))<>4 then
    raise exception 'Expected S4 and S5 team accounts are missing.';
  end if;
  if exists(select 1 from public.team_seasons where team_id=any(v_teams) and season_id=v_s5 and next_sponsor_budget_bonus_percent<>0) then
    raise exception 'Unexpected S5 sponsor bonus; review the authorized payment totals.';
  end if;
  select jsonb_agg(to_jsonb(c) order by c.id) into v_old_contracts from public.team_sponsor_contracts c where c.id=any(v_old_ids);
  select jsonb_agg(to_jsonb(o) order by o.id) into v_old_offers from public.sponsor_offers o
    where o.id in(select sponsor_offer_id from public.team_sponsor_contracts where id=any(v_old_ids));
  select jsonb_agg(to_jsonb(ts) order by ts.id) into v_s4_accounts from public.team_seasons ts where ts.team_id=any(v_teams) and ts.season_id=v_s4;
  select jsonb_agg(jsonb_build_object('id',ts.id,'cash',ts.cash_balance) order by ts.id) into v_s5_cash
    from public.team_seasons ts where ts.team_id=any(v_teams) and ts.season_id=v_s5;
  select count(*),md5(string_agg(md5(to_jsonb(f)::text),'|' order by f.id)) into v_count,v_s4_ledger
    from (select f.* from public.team_finance_transactions f join public.team_seasons ts on ts.id=f.team_season_id
      where ts.team_id=any(v_teams) and ts.season_id=v_s4 order by f.id limit 1001) f;
  if v_count>=1001 then raise exception 'S4 audit limit reached; review before changing contracts.';end if;
  select count(*) into v_existing from public.team_sponsor_contracts where id=any(v_new_ids);
  if v_existing not in(0,2) then raise exception 'Partial managed renewal state; inspect before continuing.';end if;
  for v_spec in select * from (values
    ('antoine_morel_29','817db772-6373-4b4a-bb01-a78b1107d546'::uuid,'db3cdafe-0284-4193-8e3c-82b506d8599a'::uuid,
      'b9032060-2683-44b4-8b89-1f490f3149fc'::uuid,'476e16f2-d644-41b0-9715-c4ac64ed9872'::uuid,'e9353b68-b7c6-4a9a-a1d7-a96f84a89e07'::uuid,
      'd3953d22-c968-4e15-aecc-79303178ea1d'::uuid,570000::numeric,'maison-lannic-modern','modern'),
    ('giulia_rinaldi','61c5aac7-4917-48ed-b861-ebf5eea2d754'::uuid,'d2efc4d7-aeea-4778-941e-092f12ed4c5f'::uuid,
      'd77de87f-c544-43d2-897c-2ae80842cdcb'::uuid,'10e6063e-7928-43b8-a361-b9c2d0239413'::uuid,'066e9270-cfd0-48ca-81b8-8ccad5d9f330'::uuid,
      '2e301532-1fb0-47db-b3f4-9939624ba86b'::uuid,340000::numeric,'dong-duong-phanh-modern','modern')
  ) x(bot_key,team_id,director_id,old_id,new_id,offer_id,sponsor_id,budget,jersey_id,jersey_style) loop
    if not exists(select 1 from public.alpha_bot_managers b join public.sporting_directors d on d.id=b.sporting_director_id
      join public.team_manager_assignments a on a.team_id=b.team_id and a.sporting_director_id=d.id and a.role='general_manager' and a.status='active'
      where b.bot_key=v_spec.bot_key and b.team_id=v_spec.team_id and d.id=v_spec.director_id and d.status='active'
        and b.auth_user_id=d.auth_user_id and not b.enabled) then raise exception 'Managed sponsor owner changed.';end if;
    select * into v_old from public.team_sponsor_contracts where id=v_spec.old_id;
    if v_old.id is null or v_old.team_id<>v_spec.team_id or v_old.sponsor_id<>v_spec.sponsor_id or v_old.role<>'principal'
      or v_old.start_season_id<>v_s4 or v_old.end_season_id<>v_s4 or v_old.contract_duration_seasons<>1
      or v_old.status<>'completed' or v_old.completed_at is null or v_old.terminated_at is not null
      or v_old.budget_per_season<>v_spec.budget or v_old.currency_code<>'EUR'
      or v_old.selected_jersey_id<>v_spec.jersey_id or v_old.selected_jersey_style<>v_spec.jersey_style then
      raise exception 'Historical sponsor contract changed: %',v_spec.bot_key;
    end if;
    if v_existing=0 then
      if exists(select 1 from public.team_sponsor_contracts c join public.seasons s on s.id=c.start_season_id
        where c.team_id=v_spec.team_id and c.role='principal' and c.status in('active','planned')
          and s.game_year<=5 and s.game_year+c.contract_duration_seasons-1>=5)
        or exists(select 1 from public.sponsor_offers o where o.id=v_spec.offer_id
          or(o.sponsor_id=v_spec.sponsor_id and o.season_id=v_s5 and o.sporting_director_id=v_spec.director_id and o.status in('open','accepted')))
      then raise exception 'A competing current sponsor plan already exists.';end if;
      insert into public.sponsor_offers(id,sponsor_id,season_id,sporting_director_id,title,description,
        budget_per_season,base_budget_per_season,negotiation_budget_ceiling,objective_difficulty,currency_code,
        contract_duration_seasons,available_from,available_until,status,generation_version,continuing_contract_id)
      values(v_spec.offer_id,v_spec.sponsor_id,v_s5,v_spec.director_id,'Partenariat reconduit · Saison 5',
        'Poursuite du partenariat de la saison précédente aux mêmes conditions financières.',
        v_spec.budget,v_spec.budget,v_spec.budget,'balanced','EUR',1,now(),null,'accepted',10,null);
      insert into public.team_sponsor_contracts(id,team_id,sponsor_id,sponsor_offer_id,role,start_season_id,end_season_id,
        budget_per_season,currency_code,status,contract_duration_seasons,selected_jersey_id,selected_jersey_style,
        signed_at,activated_at,objective_season_id,previous_team_display_name,previous_team_short_name)
      select v_spec.new_id,v_spec.team_id,v_spec.sponsor_id,v_spec.offer_id,'principal',v_s5,v_s5,
        v_spec.budget,'EUR','active',1,v_spec.jersey_id,v_spec.jersey_style,now(),now(),v_s5,ts.display_name,ts.short_name
      from public.team_seasons ts where ts.team_id=v_spec.team_id and ts.season_id=v_s5;
      update public.team_seasons set operating_budget=v_spec.budget where team_id=v_spec.team_id and season_id=v_s5;
    end if;
    select * into v_new from public.team_sponsor_contracts where id=v_spec.new_id;
    if v_new.id is null or v_new.team_id<>v_spec.team_id or v_new.sponsor_id<>v_spec.sponsor_id or v_new.sponsor_offer_id<>v_spec.offer_id
      or v_new.start_season_id<>v_s5 or v_new.end_season_id<>v_s5 or v_new.objective_season_id<>v_s5
      or v_new.status<>'active' or v_new.contract_duration_seasons<>1 or v_new.budget_per_season<>v_spec.budget
      or v_new.selected_jersey_id<>v_spec.jersey_id or v_new.selected_jersey_style<>v_spec.jersey_style then
      raise exception 'Unexpected renewed contract or repricing: %',v_spec.bot_key;
    end if;
    if not exists(select 1 from public.sponsor_offers o where o.id=v_spec.offer_id and o.sponsor_id=v_spec.sponsor_id
      and o.season_id=v_s5 and o.sporting_director_id=v_spec.director_id and o.status='accepted'
      and o.contract_duration_seasons=1 and o.budget_per_season=v_spec.budget and o.base_budget_per_season=v_spec.budget
      and o.currency_code='EUR' and o.continuing_contract_id is null)
      or not exists(select 1 from public.team_seasons where team_id=v_spec.team_id and season_id=v_s5 and operating_budget=v_spec.budget)
    then raise exception 'S5 sponsor offer or operating budget is inconsistent.';end if;
    select count(*),sum(f.amount) into v_count,v_expected from public.team_finance_transactions f
      join public.team_seasons ts on ts.id=f.team_season_id
      where ts.team_id=v_spec.team_id and ts.season_id=v_s5 and f.category='sponsor'
        and f.source_reference like 'sponsor:'||v_spec.new_id::text||':'||v_s5::text||':%'
        and f.status='pending' and f.day_number in(7,14,21,28);
    if v_count<>4 or v_expected<>v_spec.budget
      or (select count(*) from public.team_finance_transactions f where f.source_reference like 'sponsor:'||v_spec.new_id::text||':%')<>4
      or exists(select 1 from public.team_finance_transactions f
      where f.source_reference like 'sponsor:'||v_spec.new_id::text||':%' and f.status='posted') then
      raise exception 'Expected four normal future sponsor installments.';
    end if;
  end loop;
  if (select jsonb_agg(to_jsonb(c) order by c.id) from public.team_sponsor_contracts c where c.id=any(v_old_ids)) is distinct from v_old_contracts
    or(select jsonb_agg(to_jsonb(o) order by o.id) from public.sponsor_offers o where o.id in(select sponsor_offer_id from public.team_sponsor_contracts where id=any(v_old_ids))) is distinct from v_old_offers
    or(select jsonb_agg(to_jsonb(ts) order by ts.id) from public.team_seasons ts where ts.team_id=any(v_teams) and ts.season_id=v_s4) is distinct from v_s4_accounts
    or(select jsonb_agg(jsonb_build_object('id',ts.id,'cash',ts.cash_balance) order by ts.id) from public.team_seasons ts where ts.team_id=any(v_teams) and ts.season_id=v_s5) is distinct from v_s5_cash
    or(select md5(string_agg(md5(to_jsonb(f)::text),'|' order by f.id)) from (select f.* from public.team_finance_transactions f join public.team_seasons ts on ts.id=f.team_season_id where ts.team_id=any(v_teams) and ts.season_id=v_s4 order by f.id limit 1001)f) is distinct from v_s4_ledger
  then raise exception 'Historical S4 state or immediate cash changed; renewal rolled back.';end if;
end;
$restore_managed_sponsors$;

commit;
