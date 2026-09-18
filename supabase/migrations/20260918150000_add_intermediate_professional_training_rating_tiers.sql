begin;

-- La même courbe doit alimenter les séances officielles en base et
-- l'estimation d'entraînement affichée par l'application. Les juniors
-- conservent leurs fonctions de progression distinctes.
create or replace function public.get_pro_training_rating_progress_factor(
  p_rating numeric
)
returns numeric
language sql
immutable
strict
parallel safe
set search_path = public
as $$
  select case
    when p_rating < 50 then 1.8
    when p_rating < 60 then 1.35
    when p_rating < 70 then 1.0
    when p_rating < 75 then 0.65
    when p_rating < 80 then 0.50
    when p_rating < 85 then 0.35
    when p_rating < 90 then 0.25
    when p_rating < 95 then 0.15
    else 0.05
  end;
$$;

do $migration$
declare
  v_definition text;
  v_old constant text :=
    'v_rating_factor := case' || chr(10) ||
    '          when v_stat.current_rating < 50 then 1.8' || chr(10) ||
    '          when v_stat.current_rating < 60 then 1.35' || chr(10) ||
    '          when v_stat.current_rating < 70 then 1' || chr(10) ||
    '          when v_stat.current_rating < 80 then 0.65' || chr(10) ||
    '          when v_stat.current_rating < 90 then 0.35' || chr(10) ||
    '          else 0.15' || chr(10) ||
    '        end;';
  v_new constant text :=
    'v_rating_factor := public.get_pro_training_rating_progress_factor(' ||
    'v_stat.current_rating);';
  v_count integer;
begin
  select pg_get_functiondef(
    'public.settle_due_training_sessions()'::regprocedure
  ) into v_definition;

  v_count := (
    length(v_definition) - length(replace(v_definition, v_old, ''))
  ) / length(v_old);
  if v_count <> 1 then
    raise exception
      'Barème de progression pro inattendu : % occurrences du bloc initial.',
      v_count;
  end if;

  execute replace(v_definition, v_old, v_new);
end;
$migration$;

revoke all on function public.get_pro_training_rating_progress_factor(numeric)
  from public, anon, authenticated;
grant execute on function public.get_pro_training_rating_progress_factor(numeric)
  to service_role;

comment on function public.get_pro_training_rating_progress_factor(numeric) is
  'Frein par paliers de cinq points pour l entraînement professionnel, avec seuils complémentaires à 75, 85 et 95.';

notify pgrst, 'reload schema';

commit;
