begin;

-- Compensation grants are explicit inventory sources, like daily claims and
-- referral milestones, so an administrative gift remains traceable.
create table public.transfer_auction_compensation_grants (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null
    references public.transfer_market_listings(id) on delete restrict,
  sporting_director_id uuid not null
    references public.sporting_directors(id) on delete cascade,
  reward_key text not null
    references public.daily_reward_catalog(reward_key) on delete restrict,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint transfer_auction_compensation_reason_present
    check (btrim(reason) <> ''),
  constraint transfer_auction_compensation_once
    unique (listing_id, sporting_director_id)
);

alter table public.daily_reward_inventory
  add column source_auction_compensation_id uuid unique
    references public.transfer_auction_compensation_grants(id)
    on delete cascade;

alter table public.daily_reward_inventory
  drop constraint daily_reward_inventory_exactly_one_source;

alter table public.daily_reward_inventory
  add constraint daily_reward_inventory_exactly_one_source
  check (
    num_nonnulls(
      source_claim_id,
      source_referral_reward_id,
      source_auction_compensation_id
    ) = 1
  );

alter table public.transfer_auction_compensation_grants enable row level security;
grant all privileges on table public.transfer_auction_compensation_grants
  to service_role;

do $repair$
declare
  v_listing_id constant uuid := '4e42eb84-b774-4491-b263-20fd8ff2dc8d';
  v_rider_id constant uuid := '1e6809a5-16dc-4ec6-a725-606d7e3d0d85';
  v_altimax_team_id constant uuid := '72c9694f-64d0-491e-a79c-68f655ae6a36';
  v_ecuador_team_id constant uuid := 'c9db310c-1a90-4df5-9f78-fd48c8147425';
  v_altimax_team_season_id constant uuid := '17936d7c-0c3c-44a6-a2fc-874abba700da';
  v_ecuador_team_season_id constant uuid := 'ab36ac83-e940-4860-93c3-720ab18a1cf9';
  v_altimax_director_id constant uuid := '0bde68e3-188d-4ad4-aa1b-a2483684bbf1';
  v_ecuador_director_id constant uuid := '69334b61-e63a-49fd-8eb6-1ed901c5ec98';
  v_contract_id constant uuid := 'c57c2916-3cef-4ea7-ba69-cfa717c81368';
  v_altimax_bid constant numeric := 23200;
  v_ecuador_bid constant numeric := 23700;
  v_listing public.transfer_market_listings%rowtype;
  v_contract public.rider_contracts%rowtype;
  v_season public.seasons%rowtype;
  v_altimax_reward record;
  v_ecuador_reward record;
  v_altimax_grant_id uuid;
  v_ecuador_grant_id uuid;
  v_moved_salary_count integer;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('repair-gambo-foe-auction-2026-08-23', 0)
  );

  select *
  into v_listing
  from public.transfer_market_listings
  where id = v_listing_id
  for update;

  -- A fresh local database does not contain the production auction. The
  -- schema remains reproducible there while production is repaired below.
  if v_listing.id is null then
    return;
  end if;

  if v_listing.rider_id is distinct from v_rider_id
    or v_listing.listing_type is distinct from 'daily'
    or v_listing.status is distinct from 'settled'
    or v_listing.winning_team_id is distinct from v_altimax_team_id
    or v_listing.winning_bid is distinct from v_altimax_bid
  then
    raise exception 'État inattendu pour l’enchère Gambo Foe : correction interrompue.';
  end if;

  if (select max(bid.amount)
      from public.transfer_market_bids as bid
      where bid.listing_id = v_listing_id
        and bid.team_id = v_ecuador_team_id) is distinct from v_ecuador_bid
    or (select max(bid.amount)
        from public.transfer_market_bids as bid
        where bid.listing_id = v_listing_id
          and bid.team_id = v_altimax_team_id) is distinct from v_altimax_bid
  then
    raise exception 'Les offres vérifiées de Team Ecuador et ALTIMAX ont changé.';
  end if;

  select *
  into v_contract
  from public.rider_contracts
  where id = v_contract_id
  for update;

  if v_contract.id is null
    or v_contract.rider_id is distinct from v_rider_id
    or v_contract.team_id is distinct from v_altimax_team_id
    or v_contract.status is distinct from 'active'
  then
    raise exception 'Le contrat actif de Gambo Foe ne correspond plus à l’audit.';
  end if;

  select *
  into v_season
  from public.seasons
  where id = v_listing.season_id;

  if v_season.id is null then
    raise exception 'La saison de l’enchère Gambo Foe est introuvable.';
  end if;

  perform 1
  from public.team_seasons
  where id in (v_altimax_team_season_id, v_ecuador_team_season_id)
    and season_id = v_listing.season_id
  order by id
  for update;

  if (select count(*)
      from public.team_seasons
      where id in (v_altimax_team_season_id, v_ecuador_team_season_id)
        and season_id = v_listing.season_id) <> 2
  then
    raise exception 'Les saisons d’équipe vérifiées sont introuvables.';
  end if;

  if exists (
    select 1
    from public.team_finance_transactions
    where team_season_id = v_ecuador_team_season_id
      and source_reference like 'rider-salary:' || v_contract_id::text || ':%'
  ) then
    raise exception 'Team Ecuador possède déjà une échéance salariale pour ce contrat.';
  end if;

  if not exists (
    select 1
    from public.team_finance_transactions
    where team_season_id = v_altimax_team_season_id
      and day_number = 7
      and status = 'cancelled'
      and source_reference like 'rider-salary:' || v_contract_id::text || ':%'
  ) then
    raise exception 'L’échéance J7 annulée de Gambo Foe ne correspond plus à l’audit.';
  end if;

  update public.rider_contracts
  set team_id = v_ecuador_team_id
  where id = v_contract_id;

  update public.team_finance_transactions
  set team_season_id = v_ecuador_team_season_id
  where team_season_id = v_altimax_team_season_id
    and status = 'pending'
    and source_reference like 'rider-salary:' || v_contract_id::text || ':%';
  get diagnostics v_moved_salary_count = row_count;

  if v_moved_salary_count <> 3 then
    raise exception 'Trois échéances salariales futures étaient attendues, % trouvées.',
      v_moved_salary_count;
  end if;

  insert into public.team_finance_transactions (
    team_season_id,
    day_number,
    amount,
    category,
    status,
    description,
    source_reference,
    posted_at
  ) values
    (
      v_altimax_team_season_id,
      coalesce(v_season.current_day_number, 1),
      v_altimax_bid,
      'transfer',
      'posted',
      'Remboursement correctif · enchère Gambo Foe',
      'transfer-correction-refund:' || v_listing_id::text,
      now()
    ),
    (
      v_ecuador_team_season_id,
      coalesce(v_season.current_day_number, 1),
      -v_ecuador_bid,
      'transfer',
      'posted',
      'Débit correctif · enchère Gambo Foe',
      'transfer-correction-purchase:' || v_listing_id::text,
      now()
    );

  update public.team_seasons
  set cash_balance = case id
    when v_altimax_team_season_id then cash_balance + v_altimax_bid
    when v_ecuador_team_season_id then cash_balance - v_ecuador_bid
    else cash_balance
  end
  where id in (v_altimax_team_season_id, v_ecuador_team_season_id);

  update public.transfer_market_listings
  set winning_team_id = v_ecuador_team_id,
    winning_bid = v_ecuador_bid
  where id = v_listing_id;

  select catalog.reward_key, catalog.name, catalog.importance
  into v_altimax_reward
  from public.daily_reward_catalog as catalog
  where catalog.is_active
    and catalog.importance in (6, 7)
  order by md5(
    catalog.reward_key || v_listing_id::text || v_altimax_director_id::text
  )
  limit 1;

  select catalog.reward_key, catalog.name, catalog.importance
  into v_ecuador_reward
  from public.daily_reward_catalog as catalog
  where catalog.is_active
    and catalog.importance in (6, 7)
  order by md5(
    catalog.reward_key || v_listing_id::text || v_ecuador_director_id::text
  )
  limit 1;

  if v_altimax_reward.reward_key is null
    or v_ecuador_reward.reward_key is null
  then
    raise exception 'Aucun cadeau actif de niveau 6 ou 7 n’est disponible.';
  end if;

  insert into public.transfer_auction_compensation_grants (
    listing_id,
    sporting_director_id,
    reward_key,
    reason
  ) values (
    v_listing_id,
    v_altimax_director_id,
    v_altimax_reward.reward_key,
    'Compensation pour la clôture incorrecte de l’enchère Gambo Foe.'
  )
  returning id into v_altimax_grant_id;

  insert into public.transfer_auction_compensation_grants (
    listing_id,
    sporting_director_id,
    reward_key,
    reason
  ) values (
    v_listing_id,
    v_ecuador_director_id,
    v_ecuador_reward.reward_key,
    'Compensation pour la clôture incorrecte de l’enchère Gambo Foe.'
  )
  returning id into v_ecuador_grant_id;

  insert into public.daily_reward_inventory (
    sporting_director_id,
    team_season_id,
    source_claim_id,
    source_referral_reward_id,
    source_auction_compensation_id,
    reward_key,
    expires_after_game_year
  ) values
    (
      v_altimax_director_id,
      v_altimax_team_season_id,
      null,
      null,
      v_altimax_grant_id,
      v_altimax_reward.reward_key,
      v_season.game_year + 1
    ),
    (
      v_ecuador_director_id,
      v_ecuador_team_season_id,
      null,
      null,
      v_ecuador_grant_id,
      v_ecuador_reward.reward_key,
      v_season.game_year + 1
    );

  insert into public.sporting_director_messages (
    sporting_director_id,
    season_id,
    team_season_id,
    message_type,
    sender_name,
    subject,
    preview,
    body,
    action_href,
    action_label,
    source_reference,
    is_important
  ) values
    (
      v_altimax_director_id,
      v_listing.season_id,
      v_altimax_team_season_id,
      'system',
      'Direction de Cyclo Stratège',
      'Correction et compensation · enchère Gambo Foe',
      '23 200 € ont été remboursés à ALTIMAX et un cadeau vous a été attribué.',
      E'Une anomalie a affecté la clôture de l’enchère de Gambo Foe. Team Ecuador avait placé l’offre la plus haute à 23 700 € : le coureur lui a donc été réattribué et les 23 200 € débités à ALTIMAX ont été intégralement remboursés.\n\nEn compensation, vous recevez un cadeau aléatoire de niveau ' || v_altimax_reward.importance || ' : « ' || v_altimax_reward.name || ' ». Il est disponible dans votre inventaire.',
      '/jeu/inventaire',
      'Voir mon cadeau',
      'auction-correction:' || v_listing_id::text || ':altimax',
      true
    ),
    (
      v_ecuador_director_id,
      v_listing.season_id,
      v_ecuador_team_season_id,
      'system',
      'Direction de Cyclo Stratège',
      'Correction et compensation · enchère Gambo Foe',
      'Gambo Foe rejoint Team Ecuador pour 23 700 € et un cadeau vous a été attribué.',
      E'Une anomalie a affecté la clôture de l’enchère de Gambo Foe. Votre offre de 23 700 € était bien la plus haute : le coureur a été transféré à Team Ecuador et le montant correspondant a été débité.\n\nEn compensation, vous recevez un cadeau aléatoire de niveau ' || v_ecuador_reward.importance || ' : « ' || v_ecuador_reward.name || ' ». Il est disponible dans votre inventaire.',
      '/jeu/inventaire',
      'Voir mon cadeau',
      'auction-correction:' || v_listing_id::text || ':ecuador',
      true
    );
end;
$repair$;

notify pgrst, 'reload schema';

commit;
