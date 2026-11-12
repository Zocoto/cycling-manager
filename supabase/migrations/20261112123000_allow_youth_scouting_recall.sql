begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

create function public.recall_current_team_youth_scouting(p_mission_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set lock_timeout = '2s'
as $$
begin
  update public.youth_scouting_missions as mission
  set status = 'cancelled', updated_at = now()
  from public.seasons as season
  where mission.id = p_mission_id
    and mission.status = 'active'
    and season.id = mission.season_id
    and season.status = 'active'
    and mission.completes_day_number > greatest(
      coalesce(season.current_day_number, 1),
      (clock_timestamp() at time zone 'Europe/Paris')::date - season.starts_on + 1
    )
    and public.current_user_manages_team(mission.team_id);

  if not found then
    raise exception 'Cette mission ne peut plus être rappelée.';
  end if;
end;
$$;

revoke all on function public.recall_current_team_youth_scouting(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.recall_current_team_youth_scouting(uuid)
  to authenticated;

create function public.complete_youth_scouting_report(
  p_mission_id uuid,
  p_candidates jsonb,
  p_bonuses jsonb
)
returns boolean
language plpgsql
set search_path = ''
set lock_timeout = '2s'
as $$
declare
  v_bonuses public.youth_scouting_missions;
begin
  -- Serialize settlement with a recall before any candidates are written.
  perform 1
  from public.youth_scouting_missions as mission
  where mission.id = p_mission_id and mission.status = 'active'
  for update;

  if not found then
    return false;
  end if;

  insert into public.youth_scouting_candidates (
    mission_id, report_slot, country_id, first_name, last_name, age, archetype,
    potential_steps, native_special_ability_code, avatar_profile_key, avatar_seed,
    mountain, hills, flat, time_trial, cobbles, sprint, acceleration, downhill,
    endurance, resistance, recovery, breakaway, prologue, signing_fee, tuition_per_season,
    international_center_bonus_applied, international_center_bonus_percentage,
    scout_training_bonus_percentage, federal_tuition_reduction_percentage,
    scout_tuition_reduction_percentage, data_room_tuition_reduction_percentage,
    welcome_center_tuition_reduction_percentage, historical_archetype,
    school_plan_archetype, school_plan_transfer_points, archetype_probabilities
  )
  select
    p_mission_id, candidate.report_slot, candidate.country_id,
    candidate.first_name, candidate.last_name, candidate.age, candidate.archetype,
    candidate.potential_steps, candidate.native_special_ability_code,
    candidate.avatar_profile_key, candidate.avatar_seed,
    candidate.mountain, candidate.hills, candidate.flat, candidate.time_trial,
    candidate.cobbles, candidate.sprint, candidate.acceleration, candidate.downhill,
    candidate.endurance, candidate.resistance, candidate.recovery, candidate.breakaway,
    candidate.prologue, candidate.signing_fee, candidate.tuition_per_season,
    candidate.international_center_bonus_applied, candidate.international_center_bonus_percentage,
    candidate.scout_training_bonus_percentage, candidate.federal_tuition_reduction_percentage,
    candidate.scout_tuition_reduction_percentage, candidate.data_room_tuition_reduction_percentage,
    candidate.welcome_center_tuition_reduction_percentage, candidate.historical_archetype,
    candidate.school_plan_archetype, candidate.school_plan_transfer_points, candidate.archetype_probabilities
  from jsonb_populate_recordset(null::public.youth_scouting_candidates, p_candidates) as candidate
  on conflict (mission_id, report_slot) do nothing;

  v_bonuses := jsonb_populate_record(null::public.youth_scouting_missions, p_bonuses);

  update public.youth_scouting_missions
  set status = 'completed',
      federation_detection_bonus_percentage = v_bonuses.federation_detection_bonus_percentage,
      federal_staff_bonus_percentage = v_bonuses.federal_staff_bonus_percentage,
      federal_staff_spec_report_bonus_percentage = v_bonuses.federal_staff_spec_report_bonus_percentage,
      scouting_supervision_bonus_percentage = v_bonuses.scouting_supervision_bonus_percentage,
      data_room_quality_bonus_percentage = v_bonuses.data_room_quality_bonus_percentage,
      data_room_report_precision_bonus_percentage = v_bonuses.data_room_report_precision_bonus_percentage,
      federation_detection_spec_report_bonus_percentage = v_bonuses.federation_detection_spec_report_bonus_percentage,
      federation_detection_spec_potential_bonus_percentage = v_bonuses.federation_detection_spec_potential_bonus_percentage,
      report_ready_at = now(),
      updated_at = now()
  where id = p_mission_id;

  return true;
end;
$$;

revoke all on function public.complete_youth_scouting_report(uuid, jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.complete_youth_scouting_report(uuid, jsonb, jsonb)
  to service_role;

notify pgrst, 'reload schema';
commit;
