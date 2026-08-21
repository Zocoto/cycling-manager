begin;

-- Ces limites sont des règles de progression temporaires et pourront évoluer
-- dans une future migration. Le niveau 50 est atteint à 63 700 XP avec le
-- barème actuel (100 XP, puis 50 XP supplémentaires par palier).
do $$
declare
  v_reputation_normalized integer;
  v_experience_normalized integer;
begin
  select
    count(*) filter (where reputation_points > 1000)::integer,
    count(*) filter (where experience_points > 63700)::integer
  into v_reputation_normalized, v_experience_normalized
  from public.sporting_directors;

  raise notice
    'PLAFONDS DS | Reputations ramenees a 1000: % | XP ramenes a 63700: %',
    v_reputation_normalized,
    v_experience_normalized;
end;
$$;

update public.sporting_directors
set
  reputation_points = least(reputation_points, 1000::numeric),
  experience_points = least(experience_points, 63700)
where reputation_points > 1000
   or experience_points > 63700;

create or replace function public.enforce_sporting_director_progression_caps()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Un gain au plafond laisse la valeur au plafond. Une diminution reste
  -- intacte, ce qui permet toujours les pénalités de réputation.
  new.reputation_points := least(new.reputation_points, 1000::numeric);
  new.experience_points := least(new.experience_points, 63700);

  return new;
end;
$$;

drop trigger if exists enforce_sporting_director_progression_caps
  on public.sporting_directors;

create trigger enforce_sporting_director_progression_caps
before insert or update of reputation_points, experience_points
on public.sporting_directors
for each row
execute function public.enforce_sporting_director_progression_caps();

alter table public.sporting_directors
  drop constraint if exists sporting_directors_reputation_points_cap;

alter table public.sporting_directors
  add constraint sporting_directors_reputation_points_cap
  check (reputation_points <= 1000);

alter table public.sporting_directors
  drop constraint if exists sporting_directors_experience_points_cap;

alter table public.sporting_directors
  add constraint sporting_directors_experience_points_cap
  check (experience_points <= 63700);

create or replace function public.calculate_staff_director_level(
  p_experience_points numeric
)
returns integer
language plpgsql
immutable
set search_path = public
as $$
declare
  v_experience integer := least(
    63700,
    greatest(0, floor(coalesce(p_experience_points, 0))::integer)
  );
  v_level integer := 1;
  v_consumed integer := 0;
  v_required integer := 100;
begin
  while v_level < 50
    and v_experience >= v_consumed + v_required
  loop
    v_consumed := v_consumed + v_required;
    v_level := v_level + 1;
    v_required := 100 + (v_level - 1) * 50;
  end loop;

  return v_level;
end;
$$;

comment on constraint sporting_directors_reputation_points_cap
  on public.sporting_directors is
  'La réputation du Directeur Sportif est plafonnée à 1 000 points.';

comment on constraint sporting_directors_experience_points_cap
  on public.sporting_directors is
  'Le niveau 50 du Directeur Sportif est plafonné à 63 700 XP.';

comment on function public.calculate_staff_director_level(numeric) is
  'Calcule le niveau du Directeur Sportif, plafonné au niveau 50.';

commit;
