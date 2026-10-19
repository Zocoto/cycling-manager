begin;
set local application_name = 'codex-director-xp-migration';
set local lock_timeout = '3s';
set local statement_timeout = '15s';

-- Preserve S4 reputation normalization and its separate peak/ledger triggers.
-- Existing XP stays intact; future awards are no longer truncated at 63,700.
create or replace function public.enforce_sporting_director_progression_caps()
returns trigger language plpgsql set search_path = public as $$
begin
  new.reputation_points := greatest(0, coalesce(new.reputation_points, 0));
  return new;
end;
$$;

alter table public.sporting_directors
  drop constraint sporting_directors_experience_points_cap;

-- Same progression curve, also beyond level 50. No new gameplay unlocks.
-- The closed form avoids a loop whose cost would grow with a player's XP.
create or replace function public.calculate_staff_director_level(p_experience_points numeric)
returns integer language sql immutable set search_path = '' as $$
  select greatest(1, floor((sqrt(4 * greatest(0, floor(coalesce(p_experience_points, 0))) + 225) - 5) / 10))::integer;
$$;

comment on function public.calculate_staff_director_level(numeric) is
  'Calcule le niveau du Directeur Sportif sans plafond de gameplay, avec le barème historique de 100 XP puis 50 XP supplémentaires par palier.';

notify pgrst, 'reload schema';
commit;
