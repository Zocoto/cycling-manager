begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- ============================================================
-- RESPONSABLE DE FORMATION — MÉTIER ET AFFIXES
-- ============================================================

alter table public.staff_members
  drop constraint if exists staff_members_role_allowed;
alter table public.staff_members
  add constraint staff_members_role_allowed check (role in (
    'trainer', 'youth_coach', 'scout', 'doctor', 'mechanic',
    'community_manager', 'nutritionist', 'physiotherapist',
    'race_preparer', 'architect', 'research_engineer', 'educator'
  ));

alter table public.staff_members
  drop constraint if exists staff_members_trainer_specialty_shape;
alter table public.staff_members
  add constraint staff_members_trainer_specialty_shape check (
    (
      role in ('trainer', 'youth_coach')
      and trainer_specialty is not null
    )
    or (
      role not in ('trainer', 'youth_coach')
      and trainer_specialty is null
    )
  );

alter table public.staff_talent_catalog
  drop constraint if exists staff_talent_catalog_role_allowed;
alter table public.staff_talent_catalog
  add constraint staff_talent_catalog_role_allowed check (role in (
    'trainer', 'youth_coach', 'scout', 'doctor', 'mechanic',
    'community_manager', 'nutritionist', 'physiotherapist',
    'race_preparer', 'architect', 'research_engineer', 'educator'
  ));

alter table public.recruitment_alerts
  drop constraint if exists recruitment_alerts_staff_role_allowed;
alter table public.recruitment_alerts
  add constraint recruitment_alerts_staff_role_allowed check (
    staff_role is null
    or staff_role in (
      'trainer', 'youth_coach', 'scout', 'doctor', 'mechanic',
      'nutritionist', 'physiotherapist', 'race_preparer', 'architect',
      'community_manager', 'research_engineer', 'educator'
    )
  );

insert into public.staff_talent_catalog (
  code,
  role,
  display_name,
  minimum_level
)
values
  ('youth_coach_mountain', 'youth_coach', 'Domaine montagne', 1),
  ('youth_coach_hills', 'youth_coach', 'Domaine vallons', 1),
  ('youth_coach_flat', 'youth_coach', 'Domaine plaine', 1),
  ('youth_coach_sprint', 'youth_coach', 'Domaine sprint', 1),
  (
    'youth_coach_time_trial',
    'youth_coach',
    'Domaine chrono et prologue',
    1
  ),
  ('youth_coach_cobbles', 'youth_coach', 'Domaine pavés', 1),
  (
    'youth_coach_endurance',
    'youth_coach',
    'Domaine endurance et récupération',
    1
  )
on conflict (code) do update
set
  role = excluded.role,
  display_name = excluded.display_name,
  minimum_level = excluded.minimum_level,
  is_active = true;

create or replace function public.calculate_staff_salary(
  p_role text,
  p_level integer
)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  v_base numeric;
  v_multiplier numeric;
  v_level integer := least(5, greatest(1, coalesce(p_level, 1)));
begin
  v_base := case p_role
    when 'trainer' then 22000
    when 'youth_coach' then 20000
    when 'scout' then 19000
    when 'doctor' then 17000
    when 'mechanic' then 14000
    when 'nutritionist' then 13000
    when 'physiotherapist' then 13000
    when 'race_preparer' then 15000
    when 'architect' then 12000
    when 'community_manager' then 11000
    when 'research_engineer' then 24000
    when 'educator' then 18000
    else null
  end;
  if v_base is null then
    raise exception 'Métier de staff invalide.';
  end if;
  v_multiplier := (
    array[1.00, 1.50, 2.20, 3.30, 5.00]::numeric[]
  )[v_level];
  return round((v_base * v_multiplier) / 500) * 500;
end;
$$;

-- Les deux producteurs de marché conservent leur atomicité historique. Seules
-- la liste de métiers et la forme de la spécialité sont étendues.
do $patch_market_functions$
declare
  v_signature regprocedure;
  v_definition text;
  v_patched_definition text;
