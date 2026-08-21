begin;

-- Une signature ou une vente peut déplacer un coureur entre l'inscription
-- « Coureurs libres » et celle de son équipe. La contrainte historique ne
-- couvre que l'intérieur d'une inscription ; ce garde-fou impose désormais
-- une seule présence active dans toute l'édition, quel que soit le détenteur.
create or replace function public.enforce_unique_active_rider_per_race_edition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_race_edition_id uuid;
begin
  if new.status not in ('selected', 'confirmed') then
    return new;
  end if;

  select registration.race_edition_id
  into v_race_edition_id
  from public.race_registrations as registration
  where registration.id = new.race_registration_id;

  if v_race_edition_id is null then
    return new;
  end if;

  update public.race_rosters as other_roster
  set status = 'withdrawn'
  from public.race_registrations as other_registration
  where other_registration.id = other_roster.race_registration_id
    and other_registration.race_edition_id = v_race_edition_id
    and other_roster.rider_id = new.rider_id
    and other_roster.id <> new.id
    and other_roster.status in ('selected', 'confirmed');

  return new;
end;
$$;

drop trigger if exists enforce_unique_active_rider_per_race_edition
on public.race_rosters;

create trigger enforce_unique_active_rider_per_race_edition
before insert or update of race_registration_id, rider_id, status
on public.race_rosters
for each row
execute function public.enforce_unique_active_rider_per_race_edition();

revoke all
on function public.enforce_unique_active_rider_per_race_edition()
from public, anon, authenticated;

grant execute
on function public.enforce_unique_active_rider_per_race_edition()
to service_role;

commit;
