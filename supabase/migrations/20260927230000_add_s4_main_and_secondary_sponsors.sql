begin;

-- ============================================================
-- OBJECTIF PRINCIPAL EXCEPTIONNEL DU SPONSOR PRINCIPAL
-- ============================================================

create table public.sponsor_main_objective_terms (
  sponsor_objective_id uuid primary key
    references public.sponsor_objectives(id) on delete cascade,
  cash_reward numeric(14, 2) not null,
  currency_code text not null default 'EUR',
  reputation_penalty numeric(12, 2) not null,
  race_category_code text not null,
  settlement_status text not null default 'pending',
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint sponsor_main_objective_cash_positive check (cash_reward > 0),
  constraint sponsor_main_objective_reputation_positive check (reputation_penalty > 0),
  constraint sponsor_main_objective_currency_format check (
    char_length(currency_code) = 3 and currency_code = upper(currency_code)
  ),
  constraint sponsor_main_objective_category_allowed check (
    race_category_code in ('regional', 'national', 'continental', 'world', 'elite')
  ),
  constraint sponsor_main_objective_settlement_allowed check (
    settlement_status in ('pending', 'achieved', 'failed', 'cancelled')
  ),
  constraint sponsor_main_objective_settlement_shape check (
    (settlement_status = 'pending' and settled_at is null)
    or (settlement_status <> 'pending' and settled_at is not null)
  )
);

alter table public.sponsor_main_objective_terms enable row level security;

create policy sponsor_main_objective_terms_select_own
on public.sponsor_main_objective_terms
for select to authenticated
using (
  exists (
    select 1
    from public.sponsor_objectives as objective
    join public.sponsor_offers as offer on offer.id = objective.sponsor_offer_id
    join public.sporting_directors as director
      on director.id = offer.sporting_director_id
    where objective.id = sponsor_main_objective_terms.sponsor_objective_id
      and director.auth_user_id = auth.uid()
  )
);

grant select on public.sponsor_main_objective_terms to authenticated;
grant all privileges on public.sponsor_main_objective_terms to service_role;

create or replace function private.settle_sponsor_main_objective()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_day_number integer;
  v_day_id uuid;
  v_transaction_id uuid;
  v_director_id uuid;
