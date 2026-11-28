begin;
set local statement_timeout = '8s';
set local lock_timeout = '500ms';

-- The principal budget is a pricing reference, not a ceiling set at thirty percent.
-- Existing quotes and signed agreements retain every amount and objective ID.
alter table public.secondary_sponsor_offers
  drop constraint secondary_sponsor_offer_budget_snapshot_shape,
  add constraint secondary_sponsor_offer_budget_snapshot_shape check (
    (principal_budget_per_season is null and maximum_reward_budget is null)
    or (principal_budget_per_season is not null and principal_budget_per_season > 0
      and principal_budget_per_season <= 999999999999.99
      and maximum_reward_budget is not null and maximum_reward_budget > 0
      and maximum_reward_budget <= 999999999999.99)
  );
comment on column public.secondary_sponsor_offers.principal_budget_per_season is
  'Principal budget used as a reference when this offer was generated; not a payout ceiling.';
comment on column public.secondary_sponsor_offers.maximum_reward_budget is
  'For generation V4+, the exact sum of the rewards promised by this offer. Older snapshots retain their historical meaning.';

-- A subsequent principal-budget change must never reprice a promise or a
-- signed contract. The existing identity/nationality invalidation stays intact.
drop trigger secondary_sponsor_budget_changed on public.team_sponsor_contracts;

-- Keep all reviewed eligibility, ownership, roster, library and atomic
-- replacement rules. Only the completeness version changes from V3 to V4.
do $patch_completeness$
declare v_definition text; v_before text := 'offer.generation_version>=3';
begin
  v_definition := replace(pg_get_functiondef(
    'private.replace_secondary_sponsor_offers_uncapped(uuid,uuid,uuid,jsonb,integer)'::regprocedure),chr(13),'');
  if length(v_definition)-length(replace(v_definition,v_before,'')) <> length(v_before) then
    raise exception 'Unexpected secondary sponsor completeness version; no changes applied.';
  end if;
  execute replace(v_definition,v_before,'offer.generation_version>=4');
end;
$patch_completeness$;

-- The wrapper name remains compatible with the canonical-library delegation,
-- but raw server-generated rewards now pass through without any normalization.
create or replace function private.replace_secondary_sponsor_offers_budgeted(
  p_director_id uuid,p_team_id uuid,p_target_season_id uuid,p_offers jsonb,p_generation_version integer default 2
) returns boolean language plpgsql security definer set search_path='' as $$
declare v_budget numeric; v_changed boolean;
begin
  perform private.lock_secondary_sponsor_budget(p_team_id,p_target_season_id);
  v_budget := private.secondary_sponsor_primary_budget(p_team_id,p_target_season_id);
  if coalesce(v_budget,0) <= 0 then
    raise exception 'Choisissez un sponsor principal couvrant cette saison avant le sponsor secondaire.';
  end if;
  v_changed := private.replace_secondary_sponsor_offers_uncapped(
    p_director_id,p_team_id,p_target_season_id,p_offers,p_generation_version);
  if v_changed then
    update public.secondary_sponsor_offers offer
    set principal_budget_per_season = v_budget,
      maximum_reward_budget = (select sum(objective.cash_reward)
        from public.secondary_sponsor_objectives objective where objective.offer_id=offer.id)
    where offer.sporting_director_id=p_director_id and offer.team_id=p_team_id
      and offer.target_season_id=p_target_season_id and offer.status='open';
  end if;
  return v_changed;
end;
$$;

