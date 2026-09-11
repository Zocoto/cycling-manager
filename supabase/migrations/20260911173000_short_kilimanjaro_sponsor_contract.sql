begin;

-- Kilimanjaro SkyLink is intentionally released at the end of S3 so that
-- Sevrinovitch receives a fresh sponsor package for S4.
do $$
declare
  v_active_season_id uuid;
  v_contract_id uuid;
begin
  select season.id
    into v_active_season_id
  from public.seasons as season
  where season.status = 'active'
  order by season.game_year desc
  limit 1;

  if v_active_season_id is null then
    raise exception 'Impossible de raccourcir le contrat Kilimanjaro : aucune saison active.';
  end if;

  select contract.id
    into v_contract_id
  from public.team_sponsor_contracts as contract
  join public.team_manager_assignments as assignment
    on assignment.team_id = contract.team_id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id
  join public.team_seasons as team_season
    on team_season.team_id = contract.team_id
   and team_season.season_id = v_active_season_id
  where contract.role = 'principal'
    and contract.status = 'active'
    and lower(coalesce(director.username, director.display_name, '')) = 'sevrinovitch'
    and lower(coalesce(team_season.display_name, '')) like 'kilimanjaro sky%'
  order by contract.created_at desc
  limit 1
  for update of contract;

  if v_contract_id is null then
    raise exception 'Contrat actif de Kilimanjaro SkyLink pour Sevrinovitch introuvable.';
  end if;

  update public.team_sponsor_contracts
  set contract_duration_seasons = 1,
      end_season_id = v_active_season_id
  where id = v_contract_id;
end;
$$;

notify pgrst, 'reload schema';

commit;

