begin;

-- Préparation contrôlée du compte d'audit Antoine Morel 29 pour observer les
-- mécanismes de fin de saison. Toutes les actions joueur passent par les RPC
-- métier existantes afin de conserver leurs validations et effets financiers.
do $preparation$
declare
  v_auth_user_id constant uuid := '2ef55776-958b-4b0f-a0e1-123a7c0bb415';
  v_director_id constant uuid := 'db3cdafe-0284-4193-8e3c-82b506d8599a';
  v_team_id constant uuid := '817db772-6373-4b4a-bb01-a78b1107d546';
  v_team_season_id constant uuid := 'b3a33b4a-ed1c-44f2-8d5e-66eed259b00c';
  v_season_id constant uuid := 'afa6551b-3bb4-41a2-b394-0302f4275623';

  v_daniel constant uuid := 'ddac87ed-a7d3-49c7-be06-6af89e228cdb';
  v_arnould constant uuid := 'b9372e49-bc48-433a-9871-eb4bfa4af3d0';
  v_angoustan constant uuid := '6dda71c7-7b3d-425e-a35b-00ecf7a7ccb9';
  v_adelin constant uuid := 'd92ac70e-ca20-4c41-8c92-d4c9a142cbde';
  v_marius constant uuid := '451e2b84-ced6-4031-9dc9-78ff88b739dc';
  v_arolde constant uuid := '3c27ea60-c8e7-47f8-8a8a-f0843f6162e3';
  v_hildebert constant uuid := 'd36f8838-5575-4bad-a3a4-aa915aa5384f';

  v_free_agent_candidates constant uuid[] := array[
    'f992f2bb-8d2d-4521-9355-0548078bc3cb'::uuid, -- Davaakhuugiin Erdenechuluun
    '73d43f03-665d-4e95-b32b-1ba1c437655e'::uuid, -- Aden Yaseen
    'c5b12412-6780-423a-9af2-8ab7ca6e326e'::uuid  -- Bruno Crooks
  ];
  v_auction_candidates constant uuid[] := array[
    'a316e208-ed58-4919-933e-33dc0fae2225'::uuid, -- Suchinda Na
    '2c4db11c-415a-4e61-8cdd-b57cee8d6d51'::uuid, -- Finlay Ahrenberg
    '779c1a90-1e90-4aa4-aa0f-da426066339b'::uuid, -- Sergio Candelaria
    'f9d1cebf-681d-4715-a0ad-3bd7f7e9b54e'::uuid  -- Jean Bechtelar
  ];

  v_current_day integer;
  v_season_day_id uuid;
  v_cash_balance numeric;
  v_test_grant numeric;
  v_free_agent_id uuid;
  v_free_agent_contract_id uuid;
  v_staff_listing_id uuid;
  v_trainer_contract_id uuid;
  v_training_effective_day integer;
  v_training_plans_effective_day integer;
  v_saved_training_plan_count integer;
  v_auction_listing_id uuid;
  v_auction_bid numeric;
  v_auction_bid_id uuid;
  v_registration_count integer;
