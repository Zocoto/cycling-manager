begin;
set local statement_timeout = '5s';
set local lock_timeout = '500ms';

alter table public.secondary_sponsor_offers
  add column generation_version integer not null default 1,
  add column principal_country_id uuid references public.countries(id) on delete restrict;
-- Offers follow the managed team, while a director can change teams between negotiations.
do $$
declare v_constraint text;
begin
  select constraint_row.conname into v_constraint
  from pg_catalog.pg_constraint constraint_row
  where constraint_row.conrelid='public.secondary_sponsor_offers'::regclass and constraint_row.contype='u'
    and (select array_agg(attribute.attname::text order by attribute.attname)
      from unnest(constraint_row.conkey) as key_column(attnum)
      join pg_catalog.pg_attribute attribute on attribute.attrelid=constraint_row.conrelid
        and attribute.attnum=key_column.attnum)
      =array['secondary_sponsor_id','sporting_director_id','target_season_id']::text[];
  if v_constraint is null then raise exception 'La contrainte des offres secondaires a changé.'; end if;
  execute format('alter table public.secondary_sponsor_offers drop constraint %I',v_constraint);
end;
$$;
alter table public.secondary_sponsor_offers
  add constraint secondary_sponsor_offers_director_team_season_sponsor_key
    unique(sporting_director_id,team_id,target_season_id,secondary_sponsor_id);
alter table public.secondary_sponsor_contracts
  add column logo_color_mode text not null default 'original'
    check (logo_color_mode in ('original', 'black', 'white'));
alter table public.secondary_sponsor_objectives
  add column objective_kind text not null default 'race_result',
  add column target_country_id uuid references public.countries(id) on delete restrict,
  add column required_rider_count smallint,
  add column current_rider_count smallint,
  add column reputation_penalty numeric(12,2) not null default 0,
  add column penalty_settled_at timestamptz,
  alter column race_edition_id drop not null,
  alter column race_slug drop not null,
  alter column race_label drop not null,
  alter column race_category_code drop not null,
  alter column target_rank drop not null,
  add constraint secondary_sponsor_objective_kind_shape check (
    (objective_kind = 'race_result' and race_edition_id is not null
      and race_slug is not null and race_label is not null
      and race_category_code is not null and target_rank is not null
      and target_country_id is null and required_rider_count is null)
    or (objective_kind = 'roster_nationality' and race_edition_id is null
      and race_slug is null and race_label is null and race_category_code is null
      and target_rank is null and target_country_id is not null
      and required_rider_count is not null and required_rider_count between 1 and 10)
  ),
  add constraint secondary_sponsor_objective_roster_progress check (
    current_rider_count is null or current_rider_count >= 0
  ),
  add constraint secondary_sponsor_objective_penalty_range check (
    reputation_penalty between 0 and 1000
  );
create index secondary_sponsor_objectives_active_roster_idx
  on public.secondary_sponsor_objectives (offer_id, target_country_id)
  where objective_kind = 'roster_nationality' and status in ('draft','active');

