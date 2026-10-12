begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Les anciens stages conservent leur coût historique. Seules les nouvelles
-- inscriptions sont gratuites ; aucun remboursement rétroactif n'est effectué.
alter table public.staff_academy_trainings
  drop constraint staff_academy_trainings_cost_positive;
alter table public.staff_academy_trainings
  add constraint staff_academy_trainings_cost_nonnegative check (cost >= 0);

create or replace function public.start_current_team_staff_academy_training(
  p_staff_contract_id uuid,
  p_improvement_type text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_member record;
  v_training_id uuid;
  v_academy_level integer;
  v_capacity integer;
  v_active_count integer;
  v_talent_count integer;
  v_available_talent_count integer;
  v_target_slot integer;
  v_duration integer;
  v_current_game_day integer;
  v_educator_bonuses jsonb;
  v_duration_reduction numeric(5, 1);
begin
  if p_improvement_type is null or p_improvement_type not in ('level', 'talent') then
    raise exception 'Le type de formation est invalide.';
  end if;

  perform public.settle_due_infrastructure_projects();
  perform public.settle_due_staff_academy_trainings();

  select
    assignment.team_id,
    season.id as season_id,
    season.game_year,
    season.current_day_number,
    team_season.id as team_season_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  -- Sérialise les inscriptions de l'équipe pour respecter la capacité.
  perform 1 from public.team_seasons
  where id = v_context.team_season_id for update;

  select coalesce(max(infrastructure.level), 0)
  into v_academy_level
  from public.team_infrastructures as infrastructure
  where infrastructure.team_id = v_context.team_id
    and infrastructure.infrastructure_code = 'staff_academy';

  if v_academy_level <= 0 then
    raise exception 'Construisez d’abord l’Académie des métiers.';
  end if;

  v_educator_bonuses :=
    public.get_team_staff_academy_educator_bonuses(v_context.team_id);
  if coalesce((v_educator_bonuses ->> 'activeEducatorCount')::integer, 0) <= 0 then
    raise exception 'Recrutez un formateur actif pour lancer un stage.';
  end if;

  v_duration_reduction := least(50, greatest(0,
    coalesce((v_educator_bonuses ->> 'durationReductionPercentage')::numeric, 0)
  ));
  v_capacity := v_academy_level + coalesce(
    (v_educator_bonuses ->> 'extraCapacity')::integer, 0
  );

  select count(*)::integer into v_active_count
  from public.staff_academy_trainings as training
  where training.team_id = v_context.team_id and training.status = 'active';
  if v_active_count >= v_capacity then
    raise exception 'Les % emplacement(s) de formation de l’Académie sont déjà occupés.', v_capacity;
  end if;

  select member.id, member.role, member.level, member.trainer_specialty
  into v_member
  from public.staff_contracts as contract
  join public.staff_members as member on member.id = contract.staff_member_id
  where contract.id = p_staff_contract_id
    and contract.team_id = v_context.team_id
    and contract.status = 'active'
  for update of member;
  if v_member is null then
    raise exception 'Ce membre du staff ne fait pas partie de votre équipe active.';
  end if;

  if exists (
    select 1 from public.staff_academy_trainings as training
    where training.staff_member_id = v_member.id and training.status = 'active'
  ) then
    raise exception 'Ce membre du staff suit déjà une formation.';
  end if;

  select count(*)::integer into v_talent_count
  from public.staff_member_talents as talent
  where talent.staff_member_id = v_member.id;

  if p_improvement_type = 'level' then
    if v_member.level >= 5 then
      raise exception 'Ce membre du staff a déjà atteint cinq étoiles.';
    end if;
    v_duration := least(20,
      5 + (v_member.level - 1) * 3 + greatest(0, v_talent_count - 1) * 2
    );
  else
    if v_talent_count >= 3 then
      raise exception 'Ce membre du staff possède déjà trois lignes de bonus.';
    end if;

    select count(*)::integer into v_available_talent_count
    from public.staff_talent_catalog as talent
    where talent.role = v_member.role
      and talent.is_active
      and talent.minimum_level <= v_member.level
      and not exists (
        select 1 from public.staff_member_talents as owned
        where owned.staff_member_id = v_member.id and owned.talent_code = talent.code
      )
      and not (
        v_member.role in ('trainer', 'youth_coach')
        and v_member.trainer_specialty is not null
        and talent.code = case v_member.role
            when 'trainer' then 'trainer_' else 'youth_coach_'
          end || v_member.trainer_specialty
      );
    if v_available_talent_count <= 0 then
      raise exception 'Aucune nouvelle ligne de bonus n’est disponible.';
    end if;

    select slot.slot_number into v_target_slot
    from generate_series(1, 3) as slot(slot_number)
    where not exists (
      select 1 from public.staff_member_talents as owned
      where owned.staff_member_id = v_member.id and owned.slot_number = slot.slot_number
    )
    order by slot.slot_number limit 1;

    v_duration := least(20, 6 + (v_member.level - 1) * 2 + v_talent_count * 3);
  end if;

  v_duration := greatest(1,
    ceil(v_duration * (1 - v_duration_reduction / 100.0))::integer
  );
  v_current_game_day := v_context.game_year * 28 + v_context.current_day_number - 1;

  -- Le trigger fédéral existant applique toujours sa réduction supplémentaire
  -- et recalcule la date de fin. Aucun mouvement financier n'est créé.
  insert into public.staff_academy_trainings (
    team_id, team_season_id, started_season_id,
    staff_contract_id, staff_member_id, improvement_type,
    previous_level, previous_talent_count, target_slot,
    cost, duration_days, started_day_number,
    starts_game_day_index, completes_game_day_index,
    educator_cost_reduction_percentage, educator_duration_reduction_percentage
  ) values (
    v_context.team_id, v_context.team_season_id, v_context.season_id,
    p_staff_contract_id, v_member.id, p_improvement_type,
    v_member.level, v_talent_count, v_target_slot,
    0, v_duration, v_context.current_day_number,
    v_current_game_day, v_current_game_day + v_duration,
    0, v_duration_reduction
  ) returning id into v_training_id;

  return v_training_id;
end;
$$;

revoke all on function public.start_current_team_staff_academy_training(uuid, text)
  from public, anon;
grant execute on function public.start_current_team_staff_academy_training(uuid, text)
  to authenticated, service_role;

comment on function public.start_current_team_staff_academy_training(uuid, text) is
  'Stage de staff gratuit, nécessitant une Académie et un formateur actif ; délais et capacité conservés.';

commit;
