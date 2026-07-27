-- ============================================================
-- Capacité Formé au club : attribution unique, bonus et perte
-- ============================================================

begin;

alter table public.special_ability_catalog
  drop constraint if exists special_ability_catalog_code_allowed;

alter table public.special_ability_catalog
  add constraint special_ability_catalog_code_allowed check (
    code in (
      'flahute',
      'panache',
      'bottle_carrier',
      'locomotive',
      'giclette',
      'chase_potato',
      'sandwich_man',
      'iron_health',
      'first_in_class',
      'homegrown'
    )
  );

insert into public.special_ability_catalog (
  code,
  name,
  effect_description,
  icon_key,
  medallion_tone
)
values (
  'homegrown',
  'Formé au club',
  'Accorde +2 à toutes les caractéristiques ; cette capacité est perdue définitivement en cas de départ ou de non-renouvellement.',
  'baby_bottle',
  'pink'
)
on conflict (code) do update set
  name = excluded.name,
  effect_description = excluded.effect_description,
  icon_key = excluded.icon_key,
  medallion_tone = excluded.medallion_tone,
  is_active = true;

create or replace function public.validate_homegrown_ability_source()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ability_code <> 'homegrown' then
    return new;
  end if;

  if new.source_type is distinct from 'youth_academy' or not exists (
    select 1
    from public.youth_academy_riders as academy
    where academy.promoted_rider_id = new.rider_id
      and academy.status = 'promoted'
      and new.source_reference = 'academy:' || academy.id::text
      and exists (
        select 1
        from public.rider_contracts as contract
        where contract.rider_id = new.rider_id
          and contract.team_id = academy.team_id
          and contract.status in ('active', 'planned')
      )
  ) then
    raise exception
      'Formé au club ne peut être obtenu que par une promotion depuis le centre de formation.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_homegrown_ability_source_before_insert
  on public.rider_special_abilities;
create trigger validate_homegrown_ability_source_before_insert
before insert
on public.rider_special_abilities
for each row
execute function public.validate_homegrown_ability_source();

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
    and season.status in ('active', 'planned');

  return old;
end;
$$;

drop trigger if exists apply_homegrown_rating_bonus_after_change
  on public.rider_special_abilities;
create trigger apply_homegrown_rating_bonus_after_change
after insert or delete
on public.rider_special_abilities
for each row
execute function public.apply_homegrown_rating_bonus();

create or replace function public.grant_homegrown_ability_from_academy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'promoted' or new.promoted_rider_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'promoted' then
    return new;
  end if;

  if not exists (
    select 1
    from public.rider_contracts as contract
    where contract.rider_id = new.promoted_rider_id
      and contract.team_id = new.team_id
      and contract.status in ('active', 'planned')
  ) then
    return new;
  end if;

  insert into public.rider_special_abilities (
    rider_id,
    ability_code,
    source_type,
    source_reference
  )
  values (
    new.promoted_rider_id,
    'homegrown',
    'youth_academy',
    'academy:' || new.id::text
  )
  on conflict (rider_id, ability_code) do nothing;

  return new;
end;
$$;

drop trigger if exists grant_homegrown_ability_from_academy_after_write
  on public.youth_academy_riders;
create trigger grant_homegrown_ability_from_academy_after_write
after insert or update
on public.youth_academy_riders
for each row
execute function public.grant_homegrown_ability_from_academy();

create or replace function public.reconcile_homegrown_ability_after_contract()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rider_id uuid := case
    when tg_op = 'DELETE' then old.rider_id
    else new.rider_id
  end;
  v_formative_team_id uuid;