create or replace function private.secondary_sponsor_primary_country(p_team_id uuid, p_season_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select sponsor.country_id
  from public.team_sponsor_contracts contract
  join public.sponsors sponsor on sponsor.id = contract.sponsor_id
  join public.seasons first_season on first_season.id = contract.start_season_id
  left join public.seasons last_season on last_season.id = contract.end_season_id
  join public.seasons target on target.id = p_season_id
  where contract.team_id = p_team_id and contract.role = 'principal'
    and contract.status in ('active','planned')
    and target.game_year between first_season.game_year
      and coalesce(last_season.game_year, first_season.game_year + contract.contract_duration_seasons - 1)
  order by first_season.game_year desc, (contract.status = 'planned') desc, contract.id
  limit 1;
$$;

create or replace function private.secondary_sponsor_roster_counts(
  p_team_id uuid, p_season_id uuid, p_country_id uuid
) returns table(total_count integer, country_count integer)
language sql stable security definer set search_path = '' as $$
  select count(distinct rider.id)::integer,
    count(distinct rider.id) filter (where rider.country_id = p_country_id)::integer
  from public.rider_contracts contract
  join public.riders rider on rider.id = contract.rider_id and rider.status = 'active'
  join public.seasons first_season on first_season.id = contract.start_season_id
  join public.seasons last_season on last_season.id = contract.end_season_id
  join public.seasons target on target.id = p_season_id
  where contract.team_id = p_team_id and contract.status = 'active'
    and target.game_year between first_season.game_year and last_season.game_year;
$$;

create or replace function public.get_secondary_sponsor_offer_context(p_team_id uuid,p_target_season_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
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
    'principal_country_id',private.secondary_sponsor_primary_country(p_team_id,p_target_season_id)
  ) from counts;
$$;
revoke all on function public.get_secondary_sponsor_offer_context(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_secondary_sponsor_offer_context(uuid,uuid) to service_role;

-- All achievements use the same idempotent ledger path, including roster targets.
create or replace function private.settle_secondary_sponsor_objective()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_context record;
  v_transaction_id uuid;
  v_day_number integer;
  v_day_id uuid;
  v_label text;
begin
  if new.status is not distinct from old.status or new.status not in ('achieved','failed') then
    return new;
  end if;
  select contract.team_id, contract.season_id, team_season.id as team_season_id,
    offer.sporting_director_id, country.name as country_name
  into v_context
  from public.secondary_sponsor_contracts contract
  join public.secondary_sponsor_offers offer on offer.id = contract.offer_id
  join public.team_seasons team_season on team_season.team_id = contract.team_id
    and team_season.season_id = contract.season_id
  left join public.countries country on country.id = new.target_country_id
  where contract.offer_id = new.offer_id and contract.status = 'active';
  if v_context is null then return new; end if;
  v_label := case when new.objective_kind = 'roster_nationality'
    then new.required_rider_count::text || ' coureur(s) - ' || v_context.country_name
    else new.race_label end;
  if new.status = 'achieved' then
    select greatest(1, least(28, coalesce(current_day_number, 1)))
      into v_day_number from public.seasons where id = v_context.season_id;
    select id into v_day_id from public.season_days
      where season_id = v_context.season_id and day_number = v_day_number;
    insert into public.team_finance_transactions (
      team_season_id, season_day_id, day_number, amount, category,
      status, description, source_reference, posted_at
    ) values (
      v_context.team_season_id, v_day_id, v_day_number, new.cash_reward, 'sponsor',
      'posted', 'Prime sponsor secondaire - ' || v_label,
      'secondary-sponsor-objective:' || new.id::text, now()
    ) on conflict (team_season_id, source_reference) do nothing returning id into v_transaction_id;
    if v_transaction_id is not null then
      update public.team_seasons set cash_balance = cash_balance + new.cash_reward
        where id = v_context.team_season_id;
    end if;
  elsif new.reputation_penalty > 0 and new.penalty_settled_at is null then
    perform private.apply_reputation_delta(
      v_context.sporting_director_id, v_context.season_id, -new.reputation_penalty,
      'secondary_sponsor_objective_failure', 'secondary-sponsor-objective-failure:' || new.id::text,
      'Échec d''objectif du sponsor secondaire - ' || v_label,
      jsonb_build_object('objectiveId',new.id,'penalty',new.reputation_penalty)
    );
    update public.secondary_sponsor_objectives set penalty_settled_at = now() where id = new.id;
  end if;
  return new;
end;
$$;
create trigger settle_secondary_sponsor_objective
  after update of status on public.secondary_sponsor_objectives
  for each row execute function private.settle_secondary_sponsor_objective();

create or replace function private.evaluate_secondary_sponsor_roster(p_team_id uuid, p_season_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_objective record; v_count integer;
begin
  if not exists (
    select 1 from public.secondary_sponsor_contracts contract
    join public.secondary_sponsor_objectives objective on objective.offer_id=contract.offer_id
    where contract.team_id=p_team_id and contract.season_id=p_season_id and contract.status='active'
      and objective.objective_kind='roster_nationality' and objective.status='active'
  ) then return; end if;
  -- Match the season-closing lock order before an achievement credits this balance.
  perform 1 from public.team_seasons where team_id=p_team_id and season_id=p_season_id for update;
  for v_objective in
    select objective.* from public.secondary_sponsor_contracts contract
    join public.secondary_sponsor_objectives objective on objective.offer_id = contract.offer_id
    where contract.team_id = p_team_id and contract.season_id = p_season_id
      and contract.status = 'active' and objective.objective_kind = 'roster_nationality'
      and objective.status = 'active'
    order by objective.id for update of objective
  loop
    if v_objective.target_country_id = private.secondary_sponsor_primary_country(p_team_id,p_season_id) then
      update public.secondary_sponsor_objectives set status = 'cancelled', settled_at = now()
        where id = v_objective.id;
      continue;
    end if;
    select country_count into v_count
      from private.secondary_sponsor_roster_counts(p_team_id,p_season_id,v_objective.target_country_id);
    update public.secondary_sponsor_objectives
      set current_rider_count = v_count,
        status = case when v_count >= required_rider_count then 'achieved' else 'active' end,
        settled_at = case when v_count >= required_rider_count then now() else settled_at end
      where id = v_objective.id
        and (current_rider_count is distinct from v_count or v_count >= required_rider_count);
  end loop;
end;
$$;

create or replace function private.evaluate_secondary_sponsor_objectives_after_race()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_objective record; v_best_rank integer;
begin
  if new.status not in ('completed','cancelled') or new.status is not distinct from old.status then return new; end if;
  for v_objective in
    select objective.*, team_season.id as team_season_id
    from public.secondary_sponsor_objectives objective
    join public.secondary_sponsor_contracts contract on contract.offer_id = objective.offer_id
    join public.team_seasons team_season on team_season.team_id = contract.team_id
      and team_season.season_id = contract.season_id
    where objective.race_edition_id = new.id and objective.objective_kind = 'race_result'
      and objective.status = 'active' and contract.status = 'active'
    order by objective.id for update of objective
  loop
    if new.status = 'cancelled' then
      update public.secondary_sponsor_objectives set status='cancelled',settled_at=now()
        where id=v_objective.id;
      continue;
    end if;
    select min(result.final_rank)::integer into v_best_rank
    from public.race_results result
    join public.race_rosters roster on roster.id=result.race_roster_id
    join public.race_registrations registration on registration.id=roster.race_registration_id
      and registration.race_edition_id=result.race_edition_id
    where result.race_edition_id=new.id and registration.team_season_id=v_objective.team_season_id
      and result.status='classified';
    update public.secondary_sponsor_objectives
      set status=case when v_best_rank <= target_rank then 'achieved' else 'failed' end,
        best_rank=v_best_rank, settled_at=now()
      where id=v_objective.id;
  end loop;
  return new;
end;
$$;

create or replace function private.apply_secondary_sponsor_team_season_transition()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_contract record;
begin
  if new.status = 'active' and old.status <> 'active' then
    select contract.id,contract.offer_id,sponsor.name into v_contract
    from public.secondary_sponsor_contracts contract
    join public.secondary_sponsor_catalog sponsor on sponsor.id=contract.secondary_sponsor_id
    where contract.team_id=new.team_id and contract.season_id=new.season_id and contract.status='planned'
    limit 1 for update of contract;
    if v_contract is not null then
      update public.secondary_sponsor_contracts set status='active',activated_at=coalesce(activated_at,now()) where id=v_contract.id;
      update public.secondary_sponsor_objectives set status='active' where offer_id=v_contract.offer_id and status='draft';
      update public.team_seasons
      set display_name=case when right(display_name,length(' - ' || v_contract.name))=' - ' || v_contract.name
          then display_name else display_name || ' - ' || v_contract.name end,
        short_name=case when right(display_name,length(' - ' || v_contract.name))=' - ' || v_contract.name
          then short_name else left(coalesce(short_name,display_name) || '-' || v_contract.name,30) end
      where id=new.id;
      perform private.evaluate_secondary_sponsor_roster(new.team_id,new.season_id);
    end if;
  elsif new.status='completed' and old.status<>'completed' then
    -- Give an achieved roster target its payment before expiring the remaining goals.
    perform private.evaluate_secondary_sponsor_roster(new.team_id,new.season_id);
    update public.secondary_sponsor_objectives objective
      set status='failed',settled_at=coalesce(objective.settled_at,now())
    from public.secondary_sponsor_contracts contract
    where contract.team_id=new.team_id and contract.season_id=new.season_id
      and contract.offer_id=objective.offer_id and contract.status='active'
      and objective.status in ('draft','active');
    update public.secondary_sponsor_contracts set status='completed',completed_at=coalesce(completed_at,now())
      where team_id=new.team_id and season_id=new.season_id and status='active';
  end if;
  return new;
end;
$$;

create or replace function private.secondary_sponsor_roster_changed(p_team_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_season_id uuid; v_total integer;
begin
  select id into v_season_id from public.seasons where status='active' limit 1;
  if v_season_id is null then return; end if;
  perform private.evaluate_secondary_sponsor_roster(p_team_id,v_season_id);
  if exists (
    select 1 from public.secondary_sponsor_offers offer
    join public.secondary_sponsor_objectives objective on objective.offer_id=offer.id
    where offer.team_id=p_team_id and offer.status='open' and offer.generation_version>=2
      and objective.objective_kind='roster_nationality'
  ) then
    select total_count into v_total from private.secondary_sponsor_roster_counts(p_team_id,v_season_id,null);
    update public.secondary_sponsor_offers offer set generation_version=1
    where offer.team_id=p_team_id and offer.status='open' and offer.generation_version>=2
      and exists(select 1 from public.secondary_sponsor_objectives objective where objective.offer_id=offer.id
        and objective.objective_kind='roster_nationality' and objective.required_rider_count > floor(v_total*0.10));
  end if;
end;
$$;
create or replace function private.secondary_sponsor_roster_contracts_inserted()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_team uuid;
begin
  for v_team in select distinct team_id from secondary_new_contracts where status='active' order by team_id loop
    perform private.secondary_sponsor_roster_changed(v_team);
  end loop;
  return null;
end;
$$;
create or replace function private.secondary_sponsor_roster_contracts_updated()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_team uuid;
begin
  for v_team in
    select distinct team_id from (
      select n.team_id from secondary_new_contracts n join secondary_old_contracts o using(id)
      where (n.team_id,n.status,n.start_season_id,n.end_season_id) is distinct from (o.team_id,o.status,o.start_season_id,o.end_season_id)
      union select o.team_id from secondary_new_contracts n join secondary_old_contracts o using(id)
      where (n.team_id,n.status,n.start_season_id,n.end_season_id) is distinct from (o.team_id,o.status,o.start_season_id,o.end_season_id)
    ) changed order by team_id
  loop perform private.secondary_sponsor_roster_changed(v_team); end loop;
  return null;
end;
$$;
create or replace function private.secondary_sponsor_roster_contracts_deleted()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_team uuid;
begin
  for v_team in select distinct team_id from secondary_old_contracts where status='active' order by team_id loop
    perform private.secondary_sponsor_roster_changed(v_team);
  end loop;
  return null;
end;
$$;
create trigger secondary_sponsor_roster_contracts_inserted after insert on public.rider_contracts
  referencing new table as secondary_new_contracts for each statement execute function private.secondary_sponsor_roster_contracts_inserted();
create trigger secondary_sponsor_roster_contracts_updated after update on public.rider_contracts
  referencing new table as secondary_new_contracts old table as secondary_old_contracts for each statement execute function private.secondary_sponsor_roster_contracts_updated();
create trigger secondary_sponsor_roster_contracts_deleted after delete on public.rider_contracts
  referencing old table as secondary_old_contracts for each statement execute function private.secondary_sponsor_roster_contracts_deleted();

create or replace function private.secondary_sponsor_rider_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_team uuid;
begin
  if (new.country_id,new.status) is not distinct from (old.country_id,old.status) then return new; end if;
  for v_team in select distinct team_id from public.rider_contracts where rider_id=new.id and status='active' loop
    perform private.secondary_sponsor_roster_changed(v_team);
  end loop;
  return new;
end;
$$;
create trigger secondary_sponsor_rider_changed after update of country_id,status on public.riders
  for each row execute function private.secondary_sponsor_rider_changed();

create or replace function private.secondary_sponsor_principal_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_team uuid;
begin
  if new.role <> 'principal' then return new; end if;
  v_team := new.team_id;
  update public.secondary_sponsor_offers offer set generation_version=1
  from public.seasons season where offer.team_id=v_team and offer.target_season_id=season.id
    and season.status='planned' and offer.status='open' and offer.generation_version>=2;
  update public.secondary_sponsor_objectives objective set status='cancelled',settled_at=now()
  from public.secondary_sponsor_contracts contract
  where contract.team_id=v_team and contract.status in ('planned','active')
    and contract.offer_id=objective.offer_id and objective.objective_kind='roster_nationality'
    and objective.status in ('draft','active')
    and objective.target_country_id=private.secondary_sponsor_primary_country(v_team,contract.season_id);
  return new;
end;
$$;
create trigger secondary_sponsor_principal_changed
  after insert or update of sponsor_id,start_season_id,end_season_id,status on public.team_sponsor_contracts
  for each row execute function private.secondary_sponsor_principal_changed();

-- Replace only unsigned offers, under the same director lock used by signing.
create or replace function public.replace_secondary_sponsor_offers(
  p_director_id uuid, p_team_id uuid, p_target_season_id uuid, p_offers jsonb,
  p_generation_version integer default 2
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_director public.sporting_directors%rowtype;
  v_active public.seasons%rowtype;
  v_target public.seasons%rowtype;
  v_offer jsonb; v_goal jsonb; v_offer_id uuid; v_sponsor_country uuid; v_primary_country uuid;
  v_total integer; v_order integer;
begin
  select * into v_director from public.sporting_directors where id=p_director_id for update;
  if v_director is null or v_director.status <> 'active' or v_director.reputation_points<1500 then
    raise exception 'Directeur Sportif non éligible au sponsor secondaire.';
  end if;
  if not exists(select 1 from public.team_manager_assignments where team_id=p_team_id
    and sporting_director_id=p_director_id and role='general_manager' and status='active') then
    raise exception 'Cette équipe ne dépend pas de ce Directeur Sportif.';
  end if;
  select * into v_active from public.seasons where status='active' limit 1;
  select * into v_target from public.seasons where id=p_target_season_id;
  if v_target is null or v_target.status<>'planned' or v_target.game_year<>v_active.game_year+1
    or v_target.game_year<4 or coalesce(v_active.current_day_number,0)<21 then
    raise exception 'La saison des propositions secondaires est indisponible.';
  end if;
  if exists(select 1 from public.secondary_sponsor_contracts where team_id=p_team_id and season_id=p_target_season_id)
    or exists(select 1 from public.secondary_sponsor_offers where sporting_director_id=p_director_id
      and team_id=p_team_id and target_season_id=p_target_season_id and status='accepted') then return false; end if;
  if (select count(*) from public.secondary_sponsor_offers where sporting_director_id=p_director_id
    and team_id=p_team_id and target_season_id=p_target_season_id and status='open' and generation_version>=2)=3 then return false; end if;
  if coalesce(p_generation_version,0)<>2 or p_offers is null or jsonb_typeof(p_offers)<>'array' or jsonb_array_length(p_offers)<>3 then
    raise exception 'Trois propositions secondaires de version 2 sont requises.';
  end if;
  if (select count(distinct value->>'secondary_sponsor_id') from jsonb_array_elements(p_offers))<>3 then
    raise exception 'Les propositions doivent présenter trois partenaires distincts.';
  end if;
  v_primary_country:=private.secondary_sponsor_primary_country(p_team_id,p_target_season_id);
  select total_count into v_total from private.secondary_sponsor_roster_counts(p_team_id,v_active.id,null);
  delete from public.secondary_sponsor_offers where sporting_director_id=p_director_id and team_id=p_team_id
    and target_season_id=p_target_season_id and status='open';
  for v_offer in select value from jsonb_array_elements(p_offers) loop
    select country_id into v_sponsor_country from public.secondary_sponsor_catalog where id=(v_offer->>'secondary_sponsor_id')::uuid;
    if v_sponsor_country is null or (v_offer->'objectives') is null or jsonb_typeof(v_offer->'objectives')<>'array'
      or jsonb_array_length(v_offer->'objectives') not between 3 and 6 then
      raise exception 'La proposition secondaire est incomplète.';
    end if;
    if (select count(*) from jsonb_array_elements(v_offer->'objectives') goal
      where goal->>'objective_kind'='roster_nationality')>1 then
      raise exception 'Un seul objectif de contingent est autorisé par partenaire.';
    end if;
    insert into public.secondary_sponsor_offers(sporting_director_id,team_id,target_season_id,secondary_sponsor_id,generation_version,principal_country_id)
      values(p_director_id,p_team_id,p_target_season_id,(v_offer->>'secondary_sponsor_id')::uuid,2,v_primary_country) returning id into v_offer_id;
    v_order:=0;
    for v_goal in select value from jsonb_array_elements(v_offer->'objectives') loop
      v_order:=v_order+1;
      if coalesce((v_goal->>'cash_reward')::numeric,0)<=0 or (v_goal->>'cash_reward')::numeric>5000000
        or coalesce((v_goal->>'reputation_penalty')::numeric,0) not between 0 and 1000 then
        raise exception 'La prime ou le risque secondaire est invalide.';
      end if;
      if coalesce(v_goal->>'objective_kind','race_result')='roster_nationality' then
        if (v_goal->>'target_country_id')::uuid is distinct from v_sponsor_country
          or v_primary_country is null or v_primary_country=v_sponsor_country
          or coalesce((v_goal->>'required_rider_count')::integer,0) not between 1 and floor(v_total*0.10)::integer then
          raise exception 'L’objectif de nationalité doit différer du sponsor principal et rester dans 10 %% de l’effectif professionnel.';
        end if;
        insert into public.secondary_sponsor_objectives(offer_id,display_order,objective_kind,target_country_id,required_rider_count,current_rider_count,cash_reward,reputation_penalty)
          values(v_offer_id,v_order,'roster_nationality',v_sponsor_country,(v_goal->>'required_rider_count')::smallint,
            (select country_count from private.secondary_sponsor_roster_counts(p_team_id,v_active.id,v_sponsor_country)),
            (v_goal->>'cash_reward')::numeric,coalesce((v_goal->>'reputation_penalty')::numeric,0));
      elsif coalesce(v_goal->>'objective_kind','race_result')='race_result' then
        if not exists(select 1 from public.race_editions where id=(v_goal->>'race_edition_id')::uuid
          and season_id=p_target_season_id and status<>'cancelled') then
          raise exception 'La course proposée ne correspond pas à la saison du contrat.';
        end if;
        insert into public.secondary_sponsor_objectives(offer_id,display_order,race_edition_id,race_slug,race_label,race_category_code,target_rank,cash_reward,reputation_penalty)
          values(v_offer_id,v_order,(v_goal->>'race_edition_id')::uuid,v_goal->>'race_slug',v_goal->>'race_label',
            v_goal->>'race_category_code',(v_goal->>'target_rank')::smallint,(v_goal->>'cash_reward')::numeric,
            coalesce((v_goal->>'reputation_penalty')::numeric,0));
      else raise exception 'Ce type d’objectif secondaire n’est pas pris en charge.';
      end if;
    end loop;
  end loop;
  return true;
end;
$$;
revoke all on function public.replace_secondary_sponsor_offers(uuid,uuid,uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.replace_secondary_sponsor_offers(uuid,uuid,uuid,jsonb,integer) to service_role;

create or replace function public.sign_secondary_sponsor_offer(p_offer_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_director public.sporting_directors%rowtype; v_offer public.secondary_sponsor_offers%rowtype;
  v_active public.seasons%rowtype; v_target public.seasons%rowtype; v_contract_id uuid;
  v_total integer; v_primary_country uuid; v_secondary_country uuid;
begin
  select * into v_director from public.sporting_directors where auth_user_id=auth.uid() and status='active' for update;
  if v_director is null then raise exception 'Directeur Sportif introuvable.'; end if;
  if v_director.reputation_points<1500 then raise exception 'Le sponsor secondaire se débloque à 1 500 points de réputation.'; end if;
  select * into v_active from public.seasons where status='active' limit 1;
  if v_active is null or coalesce(v_active.current_day_number,0)<21 then raise exception 'La négociation du sponsor secondaire ouvre au jour 21.'; end if;
  select * into v_offer from public.secondary_sponsor_offers where id=p_offer_id and sporting_director_id=v_director.id for update;
  if v_offer is null or v_offer.status<>'open' then raise exception 'Cette offre secondaire est indisponible.'; end if;
  if v_offer.generation_version<2 then raise exception 'Ces propositions ont été rééquilibrées. Actualisez la page avant de signer.'; end if;
  if not exists(select 1 from public.team_manager_assignments where team_id=v_offer.team_id and sporting_director_id=v_director.id and role='general_manager' and status='active') then
    raise exception 'Vous ne dirigez plus cette équipe.';
  end if;
  select * into v_target from public.seasons where id=v_offer.target_season_id;
  if v_target is null or v_target.status<>'planned' or v_target.game_year<>v_active.game_year+1 or v_target.game_year<4 then
    raise exception 'Le sponsor secondaire ne peut être signé que pour la saison 4 ou suivante.';
  end if;
  if exists(select 1 from public.secondary_sponsor_contracts where team_id=v_offer.team_id and season_id=v_offer.target_season_id) then
    raise exception 'Un sponsor secondaire est déjà signé pour cette saison.';
  end if;
  if not exists(select 1 from public.secondary_sponsor_objectives where offer_id=v_offer.id and status='draft') then
    raise exception 'Cette proposition ne contient aucun objectif.';
  end if;
  select country_id into v_secondary_country from public.secondary_sponsor_catalog where id=v_offer.secondary_sponsor_id;
  v_primary_country:=private.secondary_sponsor_primary_country(v_offer.team_id,v_target.id);
  select total_count into v_total from private.secondary_sponsor_roster_counts(v_offer.team_id,v_active.id,null);
  if exists(select 1 from public.secondary_sponsor_objectives where offer_id=v_offer.id and objective_kind='roster_nationality'
    and (target_country_id is distinct from v_secondary_country or v_primary_country is null
      or target_country_id=v_primary_country or required_rider_count>floor(v_total*0.10))) then
    raise exception 'Le contingent proposé n’est plus adapté à votre équipe. Actualisez les offres.';
  end if;
  insert into public.secondary_sponsor_contracts(offer_id,team_id,season_id,secondary_sponsor_id)
    values(v_offer.id,v_offer.team_id,v_target.id,v_offer.secondary_sponsor_id) returning id into v_contract_id;
  update public.secondary_sponsor_offers set status=case when id=v_offer.id then 'accepted' else 'withdrawn' end,
    accepted_at=case when id=v_offer.id then now() else accepted_at end
    where sporting_director_id=v_director.id and team_id=v_offer.team_id
      and target_season_id=v_target.id and status='open';
  return v_contract_id;
end;
$$;

create or replace function public.update_secondary_sponsor_logo(
  p_contract_id uuid,p_x_percent numeric,p_y_percent numeric,p_scale numeric,p_rotation_degrees numeric,p_color_mode text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_x_percent is null or p_y_percent is null or p_scale is null or p_rotation_degrees is null
    or p_x_percent not between 15 and 85 or p_y_percent not between 20 and 78
    or p_scale not between 0.5 and 1.8 or p_rotation_degrees not between -45 and 45
    or p_color_mode is null or p_color_mode not in ('original','black','white') then
    raise exception 'Le placement ou la couleur du logo est hors des limites autorisées.';
  end if;
  update public.secondary_sponsor_contracts contract set logo_x_percent=round(p_x_percent,2),logo_y_percent=round(p_y_percent,2),
    logo_scale=round(p_scale,2),logo_rotation_degrees=round(p_rotation_degrees,2),logo_color_mode=p_color_mode
  where contract.id=p_contract_id and contract.status in ('planned','active') and exists(
    select 1 from public.team_manager_assignments assignment join public.sporting_directors director on director.id=assignment.sporting_director_id
    where assignment.team_id=contract.team_id and assignment.role='general_manager' and assignment.status='active'
      and director.status='active' and director.auth_user_id=auth.uid());
  if not found then raise exception 'Ce placement ne peut plus être modifié.'; end if;
end;
$$;
create or replace function public.update_secondary_sponsor_logo(
  p_contract_id uuid,p_x_percent numeric,p_y_percent numeric,p_scale numeric,p_rotation_degrees numeric
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.update_secondary_sponsor_logo(p_contract_id,p_x_percent,p_y_percent,p_scale,p_rotation_degrees,
    (select logo_color_mode from public.secondary_sponsor_contracts where id=p_contract_id));
end;
$$;
revoke all on function public.update_secondary_sponsor_logo(uuid,numeric,numeric,numeric,numeric,text) from public,anon;
grant execute on function public.update_secondary_sponsor_logo(uuid,numeric,numeric,numeric,numeric,text) to authenticated;

revoke all on function private.secondary_sponsor_primary_country(uuid,uuid) from public,anon,authenticated;
revoke all on function private.secondary_sponsor_roster_counts(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function private.settle_secondary_sponsor_objective() from public,anon,authenticated;
revoke all on function private.evaluate_secondary_sponsor_roster(uuid,uuid) from public,anon,authenticated;
revoke all on function private.secondary_sponsor_roster_changed(uuid) from public,anon,authenticated;
revoke all on function private.secondary_sponsor_roster_contracts_inserted() from public,anon,authenticated;
revoke all on function private.secondary_sponsor_roster_contracts_updated() from public,anon,authenticated;
revoke all on function private.secondary_sponsor_roster_contracts_deleted() from public,anon,authenticated;
revoke all on function private.secondary_sponsor_rider_changed() from public,anon,authenticated;
revoke all on function private.secondary_sponsor_principal_changed() from public,anon,authenticated;

commit;
