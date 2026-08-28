-- ============================================================
-- FORME AU CLUB — NOUVEL EFFET A PARTIR DE LA SAISON 3
-- ============================================================

begin;

update public.special_ability_catalog
set effect_description =
  'À partir de la Saison 3, divise par deux le salaire du coureur tant qu’il reste dans son club formateur ; cette capacité est perdue définitivement en cas de départ ou de non-renouvellement.'
where code = 'homegrown';

-- Conserver le +2 historique pendant les deux premières saisons, mais ne plus
-- le poser ni le retirer sur les notes des saisons suivantes.
create or replace function public.apply_homegrown_rating_bonus()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and old.ability_code <> 'homegrown' then
    return old;
  elsif tg_op = 'INSERT' and new.ability_code <> 'homegrown' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    update public.rider_season_ratings as rating
    set
      mountain = least(100, rating.mountain + 2),
      hills = least(100, rating.hills + 2),
      flat = least(100, rating.flat + 2),
      time_trial = least(100, rating.time_trial + 2),
      cobbles = least(100, rating.cobbles + 2),
      sprint = least(100, rating.sprint + 2),
      acceleration = least(100, rating.acceleration + 2),
      downhill = least(100, rating.downhill + 2),
      endurance = least(100, rating.endurance + 2),
      resistance = least(100, rating.resistance + 2),
      recovery = least(100, rating.recovery + 2),
      breakaway = least(100, rating.breakaway + 2),
      prologue = least(100, rating.prologue + 2),
      updated_at = now()
    from public.seasons as season
    where rating.rider_id = new.rider_id
      and season.id = rating.season_id
      and season.game_year < 3
      and season.status in ('active', 'planned');

    return new;
  end if;

  update public.rider_season_ratings as rating
  set
    mountain = greatest(0, rating.mountain - 2),
    hills = greatest(0, rating.hills - 2),
    flat = greatest(0, rating.flat - 2),
    time_trial = greatest(0, rating.time_trial - 2),
    cobbles = greatest(0, rating.cobbles - 2),
    sprint = greatest(0, rating.sprint - 2),
    acceleration = greatest(0, rating.acceleration - 2),
    downhill = greatest(0, rating.downhill - 2),
    endurance = greatest(0, rating.endurance - 2),
    resistance = greatest(0, rating.resistance - 2),
    recovery = greatest(0, rating.recovery - 2),
    breakaway = greatest(0, rating.breakaway - 2),
    prologue = greatest(0, rating.prologue - 2),
    updated_at = now()
  from public.seasons as season
  where rating.rider_id = old.rider_id
    and season.id = rating.season_id
    and season.game_year < 3
    and season.status in ('active', 'planned');

  return old;
end;
$$;

alter table public.rider_contracts
  add column if not exists homegrown_salary_before_discount numeric(12, 2);

alter table public.rider_contracts
  drop constraint if exists rider_contracts_homegrown_salary_before_discount_valid;
alter table public.rider_contracts
  add constraint rider_contracts_homegrown_salary_before_discount_valid check (
    homegrown_salary_before_discount is null
    or homegrown_salary_before_discount >= 0
  );

-- Cette lecture ciblée sert aussi au mécanisme historique de perte du bonus.
create index if not exists youth_academy_riders_promoted_rider_team_idx
  on public.youth_academy_riders (promoted_rider_id, team_id)
  where status = 'promoted' and promoted_rider_id is not null;

create or replace function public.apply_homegrown_salary_discount_to_contract()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_homegrown_at_team boolean := false;
begin
  if new.salary_per_season <= 0 then
    return new;
  end if;

  if not exists (
    select 1
    from public.seasons as season
    where season.game_year >= 3
      and (season.id = new.start_season_id or season.status = 'active')
  ) then
    return new;
  end if;

  select exists (
    select 1
    from public.rider_special_abilities as ability
    join public.youth_academy_riders as academy
      on academy.promoted_rider_id = ability.rider_id
     and academy.team_id = new.team_id
     and academy.status = 'promoted'
    where ability.rider_id = new.rider_id
      and ability.ability_code = 'homegrown'
  )
  into v_is_homegrown_at_team;

  if v_is_homegrown_at_team then
    if tg_op = 'INSERT' then
      new.homegrown_salary_before_discount := new.salary_per_season;
      new.salary_per_season := round(new.salary_per_season / 2, 2);
    elsif old.homegrown_salary_before_discount is null then
      new.homegrown_salary_before_discount := new.salary_per_season;
      new.salary_per_season := round(new.salary_per_season / 2, 2);
    elsif new.salary_per_season is distinct from old.salary_per_season then
      new.homegrown_salary_before_discount := new.salary_per_season;
      new.salary_per_season := round(new.salary_per_season / 2, 2);
    else
      new.homegrown_salary_before_discount := old.homegrown_salary_before_discount;
    end if;
  elsif tg_op = 'UPDATE'
    and old.homegrown_salary_before_discount is not null
    and (
      new.team_id is distinct from old.team_id
      or new.rider_id is distinct from old.rider_id
      or new.start_season_id is distinct from old.start_season_id
    )
  then
    new.salary_per_season := old.homegrown_salary_before_discount;
    new.homegrown_salary_before_discount := null;
  end if;

  return new;
