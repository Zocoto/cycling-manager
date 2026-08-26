begin;

create table public.sporting_director_sponsor_trophies (
  id uuid primary key default gen_random_uuid(),
  sporting_director_id uuid not null
    references public.sporting_directors(id)
    on delete cascade,
  season_id uuid not null
    references public.seasons(id)
    on delete cascade,
  team_sponsor_contract_id uuid not null
    references public.team_sponsor_contracts(id)
    on delete cascade,
  satisfaction_score smallint not null default 100,
  awarded_at timestamptz not null default now(),
  constraint sporting_director_sponsor_trophies_per_season
    unique (sporting_director_id, season_id),
  constraint sporting_director_sponsor_trophies_contract_unique
    unique (team_sponsor_contract_id),
  constraint sporting_director_sponsor_trophies_perfect_score
    check (satisfaction_score = 100)
);

create index sporting_director_sponsor_trophies_director_idx
  on public.sporting_director_sponsor_trophies (
    sporting_director_id,
    awarded_at desc
  );

alter table public.sporting_director_sponsor_trophies
  enable row level security;

create policy sporting_director_sponsor_trophies_select_own
  on public.sporting_director_sponsor_trophies
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.sporting_directors as director
      where director.id = sporting_director_id
        and director.auth_user_id = (select auth.uid())
    )
  );

grant select on public.sporting_director_sponsor_trophies
  to authenticated;
grant all privileges on public.sporting_director_sponsor_trophies
  to service_role;

create or replace function public.award_sponsor_ambassador_trophy_after_evaluation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_director_id uuid;
begin
  if new.status <> 'completed'
     or new.satisfaction_score <> 100 then
    return new;
  end if;

  select assignment.sporting_director_id
  into v_director_id
  from public.team_manager_assignments as assignment
  where assignment.team_id = new.team_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
    and not exists (
      select 1
      from public.alpha_bot_managers as bot
      where bot.sporting_director_id = assignment.sporting_director_id
    )
  limit 1;

  if v_director_id is null then
    return new;
  end if;

  insert into public.sporting_director_sponsor_trophies (
    sporting_director_id,
    season_id,
    team_sponsor_contract_id,
    satisfaction_score,
    awarded_at
  )
  values (
    v_director_id,
    new.start_season_id,
    new.id,
    100,
    coalesce(new.satisfaction_updated_at, now())
  )
  on conflict do nothing;

  return new;
end;
$$;

create trigger award_sponsor_ambassador_trophy_after_evaluation
after update of satisfaction_score
on public.team_sponsor_contracts
for each row
execute function public.award_sponsor_ambassador_trophy_after_evaluation();

create or replace function public.validate_sponsor_ambassador_avatar_outfit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_outfit_key text;
begin
  if new.avatar_key is null
     or new.avatar_key not like 'director_custom_v1:%' then
    return new;
  end if;

  v_outfit_key := split_part(
    substring(
      new.avatar_key
      from char_length('director_custom_v1:') + 1
    ),
    '.',
    14
  );

  if v_outfit_key <> 'ambassador' then
    return new;
  end if;

  if not exists (
    select 1
    from public.sporting_director_sponsor_trophies as trophy
    where trophy.sporting_director_id = new.id
  ) then
    raise exception
      'Le trophée Ambassadeur exemplaire est requis pour porter le Maillot d’Or des Ambassadeurs.';
  end if;

  return new;
end;
$$;

create trigger validate_sponsor_ambassador_avatar_outfit_before_write
before insert or update of avatar_key
on public.sporting_directors
for each row
execute function public.validate_sponsor_ambassador_avatar_outfit();

-- Les contrats déjà parfaitement clôturés reçoivent la distinction de
-- manière idempotente. Le manager couvrant la saison est préféré, avec le
-- manager encore actif comme choix prioritaire en cas d’historique ambigu.
insert into public.sporting_director_sponsor_trophies (
  sporting_director_id,
  season_id,
  team_sponsor_contract_id,
  satisfaction_score,
  awarded_at
)
select
  manager.sporting_director_id,
  contract.start_season_id,
  contract.id,
  100,
  coalesce(contract.satisfaction_updated_at, contract.created_at, now())
from public.team_sponsor_contracts as contract
join public.seasons as contract_season
  on contract_season.id = contract.start_season_id
join lateral (
  select assignment.sporting_director_id
  from public.team_manager_assignments as assignment
  join public.seasons as assignment_start
    on assignment_start.id = assignment.start_season_id
  left join public.seasons as assignment_end
    on assignment_end.id = assignment.end_season_id
  where assignment.team_id = contract.team_id
    and assignment.role = 'general_manager'
    and assignment.status in ('active', 'completed', 'terminated')
    and contract_season.game_year >= assignment_start.game_year
    and (
      assignment_end.game_year is null
      or contract_season.game_year <= assignment_end.game_year
    )
    and not exists (
      select 1
      from public.alpha_bot_managers as bot
      where bot.sporting_director_id = assignment.sporting_director_id
    )
  order by
    case when assignment.status = 'active' then 0 else 1 end,
    assignment.created_at desc
  limit 1
) as manager on true
where contract.status = 'completed'
  and contract.satisfaction_score = 100
on conflict do nothing;

revoke all on function public.award_sponsor_ambassador_trophy_after_evaluation()
  from public, anon, authenticated;
revoke all on function public.validate_sponsor_ambassador_avatar_outfit()
  from public, anon, authenticated;

comment on table public.sporting_director_sponsor_trophies is
  'Trophée Ambassadeur exemplaire attribué une fois par saison terminée à 100 % de satisfaction sponsor.';
comment on function public.award_sponsor_ambassador_trophy_after_evaluation() is
  'Attribue idempotemment le trophée Ambassadeur exemplaire lors de la clôture parfaite d’un contrat sponsor.';
comment on function public.validate_sponsor_ambassador_avatar_outfit() is
  'Réserve le Maillot d’Or des Ambassadeurs aux Directeurs Sportifs ayant obtenu la distinction sponsor.';

notify pgrst, 'reload schema';

commit;
