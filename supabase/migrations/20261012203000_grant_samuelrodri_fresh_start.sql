begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

-- Opération exceptionnelle explicitement validée par le propriétaire :
-- 150 000 EUR, onze libérations sans indemnité, onze renouvellements annulés.
-- Les fiches, notes, palmarès et contrats historiques ne sont pas supprimés.
do $fresh_start$
declare
  v_team constant uuid := 'c7d4f299-3430-4aaf-a029-ac9b97a07ed2';
  v_director constant uuid := '266044fe-2b1d-4aeb-bbd6-eb3be00ae458';
  v_team_season constant uuid := '94e82d7f-40d5-40a6-8d49-6455de0bfbb2';
  v_season constant uuid := 'c0c5824c-43a4-442e-907c-265c479efa0a';
  v_ref constant text := 'owner-approved-fresh-start:samuelrodri:20261012';
  v_riders uuid[];
  v_current_contracts uuid[];
  v_renewals uuid[];
  v_targets jsonb;
  v_balance numeric;
  v_day integer;
  v_existing record;
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(v_ref, 0));
  select cash_balance into v_balance from public.team_seasons
  where id = v_team_season and team_id = v_team and season_id = v_season and currency = 'EUR'
  for update;
  if v_balance is null then raise exception 'Équipe/saison/devise de SamuelRodri inattendue.'; end if;

  select * into v_existing from public.team_finance_transactions
  where team_season_id = v_team_season and source_reference = v_ref;
  if found then
    if v_existing.amount <> 150000 or v_existing.status <> 'posted' or v_existing.category <> 'other' then
      raise exception 'Le versement existant est incohérent : aucune nouvelle opération.';
    end if;
    raise notice 'Aide déjà appliquée : aucun nouveau versement ni nouvelle libération.';
    return;
  end if;

  if not exists (
    select 1 from public.sporting_directors d join public.team_manager_assignments a
      on a.sporting_director_id = d.id and a.team_id = v_team
      and a.status = 'active' and a.role = 'general_manager'
    where d.id = v_director and d.status = 'active' and lower(d.username) = 'samuelrodri'
  ) then raise exception 'Le DS actif ne correspond plus à SamuelRodri.'; end if;
  select current_day_number into v_day from public.seasons
  where id = v_season and status = 'active' and game_year = 4;
  if v_day is null then raise exception 'La saison 4 active a changé : revérifier avant intervention.'; end if;

  select array_agg(rider_id), array_agg(current_contract), array_agg(renewal), jsonb_agg(to_jsonb(targets))
  into v_riders, v_current_contracts, v_renewals, v_targets
  from (values
    ('32deb232-d046-4e96-9e9b-652ff21be7bd'::uuid, '75f8cda4-0e3c-43a9-9e86-753b80e4ecf5'::uuid, 'a32e8080-60c0-4d26-9db2-fb79db748455'::uuid, 6500, 6500),
    ('1dc1e05b-6352-44bb-8a82-3826d50ccde9'::uuid, '5615a21b-6db3-4324-bf68-c7bee8a680f1'::uuid, '60acf14f-b476-499a-931b-255f4161facf'::uuid, 9500, 9500),
    ('a5bb90ef-6136-4d64-a7be-dd23180de9c5'::uuid, 'd9d937db-89d0-4114-9417-2b05c555a204'::uuid, '633a2abc-5c2a-42c4-957e-dfead1a2736a'::uuid, 6500, 7000),
    ('bc882c3f-0263-47ec-8fa0-4e4084b081bc'::uuid, '3301c934-6cf3-40b8-849f-1f898b4b2159'::uuid, '432220d4-d649-4c73-9c85-bb50c293b953'::uuid, 8000, 8500),
    ('4ee9fdaf-4231-4a3a-b785-d7e638d86543'::uuid, 'e251b3e5-71aa-47e6-8805-e74f677aff26'::uuid, '3da71a33-726d-4416-90de-16871ad8e18d'::uuid, 6000, 6000),
    ('b690037c-c8a8-462e-b308-80fbe2fecb15'::uuid, 'a3566c3a-2f04-4a2a-a833-676928383aad'::uuid, 'b88988f7-0b98-415b-9d5d-60e4de2bb37d'::uuid, 6000, 6000),
    ('b1ac05ed-8c18-4ffc-a1a8-efde6bbaaa63'::uuid, 'f8847e1e-35a2-4f46-bbb3-ede57a81553f'::uuid, 'd52d06d4-c1c4-41cb-b41b-4d803206fecf'::uuid, 6000, 6000),
    ('8219199b-ad3f-4289-862c-38296bdc0bcb'::uuid, '467c1b98-387c-4712-a393-4583c5fbc578'::uuid, '330a0de3-fc55-45ff-a102-df98d7625976'::uuid, 6000, 6000),
    ('2aaf9f90-4408-4a6c-adb7-09c23e4738a8'::uuid, 'bc96fab8-5770-4338-9cab-1dd9db5c55ab'::uuid, '7e983133-d1be-4c2b-80fd-631ca8a47073'::uuid, 8000, 8000),
    ('14d3cbc2-24e2-4dae-bb1f-b019a4ec01ff'::uuid, '84f6f287-fe24-4081-b6aa-9f9ce8e5baa6'::uuid, '16ef6b43-8af7-400f-abe0-35726f6861b5'::uuid, 8500, 8500),
    ('ef8297ef-b626-45d8-a2ed-750f3488ab4b'::uuid, '53c25e5a-31c1-427d-bd32-18368da05076'::uuid, 'b3ec9eb4-bb7b-4414-b3e9-99b9464ec1a9'::uuid, 10500, 11000)
  ) targets(rider_id, current_contract, renewal, current_salary, next_salary);
  if cardinality(v_riders) <> 11 then raise exception 'Onze coureurs exactement sont requis.'; end if;

  -- Verrouillage uniquement des contrats et coureurs expressément approuvés.
  perform 1 from public.rider_contracts
  where id = any(v_current_contracts || v_renewals) order by id for update;
  perform 1 from public.riders where id = any(v_riders) order by id for update;
  if exists (
    select 1 from jsonb_to_recordset(v_targets) as target(
      rider_id uuid, current_contract uuid, renewal uuid, current_salary numeric, next_salary numeric
    ) left join public.rider_contracts current_contract on current_contract.id = target.current_contract
      left join public.rider_contracts renewal on renewal.id = target.renewal
    where current_contract.rider_id is distinct from target.rider_id
      or current_contract.salary_per_season is distinct from target.current_salary
      or renewal.rider_id is distinct from target.rider_id
      or renewal.salary_per_season is distinct from target.next_salary
  ) then raise exception 'Une identité de contrat ou un salaire a changé depuis la validation.'; end if;
  if (select count(*) from public.rider_contracts c
      where c.id = any(v_current_contracts) and c.rider_id = any(v_riders)
        and c.team_id = v_team and c.status = 'active' and c.end_season_id = v_season) <> 11
    or (select sum(salary_per_season) from public.rider_contracts where id = any(v_current_contracts)) <> 81500
    or (select count(*) from public.rider_contracts c join public.seasons s on s.id = c.start_season_id
      where c.id = any(v_renewals) and c.rider_id = any(v_riders)
        and c.team_id = v_team and c.status = 'planned' and s.game_year = 5) <> 11
    or (select sum(salary_per_season) from public.rider_contracts where id = any(v_renewals)) <> 83000
    or (select count(*) from public.riders where id = any(v_riders) and status = 'active') <> 11
  then raise exception 'Les onze contrats/renouvellements ne correspondent plus à la validation.'; end if;
  if exists (
    select 1 from public.rider_contracts c where c.rider_id = any(v_riders)
      and c.status in ('active', 'planned') and not (c.id = any(v_current_contracts || v_renewals))
  ) then raise exception 'Un autre contrat actif/prévu existe : ne pas toucher aux engagements tiers.'; end if;
  if exists (
    select 1 from public.transfer_market_listings l join public.transfer_market_bids b on b.listing_id = l.id
    where l.rider_id = any(v_riders) and l.status = 'open'
  ) then raise exception 'Une enchère avec offres est en cours : arbitrage nécessaire.'; end if;

  update public.transfer_market_listings set status = 'cancelled', settled_at = now()
  where rider_id = any(v_riders) and seller_team_id = v_team and status = 'open';

  -- Les triggers normaux annulent les échéances, datent le départ, déséquipent
  -- les coureurs et retirent leurs sélections futures, sans effacer les résultats.
  -- Annuler d'abord les renouvellements évite une double exécution du départ.
  update public.rider_contracts set status = 'cancelled'
  where id = any(v_renewals) and team_id = v_team and status = 'planned';
  get diagnostics v_count = row_count;
  if v_count <> 11 then raise exception 'Nombre de renouvellements annulés inattendu : %.', v_count; end if;
  update public.rider_contracts set status = 'terminated'
  where id = any(v_current_contracts) and team_id = v_team and status = 'active';
  get diagnostics v_count = row_count;
  if v_count <> 11 then raise exception 'Nombre de libérations inattendu : %.', v_count; end if;
  update public.riders set status = 'free_agent' where id = any(v_riders) and status = 'active';
  get diagnostics v_count = row_count;
  if v_count <> 11 then raise exception 'Nombre de coureurs libérés inattendu : %.', v_count; end if;

  if exists (
    select 1 from public.team_finance_transactions
    where team_season_id = v_team_season and status = 'pending' and category = 'rider_salary'
      and split_part(source_reference, ':', 2) = any(
        select contract_id::text from unnest(v_current_contracts || v_renewals) contract_id
      )
  ) then raise exception 'Des salaires des coureurs libérés sont encore en attente.'; end if;

  insert into public.team_finance_transactions (
    team_season_id, day_number, amount, category, status, description, source_reference, posted_at
  ) values (
    v_team_season, v_day, 150000, 'other', 'posted',
    'Aide exceptionnelle validée · 11 coureurs libérés sans indemnité et renouvellements annulés',
    v_ref, now()
  );
  update public.team_seasons set cash_balance = cash_balance + 150000 where id = v_team_season;
  if (select cash_balance from public.team_seasons where id = v_team_season) <> v_balance + 150000 then
    raise exception 'Le crédit net ne correspond pas exactement aux 150 000 EUR approuvés.';
  end if;
  raise notice 'SamuelRodri : 11 libérations, 11 renouvellements annulés, aide 150000 EUR, solde % -> %.',
    v_balance, v_balance + 150000;
end;
$fresh_start$;

commit;
