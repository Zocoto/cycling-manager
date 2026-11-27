begin;
set local statement_timeout='5s';
set local lock_timeout='500ms';

alter table public.secondary_sponsor_offers
  add column principal_budget_per_season numeric(14,2),
  add column maximum_reward_budget numeric(14,2),
  add constraint secondary_sponsor_offer_budget_snapshot_shape check (
    (principal_budget_per_season is null and maximum_reward_budget is null)
    or (principal_budget_per_season is not null and principal_budget_per_season>0
      and principal_budget_per_season<=999999999999.99 and maximum_reward_budget is not null
      and maximum_reward_budget=floor(round(principal_budget_per_season*100)*3/10)/100)
  );

create function private.secondary_sponsor_primary_budget(p_team_id uuid,p_season_id uuid)
returns numeric language sql stable security definer set search_path='' as $$
  select contract.budget_per_season
  from public.team_sponsor_contracts contract
  join public.seasons first_season on first_season.id=contract.start_season_id
  left join public.seasons last_season on last_season.id=contract.end_season_id
  join public.seasons target on target.id=p_season_id
  where contract.team_id=p_team_id and contract.role='principal' and contract.status in('planned','active')
    and target.game_year between first_season.game_year
      and coalesce(last_season.game_year,first_season.game_year+contract.contract_duration_seasons-1)
  order by first_season.game_year desc,(contract.status='planned') desc,contract.id limit 1;
$$;

create function public.get_secondary_sponsor_primary_budget(p_team_id uuid,p_target_season_id uuid)
returns numeric language sql stable security definer set search_path='' as $$
  select private.secondary_sponsor_primary_budget(p_team_id,p_target_season_id);
$$;
revoke all on function public.get_secondary_sponsor_primary_budget(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_secondary_sponsor_primary_budget(uuid,uuid) to service_role;

create or replace function public.get_secondary_sponsor_offer_context(p_team_id uuid,p_target_season_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  with counts as (
    select rider.country_id,count(distinct rider.id)::integer as rider_count
    from public.rider_contracts contract
    join public.riders rider on rider.id=contract.rider_id and rider.status='active'
    join public.seasons first_season on first_season.id=contract.start_season_id
    join public.seasons last_season on last_season.id=contract.end_season_id
    join public.seasons active_season on active_season.status='active'
    where contract.team_id=p_team_id and contract.status='active'
      and active_season.game_year between first_season.game_year and last_season.game_year
    group by rider.country_id
  )
  select jsonb_build_object(
    'roster_size',coalesce(sum(rider_count),0)::integer,
    'roster_country_counts',coalesce(jsonb_object_agg(country_id::text,rider_count),'{}'::jsonb),
    'principal_country_id',private.secondary_sponsor_primary_country(p_team_id,p_target_season_id),
    'principal_budget_per_season',private.secondary_sponsor_primary_budget(p_team_id,p_target_season_id)
  ) from counts;
$$;

-- Hamilton allocation in cents. Reserving one cent keeps every objective positive.
create function private.normalize_secondary_sponsor_budget(p_objectives jsonb,p_primary_budget numeric)
returns jsonb language plpgsql immutable set search_path='' as $$
declare v_count integer;v_cap bigint;v_total numeric;v_result jsonb;
begin
  if p_primary_budget is null or p_primary_budget<=0 or p_primary_budget='NaN'::numeric then
    raise exception 'Choisissez un sponsor principal couvrant cette saison avant le sponsor secondaire.';
  end if;
  if p_objectives is null or jsonb_typeof(p_objectives)<>'array' then
    raise exception 'La liste des objectifs secondaires est invalide.';
  end if;
  v_count:=jsonb_array_length(p_objectives);
  v_cap:=floor(round(p_primary_budget*100)*3/10)::bigint;
  if v_count not between 1 and 6 or v_cap<v_count then
    raise exception 'Le budget principal est insuffisant pour les objectifs secondaires.';
  end if;
  if exists(select 1 from jsonb_array_elements(p_objectives) goal
    where goal->>'cash_reward' is null or (goal->>'cash_reward')::numeric='NaN'::numeric
      or round((goal->>'cash_reward')::numeric*100)<1) then
    raise exception 'Une prime secondaire doit être strictement positive.';
  end if;
  select sum(round((goal->>'cash_reward')::numeric*100)) into v_total
    from jsonb_array_elements(p_objectives) goal;
  with weighted as (
    select goal,position,round((goal->>'cash_reward')::numeric*100) as weight
    from jsonb_array_elements(p_objectives) with ordinality as item(goal,position)
  ), quotas as (
    select *,case when v_total<=v_cap then weight
      else (v_cap-v_count)*weight end as numerator from weighted
  ), bases as (
    select *,case when v_total<=v_cap then weight else 1+div(numerator,v_total) end as base,
      case when v_total<=v_cap then 0 else mod(numerator,v_total) end as fraction from quotas
  ), ranked as (
    select *,row_number()over(order by fraction desc,position) as remainder_rank,
      least(v_cap,v_total)-sum(base)over() as extra_cents from bases
  ), allocated as (
    select goal,position,(base+case when remainder_rank<=extra_cents then 1 else 0 end)/100 as reward
    from ranked
  )
  select jsonb_agg(goal||jsonb_build_object(
    'cash_reward',reward,'reputation_penalty',case when reward>=100000
      then least(25,ceil(reward/100000)*5) else 0 end
  ) order by position) into v_result from allocated;
  return v_result;
end;
$$;

-- Keep budget changes and signing/generation serialized without locking unrelated teams.
create function private.lock_secondary_sponsor_budget(p_team_id uuid,p_season_id uuid)
returns void language sql volatile set search_path='' as $$
  select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'secondary-sponsor-budget:'||p_team_id::text||':'||p_season_id::text,0));
