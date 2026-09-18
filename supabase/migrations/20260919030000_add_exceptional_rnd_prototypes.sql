begin;

insert into public.staff_talent_catalog (
  code, role, display_name, minimum_level
)
values (
  'research_exceptional_chance',
  'research_engineer',
  'Intuition de génie',
  1
)
on conflict (code) do update
set role = excluded.role,
    display_name = excluded.display_name,
    minimum_level = excluded.minimum_level,
    is_active = true;

-- Le +3 respecte le même plafond cumulé de +10 que les autres résultats.
alter table public.equipment_rnd_projects
  drop constraint if exists equipment_rnd_projects_rating_delta_check;
alter table public.equipment_rnd_projects
  add constraint equipment_rnd_projects_rating_delta_check
  check (rating_delta between -1 and 3);

-- Chance absolue par projet éligible. Le talent ajoute 0,5 point par niveau
-- d'ingénieur (soit 3,5 % au niveau 5), sans toucher au taux de réussite.
create or replace function public.get_equipment_rnd_exceptional_chance(
  p_engineer_contract_id uuid
)
returns numeric
language sql
stable
set search_path = ''
as $$
  select 1::numeric + coalesce((
    select least(5, greatest(1, member.level)) * 0.5
    from public.staff_contracts as contract
    join public.staff_members as member
      on member.id = contract.staff_member_id
     and member.role = 'research_engineer'
    join public.staff_member_talents as talent
      on talent.staff_member_id = member.id
     and talent.talent_code = 'research_exceptional_chance'
    where contract.id = p_engineer_contract_id
      and contract.status = 'active'
    limit 1
  ), 0);
$$;

do $migration$
declare
  v_definition text;
  v_marker constant text :=
    'when v_project.lab_level >= 6 and random() < 0.12 then 2';
  v_replacement constant text := E'when v_bonus_total <= 7\n'
    || E'          and random() * v_project.success_rate\n'
    || E'            < public.get_equipment_rnd_exceptional_chance(v_project.engineer_contract_id)\n'
    || E'          then 3\n'
    || '        when v_project.lab_level >= 6 and random() < 0.12 then 2';
  v_count integer;
begin
  select replace(
    pg_get_functiondef('public.settle_due_equipment_rnd_projects()'::regprocedure),
    chr(13),
    ''
  ) into v_definition;

  v_count := (length(v_definition) - length(replace(v_definition, v_marker, '')))
    / length(v_marker);
  if v_count <> 1 then
    raise exception 'Tirage R&D attendu introuvable (% marqueurs).', v_count;
  end if;
  execute replace(v_definition, v_marker, v_replacement);
end;
$migration$;

-- La percée de carrière déjà existante doit aussi reconnaître un +3.
do $migration$
declare
  v_definition text;
  v_marker constant text := 'and project.rating_delta = 2;';
  v_count integer;
begin
  select replace(
    pg_get_functiondef(
      'public.calculate_game_objective_progress_pre_recruitment_rewards(text,uuid,uuid,numeric)'::regprocedure
    ),
    chr(13),
    ''
  ) into v_definition;

  v_count := (length(v_definition) - length(replace(v_definition, v_marker, '')))
    / length(v_marker);
  if v_count <> 1 then
    raise exception 'Objectif de percée R&D attendu introuvable (% marqueurs).', v_count;
  end if;
  execute replace(v_definition, v_marker, 'and project.rating_delta >= 2;');
end;
$migration$;

update public.game_objective_definitions
set description = 'Obtenir un prototype R&D doté d’un bonus de +2 ou +3.'
where objective_key = 'rnd_breakthrough';

comment on function public.get_equipment_rnd_exceptional_chance(uuid)
is 'Chance absolue en pourcentage du prototype R&D +3 : 1 % de base, +0,5 point par niveau avec Intuition de génie.';

revoke all on function public.get_equipment_rnd_exceptional_chance(uuid)
from public, anon, authenticated;
grant execute on function public.get_equipment_rnd_exceptional_chance(uuid)
to service_role;

notify pgrst, 'reload schema';

commit;
