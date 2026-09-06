begin;

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
    0.08
    + 1.52
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

create or replace function public.calculate_youth_training_projected_gain(
  p_training_mode text,
  p_score integer,
  p_potential_steps integer,
  p_projected_rating numeric,
  p_profile_peak_rating numeric,
  p_profile_average_rating numeric,
  p_domain_weight numeric,
  p_session_variance numeric
)
returns numeric
language sql
immutable
strict
parallel safe
set search_path = public
as $$
  select
    0.30
    * public.get_youth_talent_progress_multiplier(p_potential_steps)
    * public.get_youth_training_rating_progress_factor(p_projected_rating)
    * public.get_youth_profile_load_factor(
      p_profile_peak_rating,
      p_profile_average_rating
    )
    * least(1, greatest(0, p_domain_weight))
    * case p_training_mode
        when 'automatic' then 1.00
        when 'manual' then
          0.75
          * (
            0.25
            + 0.75 * least(1000, greatest(0, p_score)) / 1000.0
          )
        else 0
      end
    * least(1.28, greatest(0.78, p_session_variance));
$$;

-- Compatibility for any older server-side caller. Podium rewards deliberately
-- retain their own curve through get_youth_rating_progress_factor.
create or replace function public.get_youth_high_rating_progress_factor(
  p_projected_rating numeric,
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
    public.get_youth_training_rating_progress_factor(p_projected_rating)
    * public.get_youth_talent_progress_multiplier(p_potential_steps);
$$;

revoke execute on function public.get_youth_training_rating_progress_factor(numeric)
  from public, anon, authenticated;
revoke execute on function public.calculate_youth_training_projected_gain(
  text,
  integer,
  integer,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric
) from public, anon, authenticated;
revoke execute on function public.get_youth_high_rating_progress_factor(numeric, integer)
  from public, anon, authenticated;

comment on function public.get_youth_training_rating_progress_factor(numeric) is
  'Youth-school training curve: strong catch-up below 50, then a continuous increasing penalty toward elite ratings.';
comment on function public.calculate_youth_training_projected_gain(text, integer, integer, numeric, numeric, numeric, numeric, numeric) is
  'Shared tapered youth training formula. A perfect ordinary academy path targets a strongest rating near 75.';
comment on function public.get_youth_high_rating_progress_factor(numeric, integer) is
  'Compatibility wrapper for youth training callers, combining the tapered rating curve with talent.';

notify pgrst, 'reload schema';

commit;