$$;

create function private.apply_secondary_sponsor_budget_cap(p_offer_id uuid,p_require_primary boolean default false)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  v_offer public.secondary_sponsor_offers%rowtype;v_budget numeric;v_cap numeric;
  v_goals jsonb;v_normalized jsonb;
begin
  select * into v_offer from public.secondary_sponsor_offers where id=p_offer_id;
  if v_offer is null or v_offer.generation_version<2 then return false; end if;
  perform private.lock_secondary_sponsor_budget(v_offer.team_id,v_offer.target_season_id);
  select * into v_offer from public.secondary_sponsor_offers where id=p_offer_id for update;
  if v_offer.status not in('open','accepted')
    or not exists(select 1 from public.seasons where id=v_offer.target_season_id and status='planned')
    or (v_offer.status='accepted' and not exists(select 1 from public.secondary_sponsor_contracts
      where offer_id=v_offer.id and status='planned')) then return false; end if;
  v_budget:=private.secondary_sponsor_primary_budget(v_offer.team_id,v_offer.target_season_id);
  if coalesce(v_budget,0)<=0 then
    update public.secondary_sponsor_offers set principal_budget_per_season=null,maximum_reward_budget=null
      where id=v_offer.id and (principal_budget_per_season is not null or maximum_reward_budget is not null);
    if p_require_primary then
      raise exception 'Choisissez un sponsor principal couvrant cette saison avant le sponsor secondaire.';
    end if;
    return false;
  end if;
  if exists(select 1 from public.secondary_sponsor_objectives objective
      where objective.offer_id=v_offer.id and objective.status not in('draft','cancelled'))
    or exists(select 1 from public.secondary_sponsor_objectives objective
      join public.team_seasons team_season on team_season.team_id=v_offer.team_id
        and team_season.season_id=v_offer.target_season_id
      join public.team_finance_transactions receipt on receipt.team_season_id=team_season.id
        and receipt.source_reference='secondary-sponsor-objective:'||objective.id::text and receipt.status='posted'
      where objective.offer_id=v_offer.id) then
    raise exception 'Le contrat secondaire % a déjà été évalué ou payé et ne peut pas être réduit.',v_offer.id;
  end if;
  select jsonb_agg(jsonb_build_object('objective_id',id,'cash_reward',cash_reward)
    order by display_order,id) into v_goals from public.secondary_sponsor_objectives where offer_id=v_offer.id;
  if v_goals is null then return false; end if;
  v_normalized:=private.normalize_secondary_sponsor_budget(v_goals,v_budget);
  update public.secondary_sponsor_objectives objective
  set cash_reward=(goal->>'cash_reward')::numeric,
    reputation_penalty=least(objective.reputation_penalty,(goal->>'reputation_penalty')::numeric)
  from jsonb_array_elements(v_normalized)goal
  where objective.id=(goal->>'objective_id')::uuid
    and (objective.cash_reward is distinct from (goal->>'cash_reward')::numeric
      or objective.reputation_penalty is distinct from least(objective.reputation_penalty,(goal->>'reputation_penalty')::numeric));
  v_cap:=floor(round(v_budget*100)*3/10)/100;
  update public.secondary_sponsor_offers set principal_budget_per_season=v_budget,maximum_reward_budget=v_cap
    where id=v_offer.id and (principal_budget_per_season is distinct from v_budget or maximum_reward_budget is distinct from v_cap);
  return true;
end;
$$;