begin
  if new.status not in ('achieved', 'failed')
    or new.status is not distinct from old.status then
    return new;
  end if;

  select
    terms.sponsor_objective_id,
    terms.cash_reward,
    terms.currency_code,
    terms.reputation_penalty,
    terms.settlement_status,
    objective.name as objective_name,
    objective.target_details,
    contract.team_id,
    progress.season_id,
    team_season.id as team_season_id,
    edition.status as race_status
  into v_context
  from public.sponsor_main_objective_terms as terms
  join public.sponsor_objectives as objective
    on objective.id = terms.sponsor_objective_id
  join public.objective_progress as progress
    on progress.sponsor_objective_id = objective.id
   and progress.id = new.id
  join public.team_sponsor_contracts as contract
    on contract.id = progress.team_sponsor_contract_id
   and contract.role = 'principal'
  join public.team_seasons as team_season
    on team_season.team_id = contract.team_id
   and team_season.season_id = progress.season_id
  left join public.race_editions as edition
    on edition.id = nullif(objective.target_details ->> 'raceEditionId', '')::uuid
  where terms.sponsor_objective_id = new.sponsor_objective_id
  for update of terms;

  if v_context is null or v_context.settlement_status <> 'pending' then
    return new;
  end if;

  if v_context.race_status = 'cancelled' then
    update public.sponsor_main_objective_terms
    set settlement_status = 'cancelled', settled_at = now()
    where sponsor_objective_id = new.sponsor_objective_id;

    update public.objective_progress
    set settled_at = coalesce(settled_at, now()),
      details = coalesce(details, '{}'::jsonb) || jsonb_build_object(
        'mainObjectiveSettlement', 'cancelled',
        'mainObjectiveReputationPenalty', 0
      ),
      updated_at = now()
    where id = new.id;
    return new;
  end if;

  if new.status = 'achieved' then
    select greatest(1, least(28, coalesce(season.current_day_number, 1)))
    into v_day_number
    from public.seasons as season
    where season.id = v_context.season_id;

    select day.id into v_day_id
    from public.season_days as day
    where day.season_id = v_context.season_id
      and day.day_number = v_day_number;

    insert into public.team_finance_transactions (
      team_season_id, season_day_id, day_number, amount, category,
      status, description, source_reference, posted_at
    ) values (
      v_context.team_season_id, v_day_id, v_day_number,
      v_context.cash_reward, 'sponsor', 'posted',
      'Prime d''objectif principal sponsor - ' || v_context.objective_name,
      'sponsor-main-objective:' || new.id::text, now()
    )
    on conflict (team_season_id, source_reference) do nothing
    returning id into v_transaction_id;

    if v_transaction_id is not null then
      update public.team_seasons
      set cash_balance = cash_balance + v_context.cash_reward
      where id = v_context.team_season_id;
    end if;

    update public.sponsor_main_objective_terms
    set settlement_status = 'achieved', settled_at = now()
    where sponsor_objective_id = new.sponsor_objective_id;

    update public.objective_progress
    set settled_at = coalesce(settled_at, now()),
      details = coalesce(details, '{}'::jsonb) || jsonb_build_object(
        'mainObjectiveSettlement', 'achieved',
        'mainObjectiveCashReward', v_context.cash_reward,
        'mainObjectiveCurrencyCode', v_context.currency_code
      ),
      updated_at = now()
    where id = new.id;
  else
    select director.id into v_director_id
    from public.team_manager_assignments as assignment
    join public.sporting_directors as director
      on director.id = assignment.sporting_director_id
    where assignment.team_id = v_context.team_id
      and assignment.role = 'general_manager'
      and assignment.status = 'active'
    order by assignment.created_at desc
    limit 1;

    if v_director_id is not null then
      perform private.apply_reputation_delta(
        v_director_id,
        v_context.season_id,
        -v_context.reputation_penalty,
        'sponsor_main_objective_failure',
        'sponsor-main-objective-failure:' || new.id::text,
        'Échec de l’objectif principal du sponsor',
        jsonb_build_object(
          'objectiveId', new.sponsor_objective_id,
          'objectiveName', v_context.objective_name,
          'penalty', v_context.reputation_penalty
        )
      );
    end if;

    update public.sponsor_main_objective_terms
    set settlement_status = 'failed', settled_at = now()
    where sponsor_objective_id = new.sponsor_objective_id;

    update public.objective_progress
    set reputation_penalty = v_context.reputation_penalty,
      settled_at = coalesce(settled_at, now()),
      details = coalesce(details, '{}'::jsonb) || jsonb_build_object(
        'mainObjectiveSettlement', 'failed',
        'mainObjectiveReputationPenalty', v_context.reputation_penalty
      ),
      updated_at = now()
    where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists settle_sponsor_main_objective on public.objective_progress;
create trigger settle_sponsor_main_objective
after update of status on public.objective_progress
for each row execute function private.settle_sponsor_main_objective();

-- ============================================================
-- CATALOGUE ET CONTRATS DE SPONSORS SECONDAIRES
-- Dix marques vectorielles légères sont disponibles par pays.
-- ============================================================

create table public.secondary_sponsor_catalog (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  slot_number smallint not null,
  catalog_key text not null unique,
  name text not null,
  prestige smallint not null,
  primary_color text not null,
  accent_color text not null,
  logo_variant text not null,
  created_at timestamptz not null default now(),
  constraint secondary_sponsor_slot_range check (slot_number between 1 and 10),
  constraint secondary_sponsor_prestige_range check (prestige between 1 and 5),
  constraint secondary_sponsor_name_not_empty check (btrim(name) <> ''),
  constraint secondary_sponsor_colors_format check (
    primary_color ~ '^#[0-9A-Fa-f]{6}$' and accent_color ~ '^#[0-9A-Fa-f]{6}$'
  ),
  constraint secondary_sponsor_logo_variant_allowed check (
    logo_variant in ('badge', 'monogram', 'orbit', 'stripe', 'wordmark')
  ),
  unique (country_id, slot_number)
);

