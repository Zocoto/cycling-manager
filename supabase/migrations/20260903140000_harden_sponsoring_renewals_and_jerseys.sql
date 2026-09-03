begin;

-- Les propositions encore ouvertes ont été produites avant la prise en compte
-- du pays réel de l'équipe. Elles seront recréées à la prochaine ouverture de
-- la page, sans toucher aux offres déjà acceptées.
update public.sponsor_offers
set status = 'withdrawn'
where status in ('draft', 'open')
  and generation_version < 5;

with duplicated_offers as (
  select
    offer.id,
    row_number() over (
      partition by offer.season_id, offer.sponsor_id
      order by offer.created_at, offer.id
    ) as duplicate_rank
  from public.sponsor_offers as offer
  where offer.status in ('draft', 'open')
)
update public.sponsor_offers as offer
set status = 'withdrawn'
from duplicated_offers as duplicate
where duplicate.id = offer.id
  and duplicate.duplicate_rank > 1;

create unique index if not exists sponsor_offers_one_open_sponsor_per_season_idx
  on public.sponsor_offers (season_id, sponsor_id)
  where status in ('draft', 'open');

alter table public.team_sponsor_contracts
  add column if not exists pending_jersey_id text,
  add column if not exists pending_jersey_style text,
  add column if not exists pending_jersey_season_id uuid
    references public.seasons(id) on delete restrict;

alter table public.team_sponsor_contracts
  add constraint team_sponsor_contracts_pending_jersey_complete
  check (
    (
      pending_jersey_id is null
      and pending_jersey_style is null
      and pending_jersey_season_id is null
    )
    or (
      btrim(pending_jersey_id) <> ''
      and pending_jersey_style in ('classic', 'modern', 'bold')
      and pending_jersey_season_id is not null
    )
  );

create or replace function private.prevent_sponsor_team_conflicts()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_new_start_game_year integer;
  v_new_end_game_year integer;
begin
  if new.role <> 'principal' or new.status not in ('planned', 'active') then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.sponsor_id::text, 0));

  select season.game_year
  into strict v_new_start_game_year
  from public.seasons as season
  where season.id = new.start_season_id;

  v_new_end_game_year :=
    v_new_start_game_year + new.contract_duration_seasons - 1;

  if exists (
    select 1
    from public.team_sponsor_contracts as contract
    join public.seasons as start_season
      on start_season.id = contract.start_season_id
    where contract.id <> new.id
      and contract.sponsor_id = new.sponsor_id
      and contract.team_id <> new.team_id
      and contract.role = 'principal'
      and contract.status in ('planned', 'active')
      and (
        contract.status = 'active'
        or (
          v_new_start_game_year
            <= start_season.game_year + contract.contract_duration_seasons - 1
          and start_season.game_year <= v_new_end_game_year
        )
      )
  ) then
    raise exception
      'Ce sponsor est déjà représenté ou réservé par une autre équipe.';
  end if;

  return new;
end;
$$;

create trigger prevent_sponsor_team_conflicts
before insert or update of
  team_id,
  sponsor_id,
  start_season_id,
  contract_duration_seasons,
  role,
  status
on public.team_sponsor_contracts
for each row
execute function private.prevent_sponsor_team_conflicts();

