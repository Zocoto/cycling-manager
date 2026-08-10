-- ============================================================
-- FAN CLUB — DÉVERROUILLAGE PAR LES BÂTIMENTS
-- ============================================================

begin;

alter table public.team_infrastructures
  drop constraint if exists team_infrastructures_code_allowed,
  drop constraint if exists team_infrastructures_level_range;

alter table public.team_infrastructures
  add constraint team_infrastructures_code_allowed check (
    infrastructure_code in (
      'recruitment_data_room',
      'staff_academy',
      'fan_club_headquarters',
      'club_shop'
    )
  ),
  add constraint team_infrastructures_level_range check (
    (infrastructure_code = 'recruitment_data_room' and level between 1 and 3)
    or (infrastructure_code = 'staff_academy' and level between 1 and 5)
    or (infrastructure_code = 'fan_club_headquarters' and level between 1 and 5)
    or (infrastructure_code = 'club_shop' and level between 1 and 5)
  );

-- Le pilote est activé uniquement pour l'équipe du compte de recette.
-- L'upsert reste rejouable et ne rétrograde jamais un bâtiment existant.
with target_team as (
  select assignment.team_id
  from auth.users as app_user
  join public.sporting_directors as director
    on director.auth_user_id = app_user.id
    and director.status = 'active'
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  where lower(app_user.email) = lower('paul.leblanc22@gmail.com')
  order by assignment.created_at desc
  limit 1
), seeded_buildings as (
  select team_id, 'fan_club_headquarters'::text as infrastructure_code
  from target_team
  union all
  select team_id, 'club_shop'::text as infrastructure_code
  from target_team
)
insert into public.team_infrastructures (
  team_id,
  infrastructure_code,
  level,
  completed_at,
  updated_at
)
select
  team_id,
  infrastructure_code,
  1,
  now(),
  now()
from seeded_buildings
on conflict (team_id, infrastructure_code) do update
set
  level = greatest(public.team_infrastructures.level, excluded.level),
  updated_at = now();

notify pgrst, 'reload schema';

commit;
