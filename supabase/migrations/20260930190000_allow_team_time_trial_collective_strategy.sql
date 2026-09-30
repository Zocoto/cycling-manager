begin;

-- Un CLM par equipes possede bien une preparation individuelle (effort et
-- relais), mais aussi une hierarchie collective. Le garde-fou historique ne
-- doit bloquer que les chronos individuels et les prologues lorsqu'une
-- strategie collective est enregistree.
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

  if v_stage_type in ('individual_time_trial', 'prologue') then
    raise exception using
      errcode = 'P0001',
      message = 'Chrono individuel : utilisez la preparation individuelle du coureur.';
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
  'Bloque les tactiques collectives sur les chronos individuels et celles des clubs sur les courses internationales, tout en autorisant la strategie des CLM par equipes.';

-- La preparation federale d'un CLM par equipes doit elle aussi enregistrer
-- roles et strategie dans la meme transaction que les relais et les efforts.
create or replace function public.save_national_federation_time_trial_preparation(
  p_country_code text,
  p_race_edition_id uuid,
  p_stage_id uuid,
  p_plan jsonb,
  p_roles jsonb,
  p_strategy jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.save_national_federation_race_preparation(
    p_country_code,
    p_race_edition_id,
    p_stage_id,
    p_roles,
    p_strategy
  );

  perform public.save_national_federation_time_trial_preparation(
    p_country_code,
    p_race_edition_id,
    p_stage_id,
    p_plan
  );
end;
$$;

revoke all on function public.save_national_federation_time_trial_preparation(
  text,
  uuid,
  uuid,
  jsonb,
  jsonb,
  jsonb
) from public, anon;

grant execute on function public.save_national_federation_time_trial_preparation(
  text,
  uuid,
  uuid,
  jsonb,
  jsonb,
  jsonb
) to authenticated, service_role;

comment on function public.save_national_federation_time_trial_preparation(
  text,
  uuid,
  uuid,
  jsonb,
  jsonb,
  jsonb
) is
  'Enregistre atomiquement efforts, relais, roles et strategie d un CLM par equipes federal.';

notify pgrst, 'reload schema';

commit;