create or replace function public.select_next_season_sponsor_jersey(
  p_contract_id uuid,
  p_jersey_id text,
  p_jersey_style text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_style text := lower(btrim(coalesce(p_jersey_style, '')));
  v_jersey_id text := lower(btrim(coalesce(p_jersey_id, '')));
  v_active_season record;
  v_target_season record;
  v_contract record;
  v_expected_jersey_id text;
  v_contract_end_game_year integer;
begin
  if v_auth_user_id is null then
    raise exception 'Vous devez être authentifié pour choisir un maillot.';
  end if;

  if p_contract_id is null then
    raise exception 'L’identifiant du contrat est obligatoire.';
  end if;

  if v_style not in ('classic', 'modern', 'bold') then
    raise exception 'Le style de maillot sélectionné est invalide.';
  end if;

  select season.id, season.game_year, season.current_day_number
  into v_active_season
  from public.seasons as season
  where season.status = 'active';

  if not found then
    raise exception 'Aucune saison active n’est disponible.';
  end if;

  if coalesce(v_active_season.current_day_number, 0) < 21 then
    raise exception
      'Le maillot de la saison suivante ne peut être choisi qu’à partir du jour 21.';
  end if;

  select season.id, season.game_year, season.name
  into v_target_season
  from public.seasons as season
  where season.game_year = v_active_season.game_year + 1
    and season.status = 'planned';

  if not found then
    raise exception 'La saison suivante est introuvable.';
  end if;

  select
    contract.id,
    contract.status,
    contract.start_season_id,
    contract.contract_duration_seasons,
    start_season.game_year as start_game_year,
    sponsor.catalog_key
  into v_contract
  from public.team_sponsor_contracts as contract
  join public.seasons as start_season
    on start_season.id = contract.start_season_id
  join public.sponsors as sponsor
    on sponsor.id = contract.sponsor_id
  join public.team_manager_assignments as assignment
    on assignment.team_id = contract.team_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  join public.sporting_directors as sporting_director
    on sporting_director.id = assignment.sporting_director_id
    and sporting_director.auth_user_id = v_auth_user_id
    and sporting_director.status = 'active'
  where contract.id = p_contract_id
    and contract.role = 'principal'
    and contract.status in ('active', 'planned')
  for update of contract;

  if not found then
    raise exception 'Ce contrat est introuvable ou ne vous appartient pas.';
  end if;

  v_expected_jersey_id := lower(v_contract.catalog_key) || '-' || v_style;
  if v_jersey_id <> v_expected_jersey_id then
    raise exception
      'Le maillot sélectionné ne correspond pas au sponsor du contrat.';
  end if;

  if v_contract.status = 'planned' then
    if v_contract.start_season_id <> v_target_season.id then
      raise exception 'Ce contrat ne concerne pas la saison suivante.';
    end if;

    update public.team_sponsor_contracts
    set selected_jersey_id = v_jersey_id,
        selected_jersey_style = v_style
    where id = v_contract.id;

    return v_contract.id;
  end if;

  v_contract_end_game_year :=
    v_contract.start_game_year + v_contract.contract_duration_seasons - 1;

  if v_contract_end_game_year < v_target_season.game_year then
    raise exception 'Le contrat actuel ne couvre pas la saison suivante.';
  end if;

  update public.team_sponsor_contracts
  set pending_jersey_id = v_jersey_id,
      pending_jersey_style = v_style,
      pending_jersey_season_id = v_target_season.id
  where id = v_contract.id;

  return v_contract.id;
end;
$$;

revoke all on function public.select_next_season_sponsor_jersey(uuid, text, text)
  from public;
grant execute on function public.select_next_season_sponsor_jersey(uuid, text, text)
  to authenticated;

create or replace function private.activate_pending_sponsor_jerseys()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'active' and old.status is distinct from new.status then
    update public.team_sponsor_contracts
    set selected_jersey_id = pending_jersey_id,
        selected_jersey_style = pending_jersey_style,
        pending_jersey_id = null,
        pending_jersey_style = null,
        pending_jersey_season_id = null
    where status = 'active'
      and role = 'principal'
      and pending_jersey_season_id = new.id;
  end if;

  return new;
end;
$$;

create trigger activate_pending_sponsor_jerseys
after update of status on public.seasons
for each row
execute function private.activate_pending_sponsor_jerseys();

create or replace function private.finalize_planned_sponsor_renewal_budget()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role <> 'principal' then
    return new;
  end if;

  with updated_contract as (
    update public.team_sponsor_contracts as planned_contract
    set budget_per_season = round(
      new.budget_per_season
        * (1 + new.renewal_budget_adjustment_percent / 100),
      2
    )
    from public.seasons as old_start_season,
         public.seasons as planned_start_season
    where old_start_season.id = new.start_season_id
      and planned_start_season.id = planned_contract.start_season_id
      and planned_contract.id <> new.id
      and planned_contract.team_id = new.team_id
      and planned_contract.sponsor_id = new.sponsor_id
      and planned_contract.role = 'principal'
      and planned_contract.status = 'planned'
      and planned_start_season.game_year =
        old_start_season.game_year + new.contract_duration_seasons
    returning
      planned_contract.sponsor_offer_id,
      planned_contract.budget_per_season
  )
  update public.sponsor_offers as offer
  set budget_per_season = updated_contract.budget_per_season
  from updated_contract
  where offer.id = updated_contract.sponsor_offer_id;

  return new;
end;
$$;

create trigger finalize_planned_sponsor_renewal_budget
after update of renewal_budget_adjustment_percent, status
on public.team_sponsor_contracts
for each row
when (
  old.renewal_budget_adjustment_percent is distinct from
    new.renewal_budget_adjustment_percent
  or (old.status is distinct from new.status and new.status = 'completed')
)
execute function private.finalize_planned_sponsor_renewal_budget();

create or replace function public.get_current_sponsoring_alerts()
returns table (
  signature_available boolean,
  renewal_available boolean,
  jersey_change_available boolean,
  target_season_name text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_team_id uuid;
  v_reputation_points integer;
  v_active_season record;
  v_target_season record;
  v_active_contract record;
  v_planned_contract record;
begin
  if v_auth_user_id is null then
    return;
  end if;

  select assignment.team_id, sporting_director.reputation_points
  into v_team_id, v_reputation_points
  from public.sporting_directors as sporting_director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = sporting_director.id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  where sporting_director.auth_user_id = v_auth_user_id
    and sporting_director.status = 'active'
  order by assignment.created_at desc
  limit 1;

  if not found then
    return;
  end if;

  select season.id, season.game_year, season.current_day_number
  into v_active_season
  from public.seasons as season
  where season.status = 'active';

  if not found then
    return;
  end if;

  select season.id, season.game_year, season.name
  into v_target_season
  from public.seasons as season
  where season.game_year = v_active_season.game_year + 1
    and season.status = 'planned';

  if not found then
    return;
  end if;

  select
    contract.id,
    start_season.game_year + contract.contract_duration_seasons - 1
      as end_game_year,
    contract.pending_jersey_season_id
  into v_active_contract
  from public.team_sponsor_contracts as contract
  join public.seasons as start_season
    on start_season.id = contract.start_season_id
  where contract.team_id = v_team_id
    and contract.role = 'principal'
    and contract.status = 'active'
  order by contract.created_at desc
  limit 1;

  select contract.id, contract.selected_jersey_id
  into v_planned_contract
  from public.team_sponsor_contracts as contract
  where contract.team_id = v_team_id
    and contract.start_season_id = v_target_season.id
    and contract.role = 'principal'
    and contract.status = 'planned'
  order by contract.created_at desc
  limit 1;

  signature_available :=
    coalesce(v_active_season.current_day_number, 0) >= 21
    and coalesce(v_reputation_points, 0) >= 30
    and v_planned_contract.id is null
    and v_active_contract.id is null;

  renewal_available :=
    coalesce(v_active_season.current_day_number, 0) >= 21
    and coalesce(v_reputation_points, 0) >= 30
    and v_planned_contract.id is null
    and v_active_contract.id is not null
    and v_active_contract.end_game_year < v_target_season.game_year;

  jersey_change_available :=
    coalesce(v_active_season.current_day_number, 0) >= 21
    and (
      (
        v_planned_contract.id is not null
        and v_planned_contract.selected_jersey_id is null
      )
      or (
        v_planned_contract.id is null
        and v_active_contract.id is not null
        and v_active_contract.end_game_year >= v_target_season.game_year
        and v_active_contract.pending_jersey_season_id is distinct from
          v_target_season.id
      )
    );

  target_season_name := v_target_season.name;
  return next;
end;
$$;

revoke all on function public.get_current_sponsoring_alerts() from public;
grant execute on function public.get_current_sponsoring_alerts()
  to authenticated;

comment on function public.select_next_season_sponsor_jersey(uuid, text, text) is
  'Permet au DS de choisir ou modifier le maillot de la saison suivante dès J21, avec ou sans renouvellement.';
comment on function public.get_current_sponsoring_alerts() is
  'Expose les décisions sponsoring actuellement disponibles pour l assistant du DS.';

notify pgrst, 'reload schema';

commit;
