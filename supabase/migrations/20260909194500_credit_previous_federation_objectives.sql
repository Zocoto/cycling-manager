-- Credit the next federation opening from objectives completed during the
-- source season. Future-season objectives must never fund their own opening.

alter table public.national_federation_accounts
  add column if not exists objective_level text not null default 'none';
alter table public.national_federation_accounts
  add column if not exists objective_completed_count integer not null default 0;
alter table public.national_federation_accounts
  add column if not exists objective_bonus numeric(14, 2) not null default 0;

alter table public.national_federation_accounts
  drop constraint if exists national_federation_accounts_objective_level_allowed;
alter table public.national_federation_accounts
  add constraint national_federation_accounts_objective_level_allowed
    check (objective_level in ('none', 'bronze', 'silver', 'gold'));
alter table public.national_federation_accounts
  drop constraint if exists national_federation_accounts_objective_values_valid;
alter table public.national_federation_accounts
  add constraint national_federation_accounts_objective_values_valid
    check (
      objective_completed_count between 0 and 5
      and objective_bonus >= 0
    );

create or replace function public.credit_previous_federation_objective_bonus()
returns trigger
language plpgsql
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  v_source_season_id uuid;
  v_objective_count integer := 0;
  v_objective_level text := 'none';
  v_bonus_rate numeric := 0;
  v_uci_performance numeric := 0;
  v_uci_grant numeric := 0;
  v_nations_grant numeric := 0;
  v_structural_revenue numeric := 0;
  v_bonus numeric := 0;
begin
  select season.id into v_source_season_id
  from public.seasons as season
  where season.game_year = new.source_game_year;

  if v_source_season_id is null then
    return new;
  end if;

  v_objective_count := least(5, greatest(0, coalesce((
    public.get_national_federation_race_creation_score(
      new.country_id,
      v_source_season_id
    ) ->> 'completedObjectiveCount'
  )::integer, 0)));

  if v_objective_count >= 5 then
    v_objective_level := 'gold';
    v_bonus_rate := 0.10;
  elsif v_objective_count >= 3 then
    v_objective_level := 'silver';
    v_bonus_rate := 0.06;
  elsif v_objective_count >= 1 then
    v_objective_level := 'bronze';
    v_bonus_rate := 0.03;
  end if;

  v_uci_performance :=
    1 - (least(173, greatest(1, new.uci_rank)) - 1)::numeric / 172;
  v_uci_grant := round(
    (150000 + 850000 * sqrt(v_uci_performance)) / 5000
  ) * 5000;
  v_nations_grant := case new.nations_cup_division
    when 1 then 450000
    when 2 then 300000
    when 3 then 200000
    else 120000
  end;
  v_structural_revenue := 1200000 + v_uci_grant + v_nations_grant;
  v_bonus := round(v_structural_revenue * v_bonus_rate / 5000) * 5000;

  update public.national_federation_accounts
  set objective_level = v_objective_level,
      objective_completed_count = v_objective_count,
      objective_bonus = v_bonus,
      opening_balance = opening_balance + v_bonus,
      balance = balance + v_bonus,
      updated_at = now()
  where id = new.id;

  if v_bonus > 0 then
    insert into public.national_federation_transactions (
      account_id, day_number, amount, category, description,
      source_reference, metadata
    ) values (
      new.id, 1, v_bonus, 'objective_bonus',
      'Bonus des objectifs fédéraux réalisés en S'
        || new.source_game_year::text || '.',
      'federation-account:' || new.id::text || ':previous-objectives',
      jsonb_build_object(
        'sourceGameYear', new.source_game_year,
        'completedObjectiveCount', v_objective_count,
        'objectiveLevel', v_objective_level,
        'bonusRatePercentage', v_bonus_rate * 100,
        'structuralRevenue', v_structural_revenue
      )
    ) on conflict (source_reference) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists credit_previous_federation_objective_bonus
  on public.national_federation_accounts;
create trigger credit_previous_federation_objective_bonus
after insert on public.national_federation_accounts
for each row execute function public.credit_previous_federation_objective_bonus();

revoke all on function public.credit_previous_federation_objective_bonus()
  from public, anon, authenticated;

comment on function public.credit_previous_federation_objective_bonus() is
  'Crédite à J1 les objectifs terminés durant la saison source : 1-2 = 3 %, 3-4 = 6 %, 5 = 10 %.';
