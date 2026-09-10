begin;

alter table public.race_rosters
  drop constraint race_rosters_role_allowed;

alter table public.race_rosters
  add constraint race_rosters_role_allowed
  check (
    race_role in (
      'auto',
      'leader',
      'sprinter',
      'leader_sprinter',
      'protected_rider',
      'leadout',
      'free_agent',
      'domestique',
      'mountain_classification'
    )
  );

alter table public.race_roster_stage_roles
  drop constraint race_roster_stage_roles_role_allowed;

alter table public.race_roster_stage_roles
  add constraint race_roster_stage_roles_role_allowed
  check (
    race_role in (
      'auto',
      'leader',
      'sprinter',
      'leader_sprinter',
      'protected_rider',
      'leadout',
      'free_agent',
      'domestique',
      'mountain_classification'
    )
  );

create unique index race_rosters_one_protected_rider_idx
  on public.race_rosters (race_registration_id)
  where race_role = 'protected_rider'
    and status in ('selected', 'confirmed');

create unique index race_roster_stage_roles_one_protected_rider_idx
  on public.race_roster_stage_roles (race_registration_id, stage_id)
  where race_role = 'protected_rider';

-- Les RPC existants concentrent les contrôles d'éligibilité les plus récents.
-- On étend seulement leurs listes de rôles afin de ne pas réintroduire une
-- ancienne version de ces fonctions.
do $migration$
declare
  v_signature regprocedure;
  v_definition text;
  v_patched_definition text;
  v_old_fragment constant text :=
    '        ''leader_sprinter'',' || chr(10) ||
    '        ''leadout'',';
  v_new_fragment constant text :=
    '        ''leader_sprinter'',' || chr(10) ||
    '        ''protected_rider'',' || chr(10) ||
    '        ''leadout'',';
begin
  foreach v_signature in array array[
    'public.save_current_team_race_roster_with_roles(uuid,jsonb)'::regprocedure,
    'public.save_current_team_stage_role_plan(uuid,uuid,jsonb)'::regprocedure,
    'public.save_current_team_race_preparation(uuid,uuid,jsonb,jsonb)'::regprocedure
  ]
  loop
    select pg_catalog.pg_get_functiondef(v_signature)
    into v_definition;
    v_definition := replace(v_definition, chr(13), '');

    if position('protected_rider' in v_definition) > 0 then
      continue;
    end if;

    v_patched_definition := replace(
      v_definition,
      v_old_fragment,
      v_new_fragment
    );

    if v_patched_definition = v_definition
      or position(v_new_fragment in v_patched_definition) = 0
    then
      raise exception
        'La validation des rôles attendue est introuvable dans %.',
        v_signature;
    end if;

    execute v_patched_definition;
  end loop;
end;
$migration$;

do $migration$
declare
  v_signature constant regprocedure :=
    'public.complete_current_team_underfilled_race_roster(uuid,jsonb)'::regprocedure;
  v_definition text;
  v_patched_definition text;
  v_old_fragment constant text :=
    '''auto'', ''leader'', ''sprinter'', ''leader_sprinter'', ''leadout''';
  v_new_fragment constant text :=
    '''auto'', ''leader'', ''sprinter'', ''leader_sprinter'', ''protected_rider'', ''leadout''';
begin
  select pg_catalog.pg_get_functiondef(v_signature)
  into v_definition;
  v_definition := replace(v_definition, chr(13), '');

  if position('protected_rider' in v_definition) = 0 then
    v_patched_definition := replace(
      v_definition,
      v_old_fragment,
      v_new_fragment
    );

    if v_patched_definition = v_definition
      or position(v_new_fragment in v_patched_definition) = 0
    then
      raise exception
        'La validation des rôles de la réparation de start-list est inattendue.';
    end if;

    execute v_patched_definition;
  end if;
end;
$migration$;

-- Un coureur protégé conserve sa liberté tactique : il ne peut donc pas être
-- utilisé simultanément comme lieutenant, rouleur ou candidat à l'échappée.
do $migration$
declare
  v_signature constant regprocedure :=
    'public.save_current_team_race_preparation(uuid,uuid,jsonb,jsonb)'::regprocedure;
  v_definition text;
  v_patched_definition text;
  v_old_fragment constant text :=
    'where role_entry.value ->> ''role'' in (''leader'', ''sprinter'', ''leader_sprinter'')';
  v_new_fragment constant text :=
    'where role_entry.value ->> ''role'' in (''leader'', ''sprinter'', ''leader_sprinter'', ''protected_rider'')';
begin
  select pg_catalog.pg_get_functiondef(v_signature)
  into v_definition;
  v_definition := replace(v_definition, chr(13), '');

  if position(v_new_fragment in v_definition) = 0 then
    v_patched_definition := replace(
      v_definition,
      v_old_fragment,
      v_new_fragment
    );

    if v_patched_definition = v_definition
      or position(v_new_fragment in v_patched_definition) = 0
    then
      raise exception
        'La protection des missions spéciales est introuvable.';
    end if;

    execute v_patched_definition;
  end if;
end;
$migration$;

comment on column public.race_rosters.race_role is
  'Rôle général : protected_rider préserve une carte secondaire, avec une protection plus légère que le leader et sans travail collectif.';

comment on table public.race_roster_stage_roles is
  'Surcharges tactiques par étape, avec au plus un leader, un objectif de sprint et un coureur protégé distincts.';

notify pgrst, 'reload schema';

commit;