insert into public.secondary_sponsor_catalog (
  country_id, slot_number, catalog_key, name, prestige,
  primary_color, accent_color, logo_variant
)
select
  country.id,
  template.slot_number,
  'secondary-' || lower(country.iso_alpha2) || '-' || template.slot_number,
  template.brand_name || ' ' || country.iso_alpha2,
  template.prestige,
  template.primary_color,
  template.accent_color,
  template.logo_variant
from public.countries as country
cross join (values
  (1, 'Novara', 1, '#174A8B', '#7CC6F2', 'wordmark'),
  (2, 'Altis', 2, '#0F766E', '#5EEAD4', 'badge'),
  (3, 'Meridian', 2, '#7C3AED', '#C4B5FD', 'orbit'),
  (4, 'Vektor', 3, '#B91C1C', '#FCA5A5', 'stripe'),
  (5, 'Luma', 3, '#A16207', '#FDE047', 'monogram'),
  (6, 'Orbis', 3, '#1D4ED8', '#93C5FD', 'orbit'),
  (7, 'Summit', 4, '#166534', '#86EFAC', 'badge'),
  (8, 'Ardent', 4, '#9F1239', '#FDA4AF', 'wordmark'),
  (9, 'TerraNova', 5, '#3F6212', '#BEF264', 'stripe'),
  (10, 'Pulse', 5, '#111827', '#22D3EE', 'monogram')
) as template(
  slot_number, brand_name, prestige, primary_color, accent_color, logo_variant
)
on conflict (country_id, slot_number) do update set
  name = excluded.name,
  prestige = excluded.prestige,
  primary_color = excluded.primary_color,
  accent_color = excluded.accent_color,
  logo_variant = excluded.logo_variant;

