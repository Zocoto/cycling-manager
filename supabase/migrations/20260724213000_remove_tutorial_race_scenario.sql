begin;

-- Desactive l'objectif lie au scenario retire.
update public.game_objective_definitions
set
  is_active = false,
  updated_at = now()
where objective_key = 'complete_tutorial';

-- Supprime uniquement la progression et les sessions du scenario retire.
-- Les sessions sont supprimees par la cle etrangere en cascade.
delete from public.tutorial_progress
where tutorial_key = 'tutorial-race';

-- Conserve l'interface publique de calcul des objectifs, mais retire la
-- metrique speciale ajoutee par le scenario de course.
do $$
begin
  if to_regprocedure(
    'public.calculate_game_objective_progress_legacy(text,uuid,uuid,numeric)'
  ) is null then
    raise exception
      'La fonction calculate_game_objective_progress_legacy est introuvable.';
  end if;
end;
$$;

create or replace function public.calculate_game_objective_progress(
  p_metric_key text,
  p_director_id uuid,
  p_current_team_id uuid,
  p_experience_points numeric
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return public.calculate_game_objective_progress_legacy(
    p_metric_key,
    p_director_id,
    p_current_team_id,
    p_experience_points
  );
end;
$$;

revoke all
on function public.calculate_game_objective_progress(
  text, uuid, uuid, numeric
)
from public, anon, authenticated;

grant execute
on function public.calculate_game_objective_progress(
  text, uuid, uuid, numeric
)
to service_role;

comment on function public.calculate_game_objective_progress(
  text, uuid, uuid, numeric
) is
  'Calcule la progression des objectifs sans le scenario de course tutorielle retire.';

notify pgrst, 'reload schema';

commit;