begin
  if not exists (
    select 1
    from public.rider_special_abilities as ability
    where ability.rider_id = v_rider_id
      and ability.ability_code = 'homegrown'
  ) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select academy.team_id
  into v_formative_team_id
  from public.youth_academy_riders as academy
  where academy.promoted_rider_id = v_rider_id
    and academy.status = 'promoted'
  order by academy.updated_at desc
  limit 1;

  if v_formative_team_id is not null and exists (
    select 1
    from public.rider_contracts as contract
    join public.seasons as start_season
      on start_season.id = contract.start_season_id
    join public.seasons as end_season
      on end_season.id = contract.end_season_id
    where contract.rider_id = v_rider_id
      and contract.team_id = v_formative_team_id
      and (
        (contract.status = 'active'
          and end_season.status in ('active', 'planned'))
        or (contract.status = 'planned'
          and start_season.status in ('active', 'planned'))
      )
  ) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  delete from public.rider_special_abilities
  where rider_id = v_rider_id
    and ability_code = 'homegrown';

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists reconcile_homegrown_contract_after_insert_or_delete
  on public.rider_contracts;
create trigger reconcile_homegrown_contract_after_insert_or_delete
after insert or delete
on public.rider_contracts
for each row
execute function public.reconcile_homegrown_ability_after_contract();

drop trigger if exists reconcile_homegrown_contract_after_update
  on public.rider_contracts;
create trigger reconcile_homegrown_contract_after_update
after update of rider_id, team_id, status
on public.rider_contracts
for each row
execute function public.reconcile_homegrown_ability_after_contract();

create or replace function public.remove_unrenewed_homegrown_abilities()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status <> 'active' or new.status <> 'completed' then
    return new;
  end if;

  delete from public.rider_special_abilities as ability
  where ability.ability_code = 'homegrown'
    and not exists (
      select 1
      from public.youth_academy_riders as academy
      join public.rider_contracts as contract
        on contract.rider_id = academy.promoted_rider_id
       and contract.team_id = academy.team_id
      join public.seasons as start_season
        on start_season.id = contract.start_season_id
      join public.seasons as end_season
        on end_season.id = contract.end_season_id
      where academy.promoted_rider_id = ability.rider_id
        and academy.status = 'promoted'
        and (
          (contract.status = 'planned'
            and start_season.status in ('active', 'planned'))
          or (contract.status = 'active'
            and contract.end_season_id <> new.id
            and end_season.status in ('active', 'planned'))
        )
    );

  return new;
end;
$$;

drop trigger if exists remove_unrenewed_homegrown_before_season_completion
  on public.seasons;
create trigger remove_unrenewed_homegrown_before_season_completion
before update of status
on public.seasons
for each row
execute function public.remove_unrenewed_homegrown_abilities();

insert into public.rider_special_abilities (
  rider_id,
  ability_code,
  source_type,
  source_reference
)
select
  academy.promoted_rider_id,
  'homegrown',
  'youth_academy',
  'academy:' || academy.id::text
from public.youth_academy_riders as academy
where academy.status = 'promoted'
  and academy.promoted_rider_id is not null
  and exists (
    select 1
    from public.rider_contracts as contract
    where contract.rider_id = academy.promoted_rider_id
      and contract.team_id = academy.team_id
      and contract.status in ('active', 'planned')
  )
on conflict (rider_id, ability_code) do nothing;

revoke all on function public.validate_homegrown_ability_source()
  from public;
revoke all on function public.apply_homegrown_rating_bonus()
  from public;
revoke all on function public.grant_homegrown_ability_from_academy()
  from public;
revoke all on function public.reconcile_homegrown_ability_after_contract()
  from public;
revoke all on function public.remove_unrenewed_homegrown_abilities()
  from public;

comment on function public.validate_homegrown_ability_source() is
  'Interdit toute attribution de Formé au club hors d’une promotion du centre de formation.';
comment on function public.apply_homegrown_rating_bonus() is
  'Ajoute ou retire deux points aux treize caractéristiques actives du coureur.';
comment on function public.reconcile_homegrown_ability_after_contract() is
  'Retire Formé au club après transfert ou absence de renouvellement avec le club formateur.';
comment on function public.remove_unrenewed_homegrown_abilities() is
  'Retire Formé au club avant la clôture d’une saison si aucun contrat futur avec le club formateur n’existe.';

notify pgrst, 'reload schema';

commit;