create table public.secondary_sponsor_offers (
  id uuid primary key default gen_random_uuid(),
  sporting_director_id uuid not null
    references public.sporting_directors(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  target_season_id uuid not null references public.seasons(id) on delete cascade,
  secondary_sponsor_id uuid not null
    references public.secondary_sponsor_catalog(id) on delete restrict,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  constraint secondary_sponsor_offer_status_allowed check (
    status in ('open', 'accepted', 'withdrawn', 'expired')
  ),
  unique (sporting_director_id, target_season_id, secondary_sponsor_id)
);

create index secondary_sponsor_offers_team_season_idx
  on public.secondary_sponsor_offers (team_id, target_season_id, status);

create table public.secondary_sponsor_objectives (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.secondary_sponsor_offers(id) on delete cascade,
  display_order smallint not null,
  race_edition_id uuid not null references public.race_editions(id) on delete restrict,
  race_slug text not null,
  race_label text not null,
  race_category_code text not null,
  target_rank smallint not null,
  cash_reward numeric(14, 2) not null,
  currency_code text not null default 'EUR',
  status text not null default 'draft',
  best_rank smallint,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint secondary_sponsor_objective_order_positive check (display_order > 0),
  constraint secondary_sponsor_objective_rank_positive check (target_rank > 0),
  constraint secondary_sponsor_objective_reward_positive check (cash_reward > 0),
  constraint secondary_sponsor_objective_category_allowed check (
    race_category_code in ('regional', 'national', 'continental', 'world', 'elite')
  ),
  constraint secondary_sponsor_objective_status_allowed check (
    status in ('draft', 'active', 'achieved', 'failed', 'cancelled')
  ),
  unique (offer_id, display_order),
  unique (offer_id, race_edition_id)
);

create index secondary_sponsor_objectives_race_idx
  on public.secondary_sponsor_objectives (race_edition_id, status);

create table public.secondary_sponsor_contracts (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null unique
    references public.secondary_sponsor_offers(id) on delete restrict,
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  secondary_sponsor_id uuid not null
    references public.secondary_sponsor_catalog(id) on delete restrict,
  status text not null default 'planned',
  logo_x_percent numeric(5, 2) not null default 50,
  logo_y_percent numeric(5, 2) not null default 48,
  logo_scale numeric(4, 2) not null default 1,
  logo_rotation_degrees numeric(5, 2) not null default 0,
  signed_at timestamptz not null default now(),
  activated_at timestamptz,
  completed_at timestamptz,
  constraint secondary_sponsor_contract_status_allowed check (
    status in ('planned', 'active', 'completed', 'terminated')
  ),
  constraint secondary_sponsor_logo_x_range check (logo_x_percent between 15 and 85),
  constraint secondary_sponsor_logo_y_range check (logo_y_percent between 20 and 78),
  constraint secondary_sponsor_logo_scale_range check (logo_scale between 0.5 and 1.8),
  constraint secondary_sponsor_logo_rotation_range check (logo_rotation_degrees between -45 and 45),
  unique (team_id, season_id)
);

create index secondary_sponsor_contracts_team_status_idx
  on public.secondary_sponsor_contracts (team_id, status);

alter table public.secondary_sponsor_catalog enable row level security;
alter table public.secondary_sponsor_offers enable row level security;
alter table public.secondary_sponsor_objectives enable row level security;
alter table public.secondary_sponsor_contracts enable row level security;

create policy secondary_sponsor_catalog_read
on public.secondary_sponsor_catalog for select to authenticated using (true);

create policy secondary_sponsor_offers_select_own
on public.secondary_sponsor_offers for select to authenticated
using (
  exists (
    select 1 from public.sporting_directors as director
    where director.id = secondary_sponsor_offers.sporting_director_id
      and director.auth_user_id = auth.uid()
  )
);

create policy secondary_sponsor_objectives_select_own
on public.secondary_sponsor_objectives for select to authenticated
using (
  exists (
    select 1
    from public.secondary_sponsor_offers as offer
    join public.sporting_directors as director
      on director.id = offer.sporting_director_id
    where offer.id = secondary_sponsor_objectives.offer_id
      and director.auth_user_id = auth.uid()
  )
);

create policy secondary_sponsor_contracts_select_own
on public.secondary_sponsor_contracts for select to authenticated
using (
  exists (
    select 1
    from public.team_manager_assignments as assignment
    join public.sporting_directors as director
      on director.id = assignment.sporting_director_id
    where assignment.team_id = secondary_sponsor_contracts.team_id
      and assignment.role = 'general_manager'
      and director.auth_user_id = auth.uid()
  )
);

grant select on public.secondary_sponsor_catalog to authenticated;
grant select on public.secondary_sponsor_offers to authenticated;
grant select on public.secondary_sponsor_objectives to authenticated;
grant select on public.secondary_sponsor_contracts to authenticated;
grant all privileges on public.secondary_sponsor_catalog to service_role;
grant all privileges on public.secondary_sponsor_offers to service_role;
grant all privileges on public.secondary_sponsor_objectives to service_role;
grant all privileges on public.secondary_sponsor_contracts to service_role;

create or replace function public.sign_secondary_sponsor_offer(p_offer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_director public.sporting_directors%rowtype;
  v_offer public.secondary_sponsor_offers%rowtype;
  v_active_season public.seasons%rowtype;
  v_target_season public.seasons%rowtype;
  v_contract_id uuid;
begin
  select * into v_director
  from public.sporting_directors
  where auth_user_id = auth.uid() and status = 'active'
  for update;

  if v_director is null then raise exception 'Directeur Sportif introuvable.'; end if;
  if v_director.reputation_points < 1500 then
    raise exception 'Le sponsor secondaire se débloque à 1 500 points de réputation.';
  end if;

  select * into v_active_season
  from public.seasons where status = 'active' limit 1;
  if v_active_season is null or coalesce(v_active_season.current_day_number, 0) < 21 then
    raise exception 'La négociation du sponsor secondaire ouvre au jour 21.';
  end if;

  select * into v_offer
  from public.secondary_sponsor_offers
  where id = p_offer_id
    and sporting_director_id = v_director.id
  for update;
  if v_offer is null or v_offer.status <> 'open' then
    raise exception 'Cette offre secondaire est indisponible.';
  end if;

  select * into v_target_season
  from public.seasons where id = v_offer.target_season_id;
  if v_target_season.status <> 'planned'
    or v_target_season.game_year <> v_active_season.game_year + 1
    or v_target_season.game_year < 4 then
    raise exception 'Le sponsor secondaire ne peut être signé que pour la saison 4 ou suivante.';
  end if;

  if exists (
    select 1 from public.secondary_sponsor_contracts
    where team_id = v_offer.team_id
      and season_id = v_offer.target_season_id
      and status in ('planned', 'active')
  ) then
    raise exception 'Un sponsor secondaire est déjà signé pour cette saison.';
  end if;

  insert into public.secondary_sponsor_contracts (
    offer_id, team_id, season_id, secondary_sponsor_id
  ) values (
    v_offer.id, v_offer.team_id, v_offer.target_season_id,
    v_offer.secondary_sponsor_id
  ) returning id into v_contract_id;

  update public.secondary_sponsor_offers
  set status = case when id = v_offer.id then 'accepted' else 'withdrawn' end,
    accepted_at = case when id = v_offer.id then now() else accepted_at end
  where sporting_director_id = v_director.id
    and target_season_id = v_offer.target_season_id
    and status = 'open';

  return v_contract_id;
end;
$$;

create or replace function public.update_secondary_sponsor_logo(
  p_contract_id uuid,
  p_x_percent numeric,
  p_y_percent numeric,
  p_scale numeric,
  p_rotation_degrees numeric
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_x_percent not between 15 and 85
    or p_y_percent not between 20 and 78
    or p_scale not between 0.5 and 1.8
    or p_rotation_degrees not between -45 and 45 then
    raise exception 'Le placement du logo est hors des limites autorisées.';
  end if;

  update public.secondary_sponsor_contracts as contract
  set logo_x_percent = round(p_x_percent, 2),
    logo_y_percent = round(p_y_percent, 2),
    logo_scale = round(p_scale, 2),
    logo_rotation_degrees = round(p_rotation_degrees, 2)
  where contract.id = p_contract_id
    and contract.status = 'planned'
    and exists (
      select 1
      from public.team_manager_assignments as assignment
      join public.sporting_directors as director
        on director.id = assignment.sporting_director_id
      where assignment.team_id = contract.team_id
        and assignment.role = 'general_manager'
        and assignment.status = 'active'
        and director.auth_user_id = auth.uid()
    );

  if not found then
    raise exception 'Ce placement ne peut plus être modifié.';
  end if;
end;
$$;

revoke all on function public.sign_secondary_sponsor_offer(uuid) from public, anon;
revoke all on function public.update_secondary_sponsor_logo(uuid, numeric, numeric, numeric, numeric) from public, anon;
grant execute on function public.sign_secondary_sponsor_offer(uuid) to authenticated;
grant execute on function public.update_secondary_sponsor_logo(uuid, numeric, numeric, numeric, numeric) to authenticated;

create or replace function private.apply_secondary_sponsor_team_season_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contract record;
begin
  if new.status = 'active' and old.status <> 'active' then
    select contract.id, contract.offer_id, sponsor.name
    into v_contract
    from public.secondary_sponsor_contracts as contract
    join public.secondary_sponsor_catalog as sponsor
      on sponsor.id = contract.secondary_sponsor_id
    where contract.team_id = new.team_id
      and contract.season_id = new.season_id
      and contract.status = 'planned'
    limit 1
    for update of contract;

    if v_contract is not null then
      update public.secondary_sponsor_contracts
      set status = 'active', activated_at = coalesce(activated_at, now())
      where id = v_contract.id;

      update public.secondary_sponsor_objectives
      set status = 'active'
      where offer_id = v_contract.offer_id and status = 'draft';

      update public.team_seasons
      set display_name = display_name || ' - ' || v_contract.name,
        short_name = left(coalesce(short_name, display_name) || '-' || v_contract.name, 30)
      where id = new.id;
    end if;
  elsif new.status = 'completed' and old.status <> 'completed' then
    update public.secondary_sponsor_objectives as objective
    set status = 'failed', settled_at = coalesce(objective.settled_at, now())
    from public.secondary_sponsor_contracts as contract
    where contract.team_id = new.team_id
      and contract.season_id = new.season_id
      and contract.offer_id = objective.offer_id
      and objective.status in ('draft', 'active');

    update public.secondary_sponsor_contracts
    set status = 'completed', completed_at = coalesce(completed_at, now())
    where team_id = new.team_id
      and season_id = new.season_id
      and status = 'active';
  end if;

  return new;
end;
$$;

drop trigger if exists secondary_sponsor_team_season_transition on public.team_seasons;
create trigger secondary_sponsor_team_season_transition
after update of status on public.team_seasons
for each row execute function private.apply_secondary_sponsor_team_season_transition();

create or replace function private.evaluate_secondary_sponsor_objectives_after_race()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_objective record;
  v_best_rank integer;
  v_team_season_id uuid;
  v_day_number integer;
  v_day_id uuid;
  v_transaction_id uuid;
begin
  if new.status not in ('completed', 'cancelled')
    or new.status is not distinct from old.status then
    return new;
  end if;

  for v_objective in
    select objective.*, contract.team_id, contract.season_id
    from public.secondary_sponsor_objectives as objective
    join public.secondary_sponsor_offers as offer on offer.id = objective.offer_id
    join public.secondary_sponsor_contracts as contract on contract.offer_id = offer.id
    where objective.race_edition_id = new.id
      and objective.status = 'active'
      and contract.status = 'active'
    order by objective.id
    for update of objective
  loop
    if new.status = 'cancelled' then
      update public.secondary_sponsor_objectives
      set status = 'cancelled', settled_at = now()
      where id = v_objective.id;
      continue;
    end if;

    select team_season.id into v_team_season_id
    from public.team_seasons as team_season
    where team_season.team_id = v_objective.team_id
      and team_season.season_id = v_objective.season_id;

    select min(result.final_rank)::integer into v_best_rank
    from public.race_results as result
    join public.race_rosters as roster on roster.id = result.race_roster_id
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
     and registration.race_edition_id = result.race_edition_id
    where result.race_edition_id = new.id
      and registration.team_season_id = v_team_season_id
      and result.status = 'classified';

    update public.secondary_sponsor_objectives
    set status = case
        when v_best_rank is not null and v_best_rank <= v_objective.target_rank
          then 'achieved'
        else 'failed'
      end,
      best_rank = v_best_rank,
      settled_at = now()
    where id = v_objective.id;

    if v_best_rank is not null and v_best_rank <= v_objective.target_rank then
      select greatest(1, least(28, coalesce(season.current_day_number, 1)))
      into v_day_number
      from public.seasons as season where season.id = v_objective.season_id;

      select day.id into v_day_id
      from public.season_days as day
      where day.season_id = v_objective.season_id
        and day.day_number = v_day_number;

      insert into public.team_finance_transactions (
        team_season_id, season_day_id, day_number, amount, category,
        status, description, source_reference, posted_at
      ) values (
        v_team_season_id, v_day_id, v_day_number,
        v_objective.cash_reward, 'sponsor', 'posted',
        'Prime sponsor secondaire - ' || v_objective.race_label,
        'secondary-sponsor-objective:' || v_objective.id::text, now()
      )
      on conflict (team_season_id, source_reference) do nothing
      returning id into v_transaction_id;

      if v_transaction_id is not null then
        update public.team_seasons
        set cash_balance = cash_balance + v_objective.cash_reward
        where id = v_team_season_id;
      end if;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists evaluate_secondary_sponsor_objectives_after_race
  on public.race_editions;
create trigger evaluate_secondary_sponsor_objectives_after_race
after update of status on public.race_editions
for each row execute function private.evaluate_secondary_sponsor_objectives_after_race();

comment on table public.sponsor_main_objective_terms is
  'Prime immédiate et risque de réputation associés à l’objectif principal exceptionnel d’un sponsor.';
comment on table public.secondary_sponsor_catalog is
  'Catalogue léger de dix sponsors secondaires vectoriels par pays.';
comment on table public.secondary_sponsor_contracts is
  'Contrats secondaires d’une saison, sans paiement récurrent ni satisfaction.';

commit;
