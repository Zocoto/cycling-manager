-- Ajoute une queue de distribution très rare aux potentiels des enchères
-- quotidiennes. Les paliers représentent des demi-étoiles :
-- 1 = 0,5 étoile et 8 = 4 étoiles.
--
-- 97 % des coureurs restent dans les trois paliers historiques.
-- 3 % dépassent l'ancien plafond de 1,5 étoile.
-- 1 % constitue le "ticket d'or" à 2,5 étoiles ou davantage.

begin;

create or replace function public.calculate_initial_rider_potential_steps(
  p_rider_id uuid,
  p_generation_source text default 'amateur'
)
returns integer
language sql
immutable
set search_path = public
as $$
  with roll as (
    select (
      (
        hashtextextended(
          p_rider_id::text || ':potential:' || p_generation_source,
          0
        ) % 10000 + 10000
      ) % 10000
    )::integer as value
  )
  select case
    when p_generation_source = 'auction' and value < 4200 then 1
    when p_generation_source = 'auction' and value < 8000 then 2
    when p_generation_source = 'auction' and value < 9700 then 3
    when p_generation_source = 'auction' and value < 9900 then 4
    when p_generation_source = 'auction' and value < 9955 then 5
    when p_generation_source = 'auction' and value < 9980 then 6
    when p_generation_source = 'auction' and value < 9995 then 7
    when p_generation_source = 'auction' then 8
    when value < 7000 then 1
    else 2
  end
  from roll;
$$;

comment on function public.calculate_initial_rider_potential_steps(uuid, text)
is 'Attribue un potentiel déterministe selon la source ; les enchères quotidiennes disposent d’une queue rare jusqu’à 4 étoiles.';

commit;