begin
  foreach v_signature in array array[
    'public.create_daily_staff_market(date,jsonb)'::regprocedure,
    'public.append_staff_market_wave(date,integer,jsonb)'::regprocedure
  ]
  loop
    select pg_catalog.pg_get_functiondef(v_signature)
    into v_definition;
    v_definition := replace(v_definition, E'\r\n', E'\n');

    v_patched_definition := replace(
      v_definition,
      '''research_engineer'', ''educator''',
      '''research_engineer'', ''educator'', ''youth_coach'''
    );
    v_patched_definition := replace(
      v_patched_definition,
      'v_role = ''trainer''',
      'v_role in (''trainer'', ''youth_coach'')'
    );
    v_patched_definition := replace(
      v_patched_definition,
      'v_role <> ''trainer''',
      'v_role not in (''trainer'', ''youth_coach'')'
    );

    if v_patched_definition = v_definition
      or position('''youth_coach''' in v_patched_definition) = 0
      or position(
        'v_role in (''trainer'', ''youth_coach'')'
        in v_patched_definition
      ) = 0
    then
      raise exception
        'Impossible d étendre le producteur de marché % au responsable de formation.',
        v_signature::text;
    end if;

    execute v_patched_definition;
  end loop;
end;
$patch_market_functions$;

-- Le recrutement sur mesure utilise le même domaine principal et les mêmes
-- contrôles de talent que le recrutement standard.
do $patch_custom_recruitment$
declare
  v_definition text;
  v_patched_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.redeem_custom_staff_recruitment_reward(uuid,uuid,uuid,text,text,text,integer,text,text,text)'::regprocedure
  ) into v_definition;
  v_definition := replace(v_definition, E'\r\n', E'\n');

  v_patched_definition := replace(
    v_definition,
    '''research_engineer'', ''educator''',
    '''research_engineer'', ''educator'', ''youth_coach'''
  );
  v_patched_definition := replace(
    v_patched_definition,
    'p_role = ''trainer''',
    'p_role in (''trainer'', ''youth_coach'')'
  );
  v_patched_definition := replace(
    v_patched_definition,
    'p_role <> ''trainer''',
    'p_role not in (''trainer'', ''youth_coach'')'
  );
  v_patched_definition := replace(
    v_patched_definition,
    'p_talent_code = ''trainer_'' || p_trainer_specialty',
    E'p_talent_code = (case p_role\n      when ''trainer'' then ''trainer_''\n      else ''youth_coach_''\n    end) || p_trainer_specialty'
  );
  v_patched_definition := replace(
    v_patched_definition,
    'Le talent généré doit compléter la spécialité principale de l’entraîneur.',
    'Le talent généré doit compléter la spécialité principale.'
  );
  v_patched_definition := replace(
    v_patched_definition,
    E'    when ''educator'' then ''Formateur''\n    else ''Staff''',
    E'    when ''educator'' then ''Formateur''\n    when ''youth_coach'' then ''Responsable de formation''\n    else ''Staff'''
  );

  if v_patched_definition = v_definition
    or position('''youth_coach''' in v_patched_definition) = 0
    or position(
      'p_role in (''trainer'', ''youth_coach'')'
      in v_patched_definition
    ) = 0
    or position('Responsable de formation' in v_patched_definition) = 0
  then
    raise exception
      'Le Mandat de recrutement ne peut pas être étendu en sécurité.';
  end if;

  execute v_patched_definition;
end;
$patch_custom_recruitment$;

-- ============================================================
-- LIMITE STRICTE : UN RESPONSABLE ACTIF PAR ÉQUIPE
-- ============================================================

