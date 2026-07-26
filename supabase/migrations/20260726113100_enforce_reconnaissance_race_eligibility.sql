begin;

create or replace function public.enforce_stage_reconnaissance_race_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_edition record;
  v_registration_status text;
  v_reputation_points numeric := 0;
begin
  select
    edition.registration_policy,
    edition.registration_closes_at,
    edition.minimum_reputation
  into v_edition
  from public.stages as stage
  join public.race_editions as edition
    on edition.id = stage.race_edition_id
  join public.team_seasons as team_season
    on team_season.id = new.team_season_id
   and team_season.season_id = edition.season_id
  where stage.id = new.target_stage_id
    and edition.season_id = new.season_id;

  if not found then
    raise exception
      'Cette épreuve ne correspond pas à la saison de votre équipe.';
  end if;

  select registration.status
  into v_registration_status
  from public.race_registrations as registration
  join public.stages as stage
    on stage.id = new.target_stage_id
  where registration.team_season_id = new.team_season_id
    and registration.race_edition_id = stage.race_edition_id;

  if v_registration_status in ('accepted', 'pending') then
    return new;
  end if;

  if v_registration_status in ('rejected', 'withdrawn') then
    raise exception
      'Votre équipe n’est pas autorisée à participer à cette épreuve.';
  end if;

  select coalesce(max(director.reputation_points), 0)
  into v_reputation_points
  from public.team_seasons as team_season
  join public.team_manager_assignments as assignment
    on assignment.team_id = team_season.team_id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id
   and director.status = 'active'
  where team_season.id = new.team_season_id;

  if v_edition.registration_policy <> 'open'
    or v_edition.minimum_reputation is null
    or v_reputation_points < v_edition.minimum_reputation
    or (
      v_edition.registration_closes_at is not null
      and now() >= v_edition.registration_closes_at
    )
  then
    raise exception
      'Votre équipe n’est pas autorisée à participer à cette épreuve.';
  end if;

  return new;
end;
$$;

drop trigger if exists
  stage_reconnaissances_enforce_race_eligibility
on public.stage_reconnaissances;

create trigger stage_reconnaissances_enforce_race_eligibility
before insert or update of
  team_season_id,
  season_id,
  target_stage_id
on public.stage_reconnaissances
for each row
execute function public.enforce_stage_reconnaissance_race_eligibility();

revoke all on function
  public.enforce_stage_reconnaissance_race_eligibility()
from public, anon, authenticated;

comment on function
  public.enforce_stage_reconnaissance_race_eligibility()
is
  'Empêche une équipe de programmer une reconnaissance sur une course à laquelle elle ne peut pas participer.';

commit;
