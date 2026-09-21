begin;

create or replace function public.get_current_team_purchase_financial_risk(
  p_expense numeric
)
returns table (
  currency text,
  current_projected_balance numeric,
  projected_balance_after_purchase numeric,
  requires_confirmation boolean,
  was_already_negative boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_season public.team_seasons%rowtype;
  v_projected_balance numeric(14, 2);
  v_expense numeric(14, 2);
begin
  if auth.uid() is null then
    raise exception 'Authentification requise.';
  end if;

  if p_expense is null
    or p_expense::text in ('NaN', 'Infinity', '-Infinity')
    or p_expense <= 0
    or p_expense > 1000000000
  then
    raise exception 'Montant d’achat invalide.';
  end if;

  v_expense := round(p_expense, 2);

  select team_season.*
  into v_team_season
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season
    on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_team_season.id is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  select round(
    v_team_season.opening_cash_balance
      + coalesce(sum(transaction.amount) filter (
          where transaction.status <> 'cancelled'
        ), 0),
    2
  )
  into v_projected_balance
  from public.team_finance_transactions as transaction
  where transaction.team_season_id = v_team_season.id;

  return query
  select
    v_team_season.currency,
    v_projected_balance,
    round(v_projected_balance - v_expense, 2),
    round(v_projected_balance - v_expense, 2) < 0,
    v_projected_balance < 0;
end;
$$;

comment on function public.get_current_team_purchase_financial_risk(numeric) is
  'Calcule, pour le DS authentifié, si une nouvelle dépense aggraverait ou créerait une projection de fin de saison négative.';

revoke all on function public.get_current_team_purchase_financial_risk(numeric)
  from public, anon;
grant execute on function public.get_current_team_purchase_financial_risk(numeric)
  to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