begin
  if not exists (
    select 1
    from public.sporting_directors as director
    join public.team_manager_assignments as assignment
      on assignment.sporting_director_id = director.id
     and assignment.team_id = v_team_id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    where director.id = v_director_id
      and director.auth_user_id = v_auth_user_id
      and director.username = 'Antoine Morel 29'
      and director.status = 'active'
  ) then
    raise exception 'Le compte actif Antoine Morel 29 est introuvable.';
  end if;

  select
    season.current_day_number,
    season_day.id,
    team_season.cash_balance
  into
    v_current_day,
    v_season_day_id,
    v_cash_balance
  from public.seasons as season
  join public.season_days as season_day
    on season_day.season_id = season.id
   and season_day.day_number = season.current_day_number
  join public.team_seasons as team_season
    on team_season.id = v_team_season_id
   and team_season.team_id = v_team_id
   and team_season.season_id = season.id
   and team_season.status = 'active'
  where season.id = v_season_id
    and season.status = 'active'
  for update of team_season;

  if not found or v_current_day <> 18 then
    raise exception 'La préparation est exclusivement prévue au jour 18 de la saison 2.';
  end if;

  -- Dotation minimale et traçable du compte d'audit : jamais plus que le
  -- complément nécessaire pour atteindre 60 000 €.
  v_test_grant := greatest(0, 60000 - v_cash_balance);
  if v_test_grant > 0 then
    insert into public.team_finance_transactions (
      team_season_id,
      season_day_id,
      day_number,
      amount,
      category,
      status,
      description,
      source_reference,
      posted_at
    ) values (
      v_team_season_id,
      v_season_day_id,
      v_current_day,
      v_test_grant,
      'other',
      'posted',
      'Dotation contrôlée du compte d’audit · fin de saison',
      'audit-endseason-preparation:antoine-morel-29',
      now()
    );

    update public.team_seasons
    set cash_balance = cash_balance + v_test_grant
    where id = v_team_season_id;
  end if;

  -- Les RPC identifient l'équipe depuis auth.uid(). Reproduire le contexte du
  -- compte de test permet de conserver strictement le parcours métier normal.
  perform set_config('request.jwt.claim.sub', v_auth_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_auth_user_id::text,
      'role', 'authenticated'
    )::text,
    true
  );

  -- Recrutement immédiat d'un agent libre modeste, sans historique sportif,
  -- sans contrat actif et absent des enchères.
  select rider.id
  into v_free_agent_id
  from public.riders as rider
  where rider.id = any(v_free_agent_candidates)
    and rider.status = 'free_agent'
    and rider.career_race_days = 0
    and not exists (
      select 1
      from public.rider_contracts as contract
      where contract.rider_id = rider.id
        and contract.status in ('active', 'planned')
    )
    and not exists (
      select 1
      from public.transfer_market_listings as listing
      where listing.rider_id = rider.id
        and listing.status = 'open'
    )
  order by array_position(v_free_agent_candidates, rider.id)
  for update skip locked
  limit 1;

  if v_free_agent_id is null then
    raise exception 'Aucun agent libre de test présélectionné n’est encore disponible.';
  end if;

  v_free_agent_contract_id := public.sign_current_team_free_agent(
    v_free_agent_id
  );

  -- Un entraîneur niveau 1 suffit pour tester l'embauche, la paie, la capacité
  -- de quatre coureurs et les bonus d'entraînement sans gonfler le staff.
  select listing.id
  into v_staff_listing_id
  from public.staff_market_listings as listing
  join public.staff_market_batches as batch
    on batch.id = listing.batch_id
  join public.staff_members as member
    on member.id = listing.staff_member_id
  where listing.status = 'available'
    and batch.market_date = (now() at time zone 'Europe/Paris')::date
    and member.role = 'trainer'
    and member.level = 1
  order by
    case listing.id
      when 'a4f81261-df02-4b6f-b114-c9801dda4b9b'::uuid then 0
      when 'ed95ec33-01f5-44ba-9754-06a7e57b7afb'::uuid then 1
      else 2
    end,
    listing.signing_fee,
    listing.id
  for update of listing skip locked
  limit 1;

  if v_staff_listing_id is null then
    raise exception 'Aucun entraîneur niveau 1 n’est encore disponible aujourd’hui.';
  end if;

  v_trainer_contract_id := public.hire_current_team_staff(
    v_staff_listing_id
  );

  v_training_effective_day := public.save_current_team_training_settings(60);

  select public.save_current_rider_training_plans(
    jsonb_build_array(
      jsonb_build_object(
        'rider_id', v_daniel,
        'intensity', 65,
        'domain', 'climber',
        'trainer_contract_id', v_trainer_contract_id
      ),
      jsonb_build_object(
        'rider_id', v_arnould,
        'intensity', 65,
        'domain', 'puncheur',
        'trainer_contract_id', v_trainer_contract_id
      ),
      jsonb_build_object(
        'rider_id', v_angoustan,
        'intensity', 60,
        'domain', 'rouleur',
        'trainer_contract_id', null
      ),
      jsonb_build_object(
        'rider_id', v_adelin,
        'intensity', 65,
        'domain', 'sprinter',
        'trainer_contract_id', null
      ),
      jsonb_build_object(
        'rider_id', v_marius,
        'intensity', 55,
        'domain', 'northern_classics',
        'trainer_contract_id', null
      ),
      jsonb_build_object(
        'rider_id', v_arolde,
        'intensity', 60,
        'domain', 'breakaway',
        'trainer_contract_id', v_trainer_contract_id
      ),
      jsonb_build_object(
        'rider_id', v_hildebert,
        'intensity', 55,
        'domain', 'stage_racer',
        'trainer_contract_id', v_trainer_contract_id
      ),
      jsonb_build_object(
        'rider_id', v_free_agent_id,
        'intensity', 50,
        'domain', 'rouleur',
        'trainer_contract_id', null
      )
    )
  ) into v_training_plans_effective_day;

  select count(*)::integer
  into v_saved_training_plan_count
  from public.rider_training_plan_versions as plan
  where plan.team_id = v_team_id
    and plan.season_id = v_season_id
    and plan.effective_from_day_number = v_training_plans_effective_day
    and plan.rider_id = any(array[
      v_daniel,
      v_arnould,
      v_angoustan,
      v_adelin,
      v_marius,
      v_arolde,
      v_hildebert,
      v_free_agent_id
    ]);

  if v_training_effective_day <> 19
    or v_training_plans_effective_day <> 19
    or v_saved_training_plan_count <> 8
  then
    raise exception 'La programmation des entraînements de fin de saison a échoué.';
  end if;

  -- Une enchère sans offre concurrente teste le règlement quotidien sans
  -- surenchérir contre un joueur réel.
  select listing.id, listing.minimum_bid
  into v_auction_listing_id, v_auction_bid
  from public.transfer_market_listings as listing
  where listing.id = any(v_auction_candidates)
    and listing.status = 'open'
    and now() >= listing.opens_at
    and now() < listing.closes_at
    and not exists (
      select 1
      from public.transfer_market_bids as bid
      where bid.listing_id = listing.id
    )
  order by
    array_position(v_auction_candidates, listing.id),
    listing.minimum_bid,
    listing.id
  for update skip locked
  limit 1;

  if v_auction_listing_id is null then
    raise exception 'Aucune enchère de test sans concurrent n’est encore ouverte.';
  end if;

  v_auction_bid_id := public.place_transfer_bid(
    v_auction_listing_id,
    v_auction_bid
  );

  -- Calendrier varié et sans chevauchement : pavés, sprint, tour complet,
  -- chrono, classique roulante, vallons et sprint final de saison.
  perform public.save_current_team_race_roster(
    'b38f0b13-2cdb-4d30-9f09-b697749266ed'::uuid,
    array[v_marius, v_arnould, v_arolde, v_hildebert, v_free_agent_id]
  );
  perform public.save_current_team_race_roster(
    '55c857fb-8905-4b09-8021-7a87ac65ced8'::uuid,
    array[v_adelin, v_marius, v_arnould, v_hildebert, v_free_agent_id]
  );
  perform public.save_current_team_race_roster(
    '60d3e6e2-484c-4d80-b842-523c2e20a3a7'::uuid,
    array[v_daniel, v_arnould, v_arolde, v_hildebert, v_free_agent_id, v_angoustan]
  );
  perform public.save_current_team_race_roster(
    '41613881-74b2-4197-a6bc-47a47bcdaf5a'::uuid,
    array[v_angoustan, v_adelin, v_hildebert, v_daniel, v_free_agent_id]
  );
  perform public.save_current_team_race_roster(
    'e9d04822-fa1f-47c2-aea8-ee74df031945'::uuid,
    array[v_marius, v_angoustan, v_adelin, v_hildebert, v_free_agent_id]
  );
  perform public.save_current_team_race_roster(
    'c22e7176-05b5-4e2b-bf7e-7e7e5a66374d'::uuid,
    array[v_arnould, v_arolde, v_daniel, v_hildebert, v_free_agent_id]
  );
  perform public.save_current_team_race_roster(
    '513d119e-34c6-478e-a9c0-3e2b49fb632e'::uuid,
    array[v_angoustan, v_free_agent_id, v_marius, v_adelin, v_arnould]
  );

  select count(*)::integer
  into v_registration_count
  from public.race_registrations as registration
  where registration.team_season_id = v_team_season_id
    and registration.race_edition_id = any(array[
      'b38f0b13-2cdb-4d30-9f09-b697749266ed'::uuid,
      '55c857fb-8905-4b09-8021-7a87ac65ced8'::uuid,
      '60d3e6e2-484c-4d80-b842-523c2e20a3a7'::uuid,
      '41613881-74b2-4197-a6bc-47a47bcdaf5a'::uuid,
      'e9d04822-fa1f-47c2-aea8-ee74df031945'::uuid,
      'c22e7176-05b5-4e2b-bf7e-7e7e5a66374d'::uuid,
      '513d119e-34c6-478e-a9c0-3e2b49fb632e'::uuid
    ])
    and registration.status = 'accepted';

  if v_registration_count <> 7 then
    raise exception 'La vérification finale des sept inscriptions a échoué.';
  end if;

  raise notice
    'Antoine Morel préparé : agent libre %, staff %, enchère %, entraînements J%, 7 courses.',
    v_free_agent_contract_id,
    v_trainer_contract_id,
    v_auction_bid_id,
    v_training_effective_day;
end;
$preparation$;

commit;
