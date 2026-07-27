begin;

-- Les sponsors restent une récompense de progression. La pression budgétaire
-- vient désormais d'une masse salariale plus progressive : les profils
-- modestes restent accessibles, tandis que les leaders et experts cinq étoiles
-- représentent un vrai choix de construction d'équipe.

create or replace function public.calculate_rider_season_salary(
  p_rider_id uuid,
  p_season_id uuid
)
returns numeric
language sql
stable
set search_path = public
as $$
  with target_season as (
    select season.game_year
    from public.seasons as season
    where season.id = p_season_id
  ),
  rating as (
    select (
      rating.mountain + rating.hills + rating.flat + rating.time_trial
      + rating.cobbles + rating.sprint + rating.acceleration
      + rating.downhill + rating.endurance + rating.resistance
      + rating.recovery + rating.breakaway + rating.prologue
    )::numeric / 13 as overall
    from public.rider_season_ratings as rating
    join public.seasons as rating_season
      on rating_season.id = rating.season_id
    cross join target_season
    where rating.rider_id = p_rider_id
      and rating_season.game_year <= target_season.game_year
    order by rating_season.game_year desc
    limit 1
  ),
  pedigree as (
    select coalesce(max(summary.points), 0)::numeric as previous_points
    from public.rider_season_summaries as summary
    join public.seasons as summary_season
      on summary_season.id = summary.season_id
    cross join target_season
    where summary.rider_id = p_rider_id
      and summary_season.game_year < target_season.game_year
  )
  select round(
    greatest(
      6000,
      least(
        400000,
        6000
        + power(
          greatest(0, (coalesce(rating.overall, 45) - 45) / 55),
          2.15
        ) * 240000
        + least(90000, pedigree.previous_points * 50)
      )
    ) / 100
  ) * 100
  from rating
  cross join pedigree;
$$;

create or replace function public.calculate_staff_salary(
  p_role text,
  p_level integer
)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  v_base numeric;
  v_multiplier numeric;
  v_level integer := least(5, greatest(1, coalesce(p_level, 1)));
begin
  v_base := case p_role
    when 'trainer' then 22000
    when 'scout' then 19000
    when 'doctor' then 17000
    when 'mechanic' then 14000
    when 'nutritionist' then 13000
    when 'physiotherapist' then 13000
    when 'race_preparer' then 15000
    when 'architect' then 12000
    when 'community_manager' then 11000
    else null
  end;

  if v_base is null then
    raise exception 'Métier de staff invalide.';
  end if;

  v_multiplier := (
    array[1.00, 1.50, 2.20, 3.30, 5.00]::numeric[]
  )[v_level];

  return round((v_base * v_multiplier) / 500) * 500;
end;
$$;

create or replace function public.calculate_staff_signing_fee(
  p_role text,
  p_level integer
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select greatest(
    1000,
    round(
      public.calculate_staff_salary(p_role, p_level)
      * (
        array[0.15, 0.20, 0.30, 0.45, 0.65]::numeric[]
      )[least(5, greatest(1, coalesce(p_level, 1)))]
      / 500
    ) * 500
  );
$$;

-- Les offres encore ouvertes adoptent immédiatement le nouveau barème.
update public.transfer_market_listings as listing
set salary_per_season = public.calculate_rider_season_salary(
  listing.rider_id,
  listing.season_id
)
where listing.status = 'open';

update public.staff_market_listings as listing
set
  salary_per_season = public.calculate_staff_salary(member.role, member.level),
  signing_fee = public.calculate_staff_signing_fee(member.role, member.level)
from public.staff_members as member
where member.id = listing.staff_member_id
  and listing.status = 'available';

-- Les renouvellements déjà préparés concernent une saison non commencée :
-- ils peuvent donc être revalorisés sans modifier un salaire déjà versé.
update public.rider_contracts as contract
set salary_per_season = public.calculate_rider_season_salary(
  contract.rider_id,
  contract.start_season_id
)
where contract.status = 'planned'
  and contract.acquisition_type = 'renewal';

-- Les contrats de staff sont sans échéance obligatoire. Leur niveau actuel
-- détermine donc le salaire, mais la synchronisation existante conserve les
-- échéances déjà payées et ne recalcule que les paiements encore en attente.
update public.staff_contracts as contract
set salary_per_season = public.calculate_staff_salary(member.role, member.level)
from public.staff_members as member
where member.id = contract.staff_member_id
  and contract.status = 'active'
  and contract.salary_per_season
    is distinct from public.calculate_staff_salary(member.role, member.level);

create or replace function public.reprice_staff_contract_after_progression()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.level is distinct from old.level
    or new.role is distinct from old.role then
    update public.staff_contracts
    set salary_per_season = public.calculate_staff_salary(new.role, new.level)
    where staff_member_id = new.id
      and status = 'active';
  end if;

  return new;
end;
$$;

drop trigger if exists staff_progression_reprices_contract
on public.staff_members;

create trigger staff_progression_reprices_contract
after update of level, role
on public.staff_members
for each row
execute function public.reprice_staff_contract_after_progression();

create or replace function public.renew_current_team_rider(
  p_rider_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_current_contract public.rider_contracts%rowtype;
  v_next_season_id uuid;
  v_salary numeric;
  v_contract_id uuid;
begin
  select assignment.team_id, season.id as season_id, season.game_year
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au DS.';
  end if;

  select *
  into v_current_contract
  from public.rider_contracts
  where rider_id = p_rider_id
    and team_id = v_context.team_id
    and status = 'active'
  for update;

  if v_current_contract is null then
    raise exception 'Ce coureur n’appartient pas à votre équipe.';
  end if;

  if exists (
    select 1
    from public.seasons as contract_end
    where contract_end.id = v_current_contract.end_season_id
      and contract_end.game_year > v_context.game_year
  ) then
    raise exception 'Ce coureur est déjà sous contrat pour la saison suivante.';
  end if;

  v_next_season_id := public.ensure_transfer_next_season(v_context.season_id);

  if exists (
    select 1
    from public.rider_contracts
    where rider_id = p_rider_id
      and start_season_id = v_next_season_id
      and status in ('planned', 'active')
  ) then
    raise exception 'Le contrat de ce coureur est déjà renouvelé.';
  end if;

  v_salary := public.calculate_rider_season_salary(
    p_rider_id,
    v_next_season_id
  );

  insert into public.rider_contracts (
    rider_id,
    team_id,
    start_season_id,
    end_season_id,
    salary_per_season,
    currency,
    currency_code,
    status,
    signed_at,
    acquisition_type
  )
  values (
    p_rider_id,
    v_context.team_id,
    v_next_season_id,
    v_next_season_id,
    v_salary,
    'EUR',
    'EUR',
    'planned',
    now(),
    'renewal'
  )
  returning id into v_contract_id;

  return v_contract_id;
end;
$$;

comment on function public.calculate_rider_season_salary(uuid, uuid) is
  'Calcule un salaire progressif de 6 000 à 400 000 euros selon le niveau et le palmarès.';

comment on function public.calculate_staff_salary(text, integer) is
  'Calcule le salaire du staff avec une prime fortement progressive de une à cinq étoiles.';

comment on function public.reprice_staff_contract_after_progression() is
  'Réaligne le salaire d un membre du staff lorsqu il gagne un niveau ou change de métier.';

notify pgrst, 'reload schema';

commit;
