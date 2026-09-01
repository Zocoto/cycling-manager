begin;

-- Le rôle combiné reste un objectif de sprint unique, mais il ne consomme pas
-- la place du leader de classement général. Un même collectif peut donc
-- protéger un leader et son sprinteur sans pouvoir aligner deux sprinteurs.
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
      'leadout',
      'free_agent',
      'domestique',
      'mountain_classification'
    )
  );

drop index public.race_roster_stage_roles_one_sprinter_idx;

create unique index race_roster_stage_roles_one_sprinter_idx
  on public.race_roster_stage_roles (race_registration_id, stage_id)
  where race_role in ('sprinter', 'leader_sprinter');

-- Les RPC ont accumulé plusieurs garde-fous de disponibilité et de santé.
-- On étend uniquement leurs fragments liés aux rôles afin de préserver tous
-- les correctifs plus récents sans recopier des centaines de lignes de SQL.
do $migration$
declare
  v_signature regprocedure;
  v_definition text;
  v_patched_definition text;
  v_allowed_fragment constant text :=
    '        ''sprinter'',' || chr(10) ||
    '        ''leadout'',';
  v_combined_allowed_fragment constant text :=
    '        ''sprinter'',' || chr(10) ||
    '        ''leader_sprinter'',' || chr(10) ||
    '        ''leadout'',';
  v_sprinter_count_fragment constant text :=
    'where entry.value ->> ''role'' = ''sprinter''';
  v_combined_sprinter_count_fragment constant text :=
    'where entry.value ->> ''role'' in (''sprinter'', ''leader_sprinter'')';
begin
  foreach v_signature in array array[
    'public.save_current_team_race_roster_with_roles(uuid,jsonb)'::regprocedure,
    'public.save_current_team_stage_role_plan(uuid,uuid,jsonb)'::regprocedure,
    'public.save_current_team_race_preparation(uuid,uuid,jsonb,jsonb)'::regprocedure
  ]
  loop
    select pg_catalog.pg_get_functiondef(v_signature)
    into v_definition;

    -- Certaines fonctions historiques ont conservé des fins de ligne CRLF.
    -- PostgreSQL accepte indifféremment les deux formats, mais les fragments
    -- ciblés doivent être normalisés avant leur remplacement sécurisé.
    v_definition := replace(v_definition, chr(13), '');

    if position('leader_sprinter' in v_definition) > 0 then
      continue;
    end if;

    v_patched_definition := replace(
      v_definition,
      v_allowed_fragment,
      v_combined_allowed_fragment
    );
    v_patched_definition := replace(
      v_patched_definition,
      v_sprinter_count_fragment,
      v_combined_sprinter_count_fragment
    );

    if v_patched_definition = v_definition
      or position(v_combined_allowed_fragment in v_patched_definition) = 0
      or position(v_combined_sprinter_count_fragment in v_patched_definition) = 0
    then
      raise exception
        'Les validations de rôle attendues sont introuvables dans %.',
        v_signature;
    end if;

    if v_signature =
      'public.save_current_team_race_preparation(uuid,uuid,jsonb,jsonb)'::regprocedure
    then
      v_patched_definition := replace(
        v_patched_definition,
        'where role_entry.value ->> ''role'' in (''leader'', ''sprinter'')',
        'where role_entry.value ->> ''role'' in (''leader'', ''sprinter'', ''leader_sprinter'')'
      );
      if position(
        'where role_entry.value ->> ''role'' in (''leader'', ''sprinter'', ''leader_sprinter'')'
        in v_patched_definition
      ) = 0 then
        raise exception
          'La protection des missions spéciales est introuvable dans %.',
          v_signature;
      end if;
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
  v_old_selection constant text :=
    '      select final_role.role' || chr(10) ||
    '      from (';
  v_new_selection constant text :=
    '      select case' || chr(10) ||
    '        when final_role.role in (''sprinter'', ''leader_sprinter'') then ''sprinter''' || chr(10) ||
    '        else final_role.role' || chr(10) ||
    '      end as role' || chr(10) ||
    '      from (';
  v_old_grouping constant text :=
    '      where final_role.role in (''leader'', ''sprinter'')' || chr(10) ||
    '      group by final_role.role';
  v_new_grouping constant text :=
    '      where final_role.role in (''leader'', ''sprinter'', ''leader_sprinter'')' || chr(10) ||
    '      group by case' || chr(10) ||
    '        when final_role.role in (''sprinter'', ''leader_sprinter'') then ''sprinter''' || chr(10) ||
    '        else final_role.role' || chr(10) ||
    '      end';
begin
  select pg_catalog.pg_get_functiondef(v_signature)
  into v_definition;

  v_definition := replace(v_definition, chr(13), '');

  if position('leader_sprinter' in v_definition) = 0 then
    v_patched_definition := replace(
      v_definition,
      '''auto'', ''leader'', ''sprinter'', ''leadout''',
      '''auto'', ''leader'', ''sprinter'', ''leader_sprinter'', ''leadout'''
    );
    v_patched_definition := replace(
      v_patched_definition,
      v_old_selection,
      v_new_selection
    );
    v_patched_definition := replace(
      v_patched_definition,
      v_old_grouping,
      v_new_grouping
    );

    if v_patched_definition = v_definition
      or position(v_new_selection in v_patched_definition) = 0
      or position(v_new_grouping in v_patched_definition) = 0
      or position(
        '''auto'', ''leader'', ''sprinter'', ''leader_sprinter'', ''leadout'''
        in v_patched_definition
      ) = 0
    then
      raise exception
        'La validation des rôles de la réparation de start-list est inattendue.';
    end if;

    execute v_patched_definition;
  end if;
end;
$migration$;

comment on column public.race_rosters.race_role is
  'Rôle général : leader_sprinter cumule la protection du leader et la priorité du sprinteur, tout en laissant un leader distinct possible.';

comment on table public.race_roster_stage_roles is
  'Surcharges tactiques par étape, avec au plus un leader distinct et un objectif de sprint simple ou protégé.';

notify pgrst, 'reload schema';

commit;
