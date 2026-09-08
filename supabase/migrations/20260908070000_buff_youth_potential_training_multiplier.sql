begin;

create or replace function public.get_youth_talent_progress_multiplier(
  p_potential_steps integer
)
returns numeric
language sql
immutable
strict
parallel safe
set search_path = public
as $$
  select
    0.50
    + 1.50
    * power(
      (least(8, greatest(1, p_potential_steps)) - 1) / 7.0,
      1.35
    );
$$;

create or replace function public.get_youth_training_rating_progress_factor(
  p_projected_rating numeric
)
returns numeric
language sql
immutable
strict
parallel safe
set search_path = public
as $$
  select
    0.03
    + 1.57
    * power(
      least(
        1,
        greatest(
          0,
          (88 - least(100, greatest(0, p_projected_rating))) / 48.0
        )
      ),
      2
    );
$$;

revoke execute on function public.get_youth_talent_progress_multiplier(integer)
  from public, anon, authenticated;
revoke execute on function public.get_youth_training_rating_progress_factor(numeric)
  from public, anon, authenticated;

comment on function public.get_youth_talent_progress_multiplier(integer) is
  'Courbe continue du potentiel junior : multiplicateur de 0,50 à 0,5 étoile jusqu à 2,00 à 4 étoiles.';
comment on function public.get_youth_training_rating_progress_factor(numeric) is
  'Frein continu renforcé sur les notes élevées afin que le potentiel accélère surtout le développement initial sans supprimer le plafond naturel autour de 75.';

notify pgrst, 'reload schema';

commit;
