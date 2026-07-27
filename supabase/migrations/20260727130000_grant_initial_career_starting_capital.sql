begin;

-- ============================================================
-- Pécule de départ d'une nouvelle carrière
-- ============================================================

create or replace function private.grant_initial_career_starting_capital()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.team_seasons as team_season
  set
    opening_cash_balance = team_season.opening_cash_balance + 10000,
    cash_balance = team_season.cash_balance + 10000
  where team_season.team_id = new.team_id
    and team_season.season_id = new.season_id;

  if not found then
    raise exception
      'La saison d''équipe initiale est introuvable pour le pécule de départ.';
  end if;

  return new;
end;
$$;

drop trigger if exists initial_career_starting_capital
  on public.initial_career_generations;

create trigger initial_career_starting_capital
after insert
on public.initial_career_generations
for each row
execute function private.grant_initial_career_starting_capital();

-- Rattrapage prudent des carrières tout juste créées avant cette migration :
-- aucune transaction ne doit exister et les deux soldes doivent encore être
-- strictement nuls. Une carrière déjà jouée ne reçoit donc jamais un second
-- crédit.
update public.team_seasons as team_season
set
  opening_cash_balance = 10000,
  cash_balance = 10000
from public.initial_career_generations as generation
where generation.team_id = team_season.team_id
  and generation.season_id = team_season.season_id
  and team_season.status = 'active'
  and team_season.opening_cash_balance = 0
  and team_season.cash_balance = 0
  and exists (
    select 1
    from public.seasons as season
    where season.id = team_season.season_id
      and season.status = 'active'
  )
  and not exists (
    select 1
    from public.team_finance_transactions as transaction
    where transaction.team_season_id = team_season.id
  );

revoke all
on function private.grant_initial_career_starting_capital()
from public, anon, authenticated;

comment on function private.grant_initial_career_starting_capital() is
  'Crédite une seule fois 10 000 EUR de solde d’ouverture lors de la création atomique d’une carrière.';

commit;