create or replace function public.enforce_team_youth_coach_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_role text;
begin
  if new.status <> 'active' then
    return new;
  end if;

  select member.role
  into v_role
  from public.staff_members as member
  where member.id = new.staff_member_id;

  if v_role <> 'youth_coach' then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'team-youth-coach:' || new.team_id::text,
      0
    )
  );

  if exists (
    select 1
    from public.staff_contracts as contract
    join public.staff_members as member
      on member.id = contract.staff_member_id
     and member.role = 'youth_coach'
    where contract.team_id = new.team_id
      and contract.status = 'active'
      and contract.id <> new.id
  ) then
    raise exception
      'Une équipe ne peut employer qu’un seul responsable de formation actif.';
  end if;

  return new;
end;
$$;

drop trigger if exists staff_contracts_youth_coach_limit
on public.staff_contracts;
create trigger staff_contracts_youth_coach_limit
before insert or update of team_id, staff_member_id, status
on public.staff_contracts
for each row execute function public.enforce_team_youth_coach_limit();

-- ============================================================
-- PROGRESSION JUNIOR PLAFONNÉE ET NON CUMULABLE
-- Principal : +2 %/niveau ; affixe : +1 %/niveau ; même nation : +5 %.
-- ============================================================

create or replace function public.get_youth_coach_training_multiplier(
  p_team_id uuid,
  p_rider_country_id uuid,
  p_stat_code text
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select
      1
      + case
          when (
            (member.trainer_specialty = 'mountain' and p_stat_code = 'mountain')
            or (member.trainer_specialty = 'hills' and p_stat_code = 'hills')
            or (member.trainer_specialty = 'flat' and p_stat_code = 'flat')
            or (
              member.trainer_specialty = 'sprint'
              and p_stat_code = any(array['sprint', 'acceleration'])
            )
            or (
              member.trainer_specialty = 'time_trial'
              and p_stat_code = any(array['timeTrial', 'time_trial', 'prologue'])
            )
            or (
              member.trainer_specialty = 'cobbles'
              and p_stat_code = 'cobbles'
            )
            or (
              member.trainer_specialty = 'endurance'
              and p_stat_code = any(array[
                'endurance', 'resistance', 'recovery', 'breakaway', 'downhill'
              ])
            )
          ) then member.level * 0.02
          else 0
        end
      + case when exists (
          select 1
          from public.staff_member_talents as talent
          where talent.staff_member_id = member.id
            and (
              (talent.talent_code = 'youth_coach_mountain' and p_stat_code = 'mountain')
              or (talent.talent_code = 'youth_coach_hills' and p_stat_code = 'hills')
              or (talent.talent_code = 'youth_coach_flat' and p_stat_code = 'flat')
              or (
                talent.talent_code = 'youth_coach_sprint'
                and p_stat_code = any(array['sprint', 'acceleration'])
              )
              or (
                talent.talent_code = 'youth_coach_time_trial'
                and p_stat_code = any(array['timeTrial', 'time_trial', 'prologue'])
              )
              or (
                talent.talent_code = 'youth_coach_cobbles'
                and p_stat_code = 'cobbles'
              )
              or (
                talent.talent_code = 'youth_coach_endurance'
                and p_stat_code = any(array[
                  'endurance', 'resistance', 'recovery', 'breakaway', 'downhill'
                ])
              )
            )
        ) then member.level * 0.01
        else 0
      end
      + case
          when member.country_id = p_rider_country_id then 0.05
          else 0
        end
    from public.staff_contracts as contract
    join public.staff_members as member
      on member.id = contract.staff_member_id
     and member.role = 'youth_coach'
    where contract.team_id = p_team_id
      and contract.status = 'active'
    limit 1
  ), 1)::numeric;
$$;

