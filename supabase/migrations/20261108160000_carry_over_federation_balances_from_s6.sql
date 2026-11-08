begin;
set local lock_timeout = '1s';
set local statement_timeout = '8s';

alter table public.national_federation_accounts
  add column carryover_balance numeric(14, 2) not null default 0
    check (carryover_balance >= 0);

alter table public.national_federation_transactions
  drop constraint national_federation_transactions_category_allowed,
  add constraint national_federation_transactions_category_allowed check (
    category in (
      'opening_grant', 'race_revenue', 'objective_bonus', 'donation',
      'solidarity', 'infrastructure', 'refund', 'hosting',
      'race_creation', 'race_maintenance', 'equipment', 'quadrennial_prize',
      'season_carryover'
    )
  );

create function private.credit_federation_season_carryover()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous_account_id uuid;
  v_previous_season_id uuid;
  v_previous_game_year integer;
  v_carryover numeric(14, 2);
begin
  select previous_account.id, previous_season.id, previous_season.game_year,
         previous_account.balance
    into v_previous_account_id, v_previous_season_id, v_previous_game_year, v_carryover
  from public.seasons as target_season
  join public.seasons as previous_season
    on previous_season.game_year = target_season.game_year - 1
   and previous_season.status = 'completed'
  join public.national_federation_accounts as previous_account
    on previous_account.season_id = previous_season.id
   and previous_account.country_id = new.country_id
  where target_season.id = new.season_id
    and target_season.game_year >= 6
    and previous_account.balance > 0;

  if not found then
    return new;
  end if;

  insert into public.national_federation_transactions (
    account_id, day_number, amount, category, description, source_reference, metadata
  ) values (
    new.id, 1, v_carryover, 'season_carryover', 'Solde reporté de la saison précédente.',
    'federation-account:' || new.id::text || ':season-carryover',
    jsonb_build_object(
      'sourceAccountId', v_previous_account_id,
      'sourceSeasonId', v_previous_season_id,
      'sourceGameYear', v_previous_game_year
    )
  )
  on conflict (source_reference) do nothing;

  if found then
    -- opening_balance remains the annual base for the solidarity allowance.
    update public.national_federation_accounts
    set carryover_balance = v_carryover,
        balance = balance + v_carryover,
        updated_at = now()
    where id = new.id;
  end if;

  return new;
end;
$$;

revoke all on function private.credit_federation_season_carryover()
  from public, anon, authenticated;

create trigger credit_federation_season_carryover
after insert on public.national_federation_accounts
for each row execute function private.credit_federation_season_carryover();

commit;
