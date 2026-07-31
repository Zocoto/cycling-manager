begin;

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
declare
  v_value integer;
begin
  if p_metric_key = 'tutorial_completion' then
    select count(*)::integer
    into v_value
    from public.tutorial_progress
    where sporting_director_id = p_director_id
      and tutorial_key in (
        'onboarding-core',
        'criterium-discovery'
      )
      and status = 'completed';

    return greatest(0, coalesce(v_value, 0));
  end if;

  v_value := public.calculate_expanded_game_objective_progress(
    p_metric_key,
    p_director_id
  );

  if v_value is not null then
    return v_value;
  end if;

  return public.calculate_game_objective_progress_base(
    p_metric_key,
    p_director_id,
    p_current_team_id,
    p_experience_points
  );
end;
$$;

revoke all on function public.calculate_game_objective_progress(
  text,
  uuid,
  uuid,
  numeric
) from public, anon, authenticated;

grant execute on function public.calculate_game_objective_progress(
  text,
  uuid,
  uuid,
  numeric
) to service_role;

notify pgrst, 'reload schema';

commit;
