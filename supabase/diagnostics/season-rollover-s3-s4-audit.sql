-- Bounded, read-only production audit. Never includes integration fixtures.
begin read only;
set local statement_timeout = '8s';
with ids as (
  select '74a7fd2f-ee7a-4d3f-bfe5-a97d0909d6c6'::uuid source_id,
    'c0c5824c-43a4-442e-907c-265c479efa0a'::uuid target_id
)
select 'health' kind, public.get_season_rollover_health() details
union all select 'integrity',public.get_season_rollover_integrity(source_id,target_id) from ids
union all select 'receipt',to_jsonb(x) from public.season_rollover_settlements x, ids where x.source_season_id=ids.source_id
union all select 'season',to_jsonb(x) from (
  select s.game_year,s.status,s.current_day_number,s.starts_on,s.ends_on
  from public.seasons s,ids where s.id in (ids.source_id,ids.target_id)
) x
union all select 'source_contracts',to_jsonb(x) from (
  select c.status,count(*) count from public.rider_contracts c,ids where c.end_season_id=ids.source_id group by c.status
) x
union all select 'new_contracts',to_jsonb(x) from (
  select c.status,c.acquisition_type,count(*) count from public.rider_contracts c,ids
  where c.start_season_id=ids.target_id group by c.status,c.acquisition_type
) x
union all select 'other_checks',jsonb_build_object(
  'incorrectTeamDivisions',(select count(*) from public.team_seasons s
    join public.team_seasons t on t.team_id=s.team_id and t.season_id=ids.target_id
    left join public.divisions d on d.id=t.division_id
    where s.season_id=ids.source_id and s.status<>'withdrawn' and d.code is distinct from case
      when s.final_rank<=20 then 'elite' when s.final_rank<=50 then 'world'
      when s.final_rank<=100 then 'continental' when s.final_rank<=200 then 'national' else null end),
  'incorrectOpeningCash',(select count(*) from public.team_seasons s join public.team_seasons t
    on t.team_id=s.team_id and t.season_id=ids.target_id
    where s.season_id=ids.source_id and s.status<>'withdrawn' and t.opening_cash_balance is distinct from s.cash_balance),
  'expiredManagerAssignments',(select count(*) from public.team_manager_assignments a where a.end_season_id=ids.source_id and a.status='active'),
  'unactivatedManagerAssignments',(select count(*) from public.team_manager_assignments a where a.start_season_id=ids.target_id and a.status='planned'),
  'oldDevelopmentTeams',(select count(*) from public.development_teams d where d.season_id=ids.source_id and d.status='active'),
  'oldOpenAuctions',(select count(*) from public.transfer_market_listings l where l.season_id=ids.source_id and l.status='open'),
  'oldPendingOffers',(select count(*) from public.direct_transfer_offers o where o.season_id=ids.source_id and o.status='pending'),
  'expiredActiveSponsors',(select count(*) from public.team_sponsor_contracts c join public.seasons s on s.id=c.start_season_id
    left join public.seasons e on e.id=c.end_season_id
    where c.status='active' and coalesce(e.game_year,s.game_year+c.contract_duration_seasons-1)<4),
  'unactivatedReadySponsors',(select count(*) from public.team_sponsor_contracts c
    where c.start_season_id=ids.target_id and c.status='planned' and c.selected_jersey_id is not null and c.selected_jersey_style is not null),
  'staleSponsorObjectives',(select count(*) from public.team_sponsor_contracts c join public.seasons s on s.id=c.start_season_id
    where c.status='active' and c.role='principal' and coalesce(c.objective_season_id,c.start_season_id)<>ids.target_id and s.game_year<=4),
  'incorrectSponsorBudgets',(select count(*) from public.team_sponsor_contracts c join public.team_seasons t
    on t.team_id=c.team_id and t.season_id=ids.target_id where c.status='active' and c.role='principal'
      and t.operating_budget<>round(c.budget_per_season*(1+least(7,t.next_sponsor_budget_bonus_percent)/100),2)),
  'expiredActiveEquipmentPartners',(select count(*) from public.equipment_partner_contracts c join public.seasons e on e.id=c.end_season_id
    where c.status='active' and e.game_year<4),
  'incorrectFederationDivisions',(select count(*) from public.national_federation_accounts a
    join public.national_federation_nations_cup_assignments n on n.country_id=a.country_id and n.season_id=a.season_id
    where a.season_id=ids.target_id and a.nations_cup_division<>n.division),
  'missingFederationAccounts',(select count(*) from public.national_federation_nations_cup_assignments n
    where n.season_id=ids.target_id and not exists (select 1 from public.national_federation_accounts a
      where a.country_id=n.country_id and a.season_id=n.season_id))
) from ids
union all select 'nations_cup_movements',to_jsonb(x) from (
  select n.source_division,n.division,n.movement,count(*) count
  from public.national_federation_nations_cup_assignments n,ids
  where n.season_id=ids.target_id group by n.source_division,n.division,n.movement
) x;
rollback;
