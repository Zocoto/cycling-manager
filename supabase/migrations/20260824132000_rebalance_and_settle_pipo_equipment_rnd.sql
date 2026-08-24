begin;

-- Une recherche porte sur un seul équipement : sa durée de référence passe
-- à cinq jours, quel que soit le niveau du laboratoire. Le talent de rapidité
-- de l'ingénieur continue ensuite de retirer un jour par niveau, avec un jour
-- incompressible.
do $patch_rnd_duration$
declare
  v_signature regprocedure;
  v_definition text;
  v_patched_definition text;
begin
  v_signature :=
    'public.start_current_team_equipment_rnd(uuid,uuid)'::regprocedure;
  select pg_get_functiondef(v_signature)
  into v_definition;

  v_patched_definition := replace(
    v_definition,
    E'v_duration := greatest(\n    4,\n    (array[18, 16, 14, 12, 10, 9, 8]::integer[])[v_level] -\n      case when v_has_research_time then v_engineer_level else 0 end\n  );',
    E'v_duration := greatest(\n    1,\n    5 - case when v_has_research_time then v_engineer_level else 0 end\n  );'
  );

  if v_patched_definition = v_definition then
    raise exception 'La formule de durée R&D a changé : migration interrompue.';
  end if;

  execute v_patched_definition;
end;
$patch_rnd_duration$;

-- Les recherches déjà lancées bénéficient immédiatement de la nouvelle
-- durée, en conservant le talent de l'ingénieur choisi au démarrage.
update public.equipment_rnd_projects as project
set completes_game_day_index = project.starts_game_day_index + greatest(
      1,
      5 - coalesce((
        select member.level
        from public.staff_contracts as contract
        join public.staff_members as member
          on member.id = contract.staff_member_id
         and member.role = 'research_engineer'
        where contract.id = project.engineer_contract_id
          and exists (
            select 1
            from public.staff_member_talents as talent
            where talent.staff_member_id = member.id
              and talent.talent_code = 'research_time'
          )
      ), 0)
    )
where project.status = 'active';

do $settle_pipo_research$
declare
  v_target_count integer;
  v_team_id uuid;
  v_project_id uuid;
  v_current_game_day integer;
  v_result record;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('settle-pipo-inzaghi-equipment-rnd-2026-08-24', 0)
  );

  with target_teams as (
    select distinct assignment.team_id
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
    where (
        lower(btrim(director.display_name)) = 'pipo inzaghi'
        or lower(btrim(director.username)) = 'pipo inzaghi'
      )
      and (
        lower(btrim(team_season.display_name)) = 'tsubame precision'
        or exists (
          select 1
          from public.team_sponsor_contracts as contract
          join public.sponsors as sponsor
            on sponsor.id = contract.sponsor_id
          where contract.team_id = assignment.team_id
            and contract.role = 'principal'
            and contract.status = 'active'
            and lower(btrim(sponsor.name)) = 'tsubame precision'
        )
      )
  )
  select count(*)::integer
  into v_target_count
  from target_teams;

  if v_target_count = 0 then
    raise notice 'Pipo Inzaghi / Tsubame Precision absent : aucune recherche à finaliser.';
    return;
  end if;
  if v_target_count <> 1 then
    raise exception
      'Ciblage ambigu pour Pipo Inzaghi / Tsubame Precision : % équipes trouvées.',
      v_target_count;
  end if;

  select distinct assignment.team_id
  into v_team_id
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
  where (
      lower(btrim(director.display_name)) = 'pipo inzaghi'
      or lower(btrim(director.username)) = 'pipo inzaghi'
    )
    and (
      lower(btrim(team_season.display_name)) = 'tsubame precision'
      or exists (
        select 1
        from public.team_sponsor_contracts as contract
        join public.sponsors as sponsor
          on sponsor.id = contract.sponsor_id
        where contract.team_id = assignment.team_id
          and contract.role = 'principal'
          and contract.status = 'active'
          and lower(btrim(sponsor.name)) = 'tsubame precision'
      )
    );

  select project.id
  into v_project_id
  from public.equipment_rnd_projects as project
  where project.team_id = v_team_id
    and project.status = 'active'
  for update;

  if v_project_id is null then
    raise notice 'Aucune recherche R&D active trouvée pour Pipo Inzaghi.';
    return;
  end if;

  select season.game_year * 28 + season.current_day_number - 1
  into v_current_game_day
  from public.seasons as season
  where season.status = 'active'
  limit 1;

  update public.equipment_rnd_projects
  set starts_game_day_index = least(
        starts_game_day_index,
        v_current_game_day - 1
      ),
      completes_game_day_index = v_current_game_day
  where id = v_project_id;

  perform public.settle_due_equipment_rnd_projects();

  select
    project.status,
    project.outcome,
    project.rating_key,
    project.rating_delta,
    prototype.name as prototype_name
  into v_result
  from public.equipment_rnd_projects as project
  left join public.equipment_catalog_items as prototype
    on prototype.id = project.prototype_equipment_item_id
  where project.id = v_project_id;

  if v_result.status is distinct from 'completed'
    or v_result.outcome is null
    or v_result.rating_delta is null
    or v_result.prototype_name is null
  then
    raise exception 'La recherche R&D de Pipo Inzaghi n’a pas été finalisée correctement.';
  end if;

  raise notice
    'Recherche R&D de Pipo finalisée : % · % % sur %.',
    v_result.prototype_name,
    case when v_result.rating_delta > 0 then '+' else '' end,
    v_result.rating_delta,
    v_result.rating_key;
end;
$settle_pipo_research$;

notify pgrst, 'reload schema';

commit;
