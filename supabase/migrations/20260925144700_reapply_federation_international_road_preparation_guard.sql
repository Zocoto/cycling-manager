begin;

-- La version 20260925123000 a ete enregistree en production pendant une
-- collision de numeros de migrations. Le garde-fou historique est donc reste
-- actif alors que le fichier local contenait deja l'exception federation.
-- Rejouer la definition sous un numero unique garantit que les plans nationaux
-- passent, sans rouvrir la preparation des courses internationales aux clubs.
create or replace function public.reject_time_trial_race_preparation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage_type text;
  v_competition_type text;
  v_is_federation_registration boolean := false;
begin
  select
    stage.stage_type,
    race.competition_type,
    registration.team_season_id is null
      and exists (
        select 1
        from public.national_federation_selection_race_links as link
        join public.national_federation_selection_lists as selection_list
          on selection_list.id = link.selection_list_id
         and selection_list.status in ('pending_confirmation', 'finalized')
        join public.national_federation_selection_slots as slot
          on slot.slot_key = selection_list.slot_key
         and slot.rider_category = 'professional'
        where link.race_registration_id = registration.id
          and link.race_edition_id = registration.race_edition_id
      )
  into v_stage_type, v_competition_type, v_is_federation_registration
  from public.race_registrations as registration
  join public.race_editions as edition
    on edition.id = registration.race_edition_id
  join public.races as race
    on race.id = edition.race_id
  join public.stages as stage
    on stage.id = new.stage_id
   and stage.race_edition_id = edition.id
  where registration.id = new.race_registration_id;

  if v_stage_type in (
    'individual_time_trial',
    'team_time_trial',
    'prologue'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Chrono : utilisez la preparation individuelle du coureur.';
  end if;

  if v_competition_type in (
    'continental_championship',
    'world_championship',
    'nations_cup'
  ) and not coalesce(v_is_federation_registration, false) then
    raise exception using
      errcode = 'P0001',
      message = 'Course internationale : les consignes collectives sont gerees par la selection nationale.';
  end if;

  return new;
end;
$$;

revoke all on function public.reject_time_trial_race_preparation()
from public, anon, authenticated;

comment on function public.reject_time_trial_race_preparation() is
  'Bloque les plans route sur les chronos et les tactiques de club sur les courses internationales, tout en autorisant les inscriptions fédérales professionnelles liées.';

notify pgrst, 'reload schema';

commit;
