begin;

-- Surcharge atomique : le plan de relais et la hiérarchie TTT sont enregistrés
-- dans la même transaction. Les deux fonctions historiques conservent leurs
-- validations d'inscription, de roster et d'heure de départ.
create function public.save_current_team_time_trial_preparation(
  p_race_edition_id uuid,
  p_stage_id uuid,
  p_plan jsonb,
  p_roles jsonb,
  p_strategy jsonb
)
returns table (
  saved_stage_id uuid,
  stage_number integer,
  updated_rider_count integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform *
  from public.save_current_team_race_preparation(
    p_race_edition_id,
    p_stage_id,
    p_roles,
    p_strategy
  );

  return query
  select *
  from public.save_current_team_time_trial_preparation(
    p_race_edition_id,
    p_stage_id,
    p_plan
  );
end;
$$;

revoke all on function public.save_current_team_time_trial_preparation(
  uuid,
  uuid,
  jsonb,
  jsonb,
  jsonb
) from public, anon;

grant execute on function public.save_current_team_time_trial_preparation(
  uuid,
  uuid,
  jsonb,
  jsonb,
  jsonb
) to authenticated, service_role;

comment on function public.save_current_team_time_trial_preparation(
  uuid,
  uuid,
  jsonb,
  jsonb,
  jsonb
) is
  'Enregistre atomiquement les relais, efforts, rôles protégés et la hiérarchie d un CLM par équipes.';

notify pgrst, 'reload schema';

commit;
