begin;

-- The sporting transaction was fully applied and backed up, but operator
-- precedence in the audit-summary expression retained only the three custom
-- fields. Restore the immutable operational counters from the persisted rows.
update public.official_race_historical_corrections as correction
set after_summary = jsonb_build_object(
  'status', 'applied',
  'engineVersion', '2026.09-delayed-group-energy-v31',
  'stageRows', (
    select count(*) from public.stage_results
    where stage_id = 'dc96b124-3b96-4393-ba55-c31f2915fef3'::uuid
  ),
  'secondaryRows', (
    select count(*) from public.race_secondary_results
    where race_edition_id = '716dad06-c144-47a7-afbc-68bff48f8e57'::uuid
  ),
  'mountainRows', (
    select count(*) from public.race_secondary_results
    where race_edition_id = '716dad06-c144-47a7-afbc-68bff48f8e57'::uuid
      and classification_type = 'mountain'
  ),
  'sprintRows', (
    select count(*) from public.race_secondary_results
    where race_edition_id = '716dad06-c144-47a7-afbc-68bff48f8e57'::uuid
      and classification_type = 'sprint'
  ),
  'youthRows', (
    select count(*) from public.race_secondary_results
    where race_edition_id = '716dad06-c144-47a7-afbc-68bff48f8e57'::uuid
      and classification_type = 'youth'
  ),
  'teamRows', (
    select count(*) from public.race_secondary_results
    where race_edition_id = '716dad06-c144-47a7-afbc-68bff48f8e57'::uuid
      and classification_type = 'team'
  ),
  'attackRows', (
    select count(*) from public.stage_attack_participants
    where stage_id = 'dc96b124-3b96-4393-ba55-c31f2915fef3'::uuid
  )
) || coalesce(correction.after_summary, '{}'::jsonb)
where correction.correction_key = 'boucle-provinces-s3-stage3-delayed-group-20260920'
  and correction.after_summary->>'status' is null
  and exists (
    select 1 from public.official_stage_simulations
    where stage_id = 'dc96b124-3b96-4393-ba55-c31f2915fef3'::uuid
      and race_edition_id = '716dad06-c144-47a7-afbc-68bff48f8e57'::uuid
      and engine_version = '2026.09-delayed-group-energy-v31'
  );

commit;
