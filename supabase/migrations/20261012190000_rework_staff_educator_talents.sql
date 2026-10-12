begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Codes conservés : conversion des affixes existants sans retirer de talent,
-- modifier d'étoiles ni recalculer les dates des stages déjà lancés.
update public.staff_talent_catalog set display_name = 'Orientation professionnelle'
where code = 'educator_training_cost';
update public.staff_talent_catalog set display_name = 'Mentorat ciblé'
where code = 'educator_training_effectiveness';

alter table public.staff_academy_trainings
  add column educator_mentorship_reduction_days smallint not null default 0
    check (educator_mentorship_reduction_days between 0 and 3),
  add column educator_talent_choice_count smallint not null default 1
    check (educator_talent_choice_count between 1 and 3),
  add column talent_choice_codes text[] not null default '{}'
    check (cardinality(talent_choice_codes) between 0 and 3
      and (cardinality(talent_choice_codes) = 0 or improvement_type = 'talent'));

create or replace function public.get_team_staff_academy_educator_bonuses(p_team_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with contributions as (
    select contract.id, member.level, talent.talent_code,
      public.get_staff_contract_nationality_multiplier(contract.id)
        * public.get_staff_contract_federal_institute_multiplier(contract.id) as multiplier
    from public.staff_contracts contract
    join public.staff_members member on member.id = contract.staff_member_id and member.role = 'educator'
    left join public.staff_member_talents talent on talent.staff_member_id = member.id
    where contract.team_id = p_team_id and contract.status = 'active'
  )
  select jsonb_build_object(
    'activeEducatorCount', count(distinct id),
    'costReductionPercentage', 0,
    'durationReductionPercentage', least(50::numeric, round(coalesce(max(
      case when talent_code = 'educator_training_time' then level * 3 * multiplier else 0 end
    ), 0), 1)),
    'mentorshipReductionDays', coalesce(max(
      case when talent_code = 'educator_training_effectiveness' then ceil(level / 2.0)::integer else 0 end
    ), 0),
    'talentChoiceCount', coalesce(max(
      case when talent_code = 'educator_training_cost' then case when level >= 4 then 3 else 2 end else 1 end
    ), 1),
    'extraCapacity', case when coalesce(bool_or(
      talent_code = 'educator_parallel_training' and level >= 3
    ), false) then 1 else 0 end
  ) from contributions;
$$;

-- Une seule définition de l'éligibilité, partagée par le tirage et le choix.
create function public.get_staff_academy_available_talents(p_staff_member_id uuid)
returns table(code text) language sql stable security definer set search_path = public as $$
  select talent.code
  from public.staff_members member
  join public.staff_talent_catalog talent on talent.role = member.role
    and talent.is_active and talent.minimum_level <= member.level
  where member.id = p_staff_member_id
    and not exists (
      select 1 from public.staff_member_talents owned
      where owned.staff_member_id = member.id and owned.talent_code = talent.code
    )
    and (talent.code not in ('architect_parallel_construction', 'educator_parallel_training') or member.level >= 3)
    and not (
      member.role in ('trainer', 'youth_coach') and member.trainer_specialty is not null
      and talent.code = case member.role when 'trainer' then 'trainer_' else 'youth_coach_' end
        || member.trainer_specialty
    );
$$;
revoke all on function public.get_staff_academy_available_talents(uuid) from public, anon, authenticated;
grant execute on function public.get_staff_academy_available_talents(uuid) to service_role;

-- Patch borné de la fonction gratuite existante, sans restaurer ses anciens
-- débits ni écraser les autres contrôles (capacité, contrat, métier, niveau).
do $patch$
declare
  v_source text := replace(pg_get_functiondef('public.start_current_team_staff_academy_training(uuid,text)'::regprocedure), E'\r\n', E'\n');
  v_old text;
  v_new text;
  v_pair text[];
begin
  foreach v_pair slice 1 in array array[
    array[E'  v_duration integer;', E'  v_duration integer;\n  v_percentage_duration integer;\n  v_mentorship_days integer := 0;\n  v_choice_count integer := 1;'],
    array[E'  v_capacity := v_academy_level + coalesce(', E'  v_mentorship_days := case when p_improvement_type = ''level'' then\n    least(3, greatest(0, coalesce((v_educator_bonuses ->> ''mentorshipReductionDays'')::integer, 0))) else 0 end;\n  v_choice_count := case when p_improvement_type = ''talent'' then\n    least(3, greatest(1, coalesce((v_educator_bonuses ->> ''talentChoiceCount'')::integer, 1))) else 1 end;\n  v_capacity := v_academy_level + coalesce('],
    array[E'where training.team_id = v_context.team_id and training.status = ''active'';', E'where training.team_id = v_context.team_id and training.status = ''active''\n    and cardinality(training.talent_choice_codes) = 0;'],
    array[E'  v_duration := greatest(1,\n    ceil(v_duration * (1 - v_duration_reduction / 100.0))::integer\n  );', E'  v_percentage_duration := ceil(v_duration * (1 - v_duration_reduction / 100.0))::integer;\n  v_duration := greatest(1, ceil(v_duration / 2.0)::integer, v_percentage_duration - v_mentorship_days);\n  v_mentorship_days := v_percentage_duration - v_duration;'],
    array[E'    educator_cost_reduction_percentage, educator_duration_reduction_percentage\n', E'    educator_cost_reduction_percentage, educator_duration_reduction_percentage,\n    educator_mentorship_reduction_days, educator_talent_choice_count\n'],
    array[E'    0, v_duration_reduction\n', E'    0, v_duration_reduction, v_mentorship_days, v_choice_count\n']
  ] loop
    v_old := v_pair[1]; v_new := v_pair[2];
    if (length(v_source) - length(replace(v_source, v_old, ''))) / length(v_old) <> 1 then
      raise exception 'Unexpected staff academy function shape: %', left(v_old, 100);
    end if;
    v_source := replace(v_source, v_old, v_new);
  end loop;
  execute v_source;
end;
$patch$;

create or replace function public.settle_due_staff_academy_trainings()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_current_game_day integer;
  v_training record;
  v_member record;
  v_codes text[];
  v_talent_code text;
  v_processed integer := 0;
begin
  perform public.sync_active_season_day();
  select game_year * 28 + current_day_number - 1 into v_current_game_day
  from public.seasons where status = 'active' limit 1;
  if v_current_game_day is null then return 0; end if;

  for v_training in
    select training.* from public.staff_academy_trainings training
    where training.status = 'active' and cardinality(training.talent_choice_codes) = 0
      and training.completes_game_day_index <= v_current_game_day
    order by training.completes_game_day_index, training.created_at
    for update skip locked
  loop
    select * into v_member from public.staff_members where id = v_training.staff_member_id for update;
    if v_member is null then raise exception 'Le membre du staff à former est introuvable.'; end if;

    v_talent_code := null;
    if v_training.improvement_type = 'level' then
      if v_member.level >= 5 then raise exception 'Ce membre du staff a déjà atteint cinq étoiles.'; end if;
      update public.staff_members set level = level + 1 where id = v_member.id;
    else
      select array_agg(candidate.code) into v_codes from (
        select available.code from public.get_staff_academy_available_talents(v_member.id) available
        order by random() limit v_training.educator_talent_choice_count
      ) candidate;
      if coalesce(cardinality(v_codes), 0) = 0 then
        raise exception 'Aucun nouveau talent compatible n’est disponible.';
      end if;
      if cardinality(v_codes) > 1 then
        -- Le tirage est figé une seule fois. Le stage ne consomme plus de place,
        -- mais son membre reste réservé jusqu'au choix (index actif existant).
        update public.staff_academy_trainings
        set talent_choice_codes = v_codes, updated_at = now() where id = v_training.id;
        v_processed := v_processed + 1;
        continue;
      end if;
      v_talent_code := v_codes[1];
      insert into public.staff_member_talents(staff_member_id, slot_number, talent_code, unlocked_by)
      values(v_member.id, v_training.target_slot, v_talent_code, 'professions_building');
    end if;

    update public.staff_academy_trainings
    set status = 'completed', awarded_talent_code = v_talent_code,
      completed_at = now(), updated_at = now() where id = v_training.id;
    v_processed := v_processed + 1;
  end loop;
  return v_processed;
end;
$$;

create function public.choose_current_team_staff_academy_talent(p_training_id uuid, p_talent_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_training record;
  v_member record;
begin
  select training.* into v_training from public.staff_academy_trainings training
  where training.id = p_training_id and exists (
    select 1 from public.sporting_directors director
    join public.team_manager_assignments assignment on assignment.sporting_director_id = director.id
      and assignment.status = 'active' and assignment.role = 'general_manager'
    where director.auth_user_id = auth.uid() and director.status = 'active'
      and assignment.team_id = training.team_id
  ) for update;
  if v_training is null then raise exception 'Ce stage ne fait pas partie de votre équipe.'; end if;
  if v_training.status = 'completed' and v_training.awarded_talent_code = p_talent_code then
    return v_training.id;
  end if;
  if v_training.status <> 'active' or cardinality(v_training.talent_choice_codes) < 2 then
    raise exception 'Aucun choix de talent n’est attendu pour ce stage.';
  end if;
  if p_talent_code is null or not (p_talent_code = any(v_training.talent_choice_codes)) then
    raise exception 'Choisissez un talent parmi les propositions du stage.';
  end if;
  if not exists (
    select 1 from public.staff_contracts contract
    where contract.id = v_training.staff_contract_id and contract.team_id = v_training.team_id
      and contract.staff_member_id = v_training.staff_member_id and contract.status = 'active'
  ) then raise exception 'Ce membre du staff ne fait plus partie de votre équipe active.'; end if;

  select * into v_member from public.staff_members where id = v_training.staff_member_id for update;
  if not exists (
    select 1 from public.get_staff_academy_available_talents(v_member.id) available where available.code = p_talent_code
  ) then raise exception 'Ce talent n’est plus compatible avec ce membre du staff.'; end if;
  insert into public.staff_member_talents(staff_member_id, slot_number, talent_code, unlocked_by)
  values(v_member.id, v_training.target_slot, p_talent_code, 'professions_building');
  update public.staff_academy_trainings
  set status = 'completed', awarded_talent_code = p_talent_code, completed_at = now(), updated_at = now()
  where id = v_training.id;
  return v_training.id;
end;
$$;
revoke all on function public.choose_current_team_staff_academy_talent(uuid,text) from public, anon;
grant execute on function public.choose_current_team_staff_academy_talent(uuid,text) to authenticated, service_role;

create function private.notify_staff_academy_talent_choice()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_staff_name text;
begin
  if new.status <> 'active' or cardinality(old.talent_choice_codes) > 0
    or cardinality(new.talent_choice_codes) < 2 then return new; end if;
  select first_name || ' ' || last_name into v_staff_name
  from public.staff_members where id = new.staff_member_id;
  perform private.create_team_operational_message(
    new.team_id, 'academy', 'Académie des métiers', 'Un talent de staff à choisir',
    coalesce(v_staff_name, 'Un membre du staff') || ' a terminé son stage : choisissez son nouveau talent.',
    'Orientation professionnelle vous permet de choisir le nouveau talent de ' ||
      coalesce(v_staff_name, 'votre membre du staff') || ' parmi les propositions de l’Académie. La place de formation est libérée.',
    '/jeu/staff?onglet=formations', 'Choisir le talent',
    'dashboard-staff-training-choice:' || new.id::text, false, now()
  );
  return new;
end;
$$;
revoke all on function private.notify_staff_academy_talent_choice() from public, anon, authenticated;
create trigger notify_staff_academy_talent_choice
after update of talent_choice_codes on public.staff_academy_trainings
for each row execute function private.notify_staff_academy_talent_choice();

commit;
