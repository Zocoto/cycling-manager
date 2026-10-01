begin;

do $reset_denis_gregoire_s4_sponsor_choice$
declare
  v_director_id constant uuid := '42ee1bb6-94fb-4b0b-9bfc-9f2f0defc539';
  v_team_id constant uuid := '20bcbcf8-7f09-42b7-b4be-ce77d4aade10';
  v_contract_id constant uuid := 'ba57b131-8fa4-4a50-9af5-b206483bab2c';
  v_wrong_offer_id constant uuid := '6a0fb866-9d96-4633-88bf-9baca52c21e2';
  v_glen_offer_id constant uuid := 'e177991b-5226-4219-a809-f2cbbcc25d87';
  v_wrong_sponsor_id constant uuid := '1fe4c041-6c61-4ec0-9f5e-68d0605fd956';
  v_glen_sponsor_id constant uuid := '3ee616f4-3b98-4847-89d5-baebb94f7180';
  v_contract public.team_sponsor_contracts%rowtype;
  v_wrong_offer public.sponsor_offers%rowtype;
  v_glen_offer public.sponsor_offers%rowtype;
  v_dependency_count integer;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('reset-denis-gregoire-s4-sponsor-choice', 0)
  );

  perform 1
  from public.sporting_directors as director
  where director.id = v_director_id
    and director.status = 'active'
    and (
      lower(btrim(director.display_name)) = 'dénis gregoire'
      or lower(btrim(director.username)) = 'dgreg'
    );

  if not found then
    raise exception
      'Le compte actif de Dénis Grégoire est introuvable.';
  end if;

  perform 1
  from public.team_manager_assignments as assignment
  where assignment.sporting_director_id = v_director_id
    and assignment.team_id = v_team_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active';

  if not found then
    raise exception
      'L’équipe active de Dénis Grégoire est introuvable.';
  end if;

  select *
  into v_wrong_offer
  from public.sponsor_offers
  where id = v_wrong_offer_id
    and sporting_director_id = v_director_id
    and sponsor_id = v_wrong_sponsor_id
  for update;

  if not found then
    raise exception
      'L’offre Tunis Panorama Cinemas à annuler est introuvable.';
  end if;

  select *
  into v_glen_offer
  from public.sponsor_offers
  where id = v_glen_offer_id
    and sporting_director_id = v_director_id
    and sponsor_id = v_glen_sponsor_id
    and season_id = v_wrong_offer.season_id
  for update;

  if not found then
    raise exception
      'L’offre de renouvellement Glen Durnach est introuvable.';
  end if;

  select *
  into v_contract
  from public.team_sponsor_contracts
  where id = v_contract_id
    and team_id = v_team_id
    and start_season_id = v_glen_offer.season_id
    and role = 'principal'
    and status = 'planned'
  for update;

  if not found then
    raise exception
      'Le contrat sponsor S4 planifié à réparer est introuvable.';
  end if;

  if v_contract.sponsor_offer_id = v_glen_offer_id
    and v_contract.sponsor_id = v_glen_sponsor_id
  then
    if v_contract.selected_jersey_id is not null
      or v_contract.selected_jersey_style is not null
      or v_contract.pending_jersey_id is not null
      or v_contract.pending_jersey_style is not null
    then
      raise exception
        'Le contrat Glen Durnach déjà réparé possède un choix de maillot inattendu.';
    end if;

    update public.sponsor_offers
    set status = 'withdrawn'
    where id = v_wrong_offer_id;

    update public.sponsor_offers
    set status = 'accepted'
    where id = v_glen_offer_id;

    return;
  end if;

  if v_contract.sponsor_offer_id is distinct from v_wrong_offer_id
    or v_contract.sponsor_id is distinct from v_wrong_sponsor_id
    or v_contract.selected_jersey_id is not null
    or v_contract.selected_jersey_style is not null
    or v_contract.pending_jersey_id is not null
    or v_contract.pending_jersey_style is not null
  then
    raise exception
      'Le contrat S4 de Dénis Grégoire ne correspond plus à l’état erroné audité.';
  end if;

  if v_wrong_offer.status <> 'accepted'
    or v_glen_offer.status <> 'withdrawn'
  then
    raise exception
      'Les statuts des offres sponsor ont changé depuis l’audit.';
  end if;

  select
    (select count(*) from public.objective_progress
      where team_sponsor_contract_id = v_contract_id)
    + (select count(*) from public.sponsor_annual_budget_repair_audit
      where team_sponsor_contract_id = v_contract_id)
    + (select count(*) from public.sponsor_annual_objective_history
      where team_sponsor_contract_id = v_contract_id)
    + (select count(*) from public.sponsor_offers
      where continuing_contract_id = v_contract_id)
    + (select count(*) from public.sponsor_satisfaction_events
      where team_sponsor_contract_id = v_contract_id)
    + (select count(*) from public.sporting_director_sponsor_trophies
      where team_sponsor_contract_id = v_contract_id)
  into v_dependency_count;

  if v_dependency_count <> 0 then
    raise exception
      'Le contrat sponsor erroné possède désormais % dépendance(s) métier.',
      v_dependency_count;
  end if;

  update public.sponsor_offers
  set status = 'withdrawn'
  where id = v_wrong_offer_id;

  update public.sponsor_offers
  set status = 'accepted'
  where id = v_glen_offer_id;

  update public.team_sponsor_contracts
  set sponsor_id = v_glen_offer.sponsor_id,
      sponsor_offer_id = v_glen_offer.id,
      budget_per_season = round(
        v_glen_offer.budget_per_season
          * (1 + reputation_budget_bonus_percent / 100.0),
        2
      ),
      currency_code = v_glen_offer.currency_code,
      contract_duration_seasons = v_glen_offer.contract_duration_seasons,
      selected_jersey_id = null,
      selected_jersey_style = null,
      pending_jersey_id = null,
      pending_jersey_style = null,
      pending_jersey_season_id = null,
      pending_sponsor_offer_id = null
  where id = v_contract_id;

  if not found then
    raise exception
      'Le contrat sponsor S4 de Dénis Grégoire n’a pas été réparé.';
  end if;

  raise notice
    'Contrat S4 de Dénis Grégoire réinitialisé sur Glen Durnach, sans choix de maillot.';
end;
$reset_denis_gregoire_s4_sponsor_choice$;

commit;