end;
$$;

drop trigger if exists apply_homegrown_salary_discount_before_contract_write
  on public.rider_contracts;
create trigger apply_homegrown_salary_discount_before_contract_write
before insert or update of rider_id, team_id, start_season_id, salary_per_season
on public.rider_contracts
for each row
execute function public.apply_homegrown_salary_discount_to_contract();

-- La Saison 3 hérite des notes de Saison 2 au rollover. Neutraliser le +2 une
-- seule fois après cette copie, puis activer les salaires réduits. Les saisons
-- suivantes copient déjà des notes sans bonus et ne doivent plus être touchées.
create or replace function public.activate_season_three_homegrown_effect()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'active' or old.status = 'active' or new.game_year < 3 then
    return new;
  end if;

  if new.game_year = 3 then
    update public.rider_season_ratings as rating
    set
      mountain = greatest(0, rating.mountain - 2),
      hills = greatest(0, rating.hills - 2),
      flat = greatest(0, rating.flat - 2),
      time_trial = greatest(0, rating.time_trial - 2),
      cobbles = greatest(0, rating.cobbles - 2),
      sprint = greatest(0, rating.sprint - 2),
      acceleration = greatest(0, rating.acceleration - 2),
      downhill = greatest(0, rating.downhill - 2),
      endurance = greatest(0, rating.endurance - 2),
      resistance = greatest(0, rating.resistance - 2),
      recovery = greatest(0, rating.recovery - 2),
      breakaway = greatest(0, rating.breakaway - 2),
      prologue = greatest(0, rating.prologue - 2),
      updated_at = now()
    where rating.season_id = new.id
      and exists (
        select 1
        from public.rider_special_abilities as ability
        where ability.rider_id = rating.rider_id
          and ability.ability_code = 'homegrown'
      );
  end if;

  -- Mentionner salary_per_season dans le SET déclenche le BEFORE trigger qui
  -- applique exactement une fois la réduction et mémorise le salaire nominal.
  update public.rider_contracts as contract
  set salary_per_season = contract.salary_per_season
  from public.seasons as start_season,
    public.seasons as end_season
  where start_season.id = contract.start_season_id
    and end_season.id = contract.end_season_id
    and new.game_year between start_season.game_year and end_season.game_year
    and contract.status = 'active'
    and contract.salary_per_season > 0
    and contract.homegrown_salary_before_discount is null
    and exists (
      select 1
      from public.rider_special_abilities as ability
      join public.youth_academy_riders as academy
        on academy.promoted_rider_id = ability.rider_id
       and academy.team_id = contract.team_id
       and academy.status = 'promoted'
      where ability.rider_id = contract.rider_id
        and ability.ability_code = 'homegrown'
    );

  return new;
end;
$$;

drop trigger if exists homegrown_effect_on_season_activation
  on public.seasons;
create trigger homegrown_effect_on_season_activation
after update of status
on public.seasons
for each row
execute function public.activate_season_three_homegrown_effect();

-- Les renouvellements de Saison 3 déjà planifiés reçoivent immédiatement le
-- bon salaire. Aucun contrat actif de Saison 2 n’est modifié avant le rollover.
update public.rider_contracts as contract
set salary_per_season = contract.salary_per_season
from public.seasons as start_season
where start_season.id = contract.start_season_id
  and start_season.game_year >= 3
  and contract.status = 'planned'
  and contract.salary_per_season > 0
  and contract.homegrown_salary_before_discount is null
  and exists (
    select 1
    from public.rider_special_abilities as ability
    join public.youth_academy_riders as academy
      on academy.promoted_rider_id = ability.rider_id
     and academy.team_id = contract.team_id
     and academy.status = 'promoted'
    where ability.rider_id = contract.rider_id
      and ability.ability_code = 'homegrown'
  );

revoke all on function public.apply_homegrown_salary_discount_to_contract()
  from public, anon, authenticated;
revoke all on function public.activate_season_three_homegrown_effect()
  from public, anon, authenticated;

comment on column public.rider_contracts.homegrown_salary_before_discount is
  'Salaire nominal mémorisé quand Formé au club applique sa réduction de 50 % à partir de la Saison 3.';
comment on function public.apply_homegrown_rating_bonus() is
  'Conserve le bonus historique de deux points uniquement pendant les Saisons 1 et 2.';
comment on function public.apply_homegrown_salary_discount_to_contract() is
  'Divise une seule fois par deux le salaire du coureur resté dans son club formateur à partir de la Saison 3.';
comment on function public.activate_season_three_homegrown_effect() is
  'Neutralise le bonus de notes au passage en Saison 3 et active la réduction salariale sans toucher la Saison 2.';

notify pgrst, 'reload schema';

commit;
