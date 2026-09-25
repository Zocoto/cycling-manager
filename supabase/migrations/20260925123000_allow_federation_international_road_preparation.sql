begin;

-- Les tactiques de club restent interdites sur les courses internationales,
-- mais les inscriptions créées depuis une sélection fédérale professionnelle
-- doivent pouvoir enregistrer leurs rôles et leur stratégie de course en ligne.
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
    exists (
      select 1
      from public.race_registrations as registration
      join public.national_federation_selection_race_links as link
        on link.race_registration_id = registration.id
       and link.race_edition_id = edition.id
      join public.national_federation_selection_lists as selection_list
        on selection_list.id = link.selection_list_id
       and selection_list.status in ('pending_confirmation', 'finalized')
      join public.national_federation_selection_slots as slot
        on slot.slot_key = selection_list.slot_key
       and slot.rider_category = 'professional'
      where registration.id = new.race_registration_id
        and registration.race_edition_id = edition.id
        and registration.team_season_id is null
    )
  into v_stage_type, v_competition_type, v_is_federation_registration
  from public.stages as stage
  join public.race_editions as edition
    on edition.id = stage.race_edition_id
  join public.races as race
    on race.id = edition.race_id
  where stage.id = new.stage_id;

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
  ) and not v_is_federation_registration then
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
  'Bloque les plans route sur les chronos et les tactiques de club sur les courses internationales, tout en autorisant les sélections fédérales professionnelles liées.';

notify pgrst, 'reload schema';

commit;