do $patch_manual_youth_training$
declare
  v_definition text;
  v_patched_definition text;
  v_context_marker constant text :=
    E'    academy.training_mode,\n    academy.scout_training_bonus_percentage,\n    academy.potential_steps,';
  v_context_replacement constant text :=
    E'    academy.training_mode,\n    academy.team_id,\n    academy.country_id,\n    academy.scout_training_bonus_percentage,\n    academy.potential_steps,';
  v_gain_marker constant text :=
    E'    ) * public.get_youth_school_training_multiplier(\n      v_context.scout_training_bonus_percentage\n    );';
  v_gain_replacement constant text :=
    E'    ) * public.get_youth_school_training_multiplier(\n      v_context.scout_training_bonus_percentage\n    ) * public.get_youth_coach_training_multiplier(\n      v_context.team_id,\n      v_context.country_id,\n      v_stat.rating_key\n    );';
begin
  select pg_catalog.pg_get_functiondef(
    'public.complete_current_youth_training_attempt(uuid,integer)'::regprocedure
  ) into v_definition;
  v_definition := replace(v_definition, E'\r\n', E'\n');

  if position('get_youth_coach_training_multiplier' in v_definition) > 0 then
    return;
  end if;

  if position(v_context_marker in v_definition) = 0
    or position(v_gain_marker in v_definition) = 0
  then
    raise exception
      'Le responsable de formation ne peut pas être raccordé à l entraînement manuel en sécurité.';
  end if;

  v_patched_definition := replace(
    replace(v_definition, v_context_marker, v_context_replacement),
    v_gain_marker,
    v_gain_replacement
  );

  if v_patched_definition = v_definition then
    raise exception 'La fonction d entraînement junior n a pas été modifiée.';
  end if;

  execute v_patched_definition;
end;
$patch_manual_youth_training$;

-- Les stages de l'Académie des métiers peuvent ajouter les mêmes domaines,
-- sans jamais dupliquer la spécialité principale.
do $patch_staff_academy$
declare
  v_signature regprocedure;
  v_definition text;
  v_patched_definition text;
begin
  foreach v_signature in array array[
    'public.start_current_team_staff_academy_training(uuid,text)'::regprocedure,
    'public.settle_due_staff_academy_trainings()'::regprocedure
  ]
  loop
    select pg_catalog.pg_get_functiondef(v_signature)
    into v_definition;
    v_definition := replace(v_definition, E'\r\n', E'\n');

    if position('v_member.role = ''trainer''' in v_definition) = 0
      or position(
        'talent.code = ''trainer_'' || v_member.trainer_specialty'
        in v_definition
      ) = 0
    then
      raise exception
        'La protection de spécialité principale a changé pour %.',
        v_signature::text;
    end if;

    v_patched_definition := replace(
      v_definition,
      'v_member.role = ''trainer''',
      'v_member.role in (''trainer'', ''youth_coach'')'
    );
    v_patched_definition := replace(
      v_patched_definition,
      'talent.code = ''trainer_'' || v_member.trainer_specialty',
      E'talent.code = case v_member.role\n            when ''trainer'' then ''trainer_''\n            else ''youth_coach_''\n          end || v_member.trainer_specialty'
    );
    execute v_patched_definition;
  end loop;
end;
$patch_staff_academy$;

update public.game_objective_definitions
set
  target_value = 12,
  description =
    'Réunir simultanément les douze métiers de staff. Récompense : un Mandat de recrutement sur mesure.'
where objective_key = 'staff_all_roles';

revoke all on function public.enforce_team_youth_coach_limit()
  from public, anon, authenticated;
revoke all on function public.get_youth_coach_training_multiplier(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.get_youth_coach_training_multiplier(uuid, uuid, text)
  to service_role;

comment on function public.enforce_team_youth_coach_limit() is
  'Garantit sous verrou transactionnel qu une équipe ne cumule jamais plusieurs responsables de formation actifs.';
comment on function public.get_youth_coach_training_multiplier(uuid, uuid, text) is
  'Bonus junior non cumulable : 2 % par niveau dans la spécialité, 1 % par niveau via un affixe et 5 % si le junior partage la nationalité.';

notify pgrst, 'reload schema';

commit;