create or replace function public.replace_secondary_sponsor_offers(
  p_director_id uuid,p_team_id uuid,p_target_season_id uuid,p_offers jsonb,p_generation_version integer default 4
) returns boolean language plpgsql security definer set search_path='' as $$
declare v_changed boolean;
begin
  if coalesce(p_generation_version,0) <> 4 or p_offers is null or jsonb_typeof(p_offers)<>'array'
    or jsonb_array_length(p_offers)<>3 then
    raise exception 'Les dotations secondaires ont été rééquilibrées. Actualisez les offres.';
  end if;
  if (select count(distinct sponsor.source_sponsor_id)
    from jsonb_array_elements(p_offers) proposal
    join public.secondary_sponsor_catalog sponsor on sponsor.id=(proposal->>'secondary_sponsor_id')::uuid
    join public.sponsors source on source.id=sponsor.source_sponsor_id
    where sponsor.available_for_offers and source.status='active' and sponsor.country_id=source.country_id
      and source.id is distinct from private.secondary_sponsor_primary_source(p_team_id,p_target_season_id))<>3 then
    raise exception 'Les propositions doivent présenter trois marques distinctes de la bibliothèque, différentes du sponsor principal.';
  end if;
  if exists(select 1 from jsonb_array_elements(p_offers) proposal
    where jsonb_typeof(proposal->'objectives') is distinct from 'array') then
    raise exception 'La proposition secondaire est incomplète.';
  end if;
  if (select count(distinct total) from (
    select (select sum(round((goal->>'cash_reward')::numeric,2))
      from jsonb_array_elements(proposal->'objectives') goal) total
    from jsonb_array_elements(p_offers) proposal
  ) totals) <> 3 then
    raise exception 'Les trois propositions secondaires doivent présenter des dotations différentes.';
  end if;
  v_changed := private.replace_secondary_sponsor_offers_budgeted(
    p_director_id,p_team_id,p_target_season_id,p_offers,2);
  if v_changed then
    update public.secondary_sponsor_offers set generation_version=4
    where sporting_director_id=p_director_id and team_id=p_team_id and target_season_id=p_target_season_id
      and status='open' and generation_version<>4;
  end if;
  return v_changed;
end;
$$;

create or replace function private.sign_secondary_sponsor_offer_budgeted(p_offer_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_offer public.secondary_sponsor_offers%rowtype; v_director_id uuid; v_budget numeric;
begin
  -- Authorize before inspecting or locking another player's proposal.
  select offer.* into v_offer from public.secondary_sponsor_offers offer
  join public.sporting_directors director on director.id=offer.sporting_director_id
  join public.team_manager_assignments assignment on assignment.team_id=offer.team_id
    and assignment.sporting_director_id=director.id and assignment.role='general_manager' and assignment.status='active'
  where offer.id=p_offer_id and offer.status='open' and director.auth_user_id=auth.uid() and director.status='active';
  if v_offer is null then raise exception 'Cette offre secondaire est indisponible.'; end if;
  perform private.lock_secondary_sponsor_budget(v_offer.team_id,v_offer.target_season_id);
  select id into v_director_id from public.sporting_directors where id=v_offer.sporting_director_id for update;
  v_budget := private.secondary_sponsor_primary_budget(v_offer.team_id,v_offer.target_season_id);
  if coalesce(v_budget,0) <= 0 then
    raise exception 'Choisissez un sponsor principal couvrant cette saison avant le sponsor secondaire.';
  end if;
  return private.sign_secondary_sponsor_offer_uncapped(p_offer_id);
end;
$$;

create or replace function public.sign_secondary_sponsor_offer(p_offer_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.secondary_sponsor_offers offer
    join public.sporting_directors director on director.id=offer.sporting_director_id
    join public.secondary_sponsor_catalog sponsor on sponsor.id=offer.secondary_sponsor_id
    join public.sponsors source on source.id=sponsor.source_sponsor_id
    where offer.id=p_offer_id and offer.status='open' and offer.generation_version>=4
      and director.auth_user_id=auth.uid() and director.status='active'
      and sponsor.available_for_offers and source.status='active'
      and source.id is distinct from private.secondary_sponsor_primary_source(offer.team_id,offer.target_season_id)) then
    raise exception 'Les dotations secondaires ont été rééquilibrées. Actualisez les offres.';
  end if;
  return private.sign_secondary_sponsor_offer_budgeted(p_offer_id);
end;
$$;

-- Historical cap helpers remain private and uncallable by API roles. Neither
-- generation, signing nor principal changes delegates to them any longer.
revoke all on function private.replace_secondary_sponsor_offers_budgeted(uuid,uuid,uuid,jsonb,integer),
  private.replace_secondary_sponsor_offers_uncapped(uuid,uuid,uuid,jsonb,integer),
  private.sign_secondary_sponsor_offer_budgeted(uuid),private.sign_secondary_sponsor_offer_uncapped(uuid),
  private.apply_secondary_sponsor_budget_cap(uuid,boolean),private.normalize_secondary_sponsor_budget(jsonb,numeric),
  private.secondary_sponsor_primary_budget_changed() from public,anon,authenticated,service_role;
revoke all on function public.replace_secondary_sponsor_offers(uuid,uuid,uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.replace_secondary_sponsor_offers(uuid,uuid,uuid,jsonb,integer) to service_role;
revoke all on function public.sign_secondary_sponsor_offer(uuid) from public,anon;
grant execute on function public.sign_secondary_sponsor_offer(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