-- Preserve the already reviewed eligibility, identity, quotas and atomic offer replacement.
alter function public.replace_secondary_sponsor_offers(uuid,uuid,uuid,jsonb,integer) set schema private;
alter function private.replace_secondary_sponsor_offers(uuid,uuid,uuid,jsonb,integer) rename to replace_secondary_sponsor_offers_uncapped;
revoke all on function private.replace_secondary_sponsor_offers_uncapped(uuid,uuid,uuid,jsonb,integer) from public,anon,authenticated,service_role;
create function public.replace_secondary_sponsor_offers(
  p_director_id uuid,p_team_id uuid,p_target_season_id uuid,p_offers jsonb,p_generation_version integer default 2
) returns boolean language plpgsql security definer set search_path='' as $$
declare v_budget numeric;v_offer jsonb;v_payload jsonb:='[]'::jsonb;v_changed boolean;v_offer_id uuid;
begin
  perform private.lock_secondary_sponsor_budget(p_team_id,p_target_season_id);
  v_budget:=private.secondary_sponsor_primary_budget(p_team_id,p_target_season_id);
  if coalesce(v_budget,0)<=0 then
    raise exception 'Choisissez un sponsor principal couvrant cette saison avant le sponsor secondaire.';
  end if;
  if p_offers is null or jsonb_typeof(p_offers)<>'array' then raise exception 'Les propositions secondaires sont invalides.'; end if;
  for v_offer in select value from jsonb_array_elements(p_offers) loop
    v_payload:=v_payload||jsonb_build_array(v_offer||jsonb_build_object('objectives',
      private.normalize_secondary_sponsor_budget(v_offer->'objectives',v_budget)));
  end loop;
  v_changed:=private.replace_secondary_sponsor_offers_uncapped(p_director_id,p_team_id,p_target_season_id,v_payload,p_generation_version);
  for v_offer_id in select id from public.secondary_sponsor_offers where sporting_director_id=p_director_id
    and team_id=p_team_id and target_season_id=p_target_season_id and status='open' order by id loop
    perform private.apply_secondary_sponsor_budget_cap(v_offer_id,true);
  end loop;
  return v_changed;
end;
$$;
revoke all on function public.replace_secondary_sponsor_offers(uuid,uuid,uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.replace_secondary_sponsor_offers(uuid,uuid,uuid,jsonb,integer) to service_role;

alter function public.sign_secondary_sponsor_offer(uuid) set schema private;
alter function private.sign_secondary_sponsor_offer(uuid) rename to sign_secondary_sponsor_offer_uncapped;
revoke all on function private.sign_secondary_sponsor_offer_uncapped(uuid) from public,anon,authenticated,service_role;
create function public.sign_secondary_sponsor_offer(p_offer_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_offer public.secondary_sponsor_offers%rowtype;v_director_id uuid;
begin
  -- Resolve and verify ownership before touching another player's proposal or balance.
  select offer.* into v_offer from public.secondary_sponsor_offers offer
  join public.sporting_directors director on director.id=offer.sporting_director_id
  join public.team_manager_assignments assignment on assignment.team_id=offer.team_id
    and assignment.sporting_director_id=director.id and assignment.role='general_manager' and assignment.status='active'
  where offer.id=p_offer_id and offer.status='open' and director.auth_user_id=auth.uid() and director.status='active';
  if v_offer is null then raise exception 'Cette offre secondaire est indisponible.'; end if;
  perform private.lock_secondary_sponsor_budget(v_offer.team_id,v_offer.target_season_id);
  select id into v_director_id from public.sporting_directors where id=v_offer.sporting_director_id for update;
  perform private.apply_secondary_sponsor_budget_cap(p_offer_id,true);
  return private.sign_secondary_sponsor_offer_uncapped(p_offer_id);
end;
$$;
revoke all on function public.sign_secondary_sponsor_offer(uuid) from public,anon;
grant execute on function public.sign_secondary_sponsor_offer(uuid) to authenticated;

create function private.secondary_sponsor_primary_budget_changed()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_offer_id uuid;
begin
  if new.role<>'principal' then return new; end if;
  for v_offer_id in select offer.id from public.secondary_sponsor_offers offer
    join public.seasons target on target.id=offer.target_season_id and target.status='planned'
    where offer.team_id=new.team_id and offer.generation_version>=2 and offer.status in('open','accepted')
      and (offer.status='open' or exists(select 1 from public.secondary_sponsor_contracts
        where offer_id=offer.id and status='planned')) order by offer.id
  loop perform private.apply_secondary_sponsor_budget_cap(v_offer_id,false); end loop;
  return new;
end;
$$;
create trigger secondary_sponsor_budget_changed
  after insert or update of budget_per_season,sponsor_id,start_season_id,end_season_id,status on public.team_sponsor_contracts
  for each row execute function private.secondary_sponsor_primary_budget_changed();

-- Reprice only future V2 proposals and planned contracts, retaining every ID and target.
do $$
declare v_offer_id uuid;
begin
  for v_offer_id in select offer.id from public.secondary_sponsor_offers offer
    join public.seasons target on target.id=offer.target_season_id and target.status='planned'
    where offer.generation_version>=2 and offer.status in('open','accepted')
      and (offer.status='open' or exists(select 1 from public.secondary_sponsor_contracts
        where offer_id=offer.id and status='planned')) order by offer.id
  loop perform private.apply_secondary_sponsor_budget_cap(v_offer_id,false); end loop;
end;
$$;

revoke all on function private.secondary_sponsor_primary_budget(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function private.normalize_secondary_sponsor_budget(jsonb,numeric) from public,anon,authenticated,service_role;
revoke all on function private.lock_secondary_sponsor_budget(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function private.apply_secondary_sponsor_budget_cap(uuid,boolean) from public,anon,authenticated,service_role;
revoke all on function private.secondary_sponsor_primary_budget_changed() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
