create or replace function public.get_youth_high_rating_progress_factor(
  p_projected_rating numeric,
  p_potential_steps integer
)
returns numeric
language sql
immutable
strict
set search_path = public
as $$
  select case
    when p_projected_rating < 70 then 1
    when p_projected_rating >= 76 then 0
    else
      0.35
      * (
        0.55
        + 0.45
        * power(
          (least(8, greatest(1, p_potential_steps)) - 1) / 7.0,
          2
        )
      )
      * power((76 - p_projected_rating) / 6.0, 2)
  end;
$$;

comment on function public.get_youth_high_rating_progress_factor(numeric, integer) is
  'Applies the youth-only slowdown from rating 70 toward the soft ceiling at 76, with limited relief for elite potential.';

do $$
declare
  v_definition text;
  v_original_fragment constant text := ') * v_weight;';
  v_rebalanced_fragment constant text :=
    ') * v_weight * public.get_youth_high_rating_progress_factor(v_current_projected, v_context.potential_steps);';
begin
  select pg_get_functiondef(
    'public.complete_current_youth_training_attempt(uuid,integer)'::regprocedure
  )
  into v_definition;

  if position(v_rebalanced_fragment in v_definition) > 0 then
    return;
  end if;

  if position(v_original_fragment in v_definition) = 0 then
    raise exception
      'Unable to patch complete_current_youth_training_attempt: expected gain formula was not found.';
  end if;

  execute replace(v_definition, v_original_fragment, v_rebalanced_fragment);
end;
$$;

revoke execute on function public.get_youth_high_rating_progress_factor(numeric, integer)
  from public, anon, authenticated;

notify pgrst, 'reload schema';
