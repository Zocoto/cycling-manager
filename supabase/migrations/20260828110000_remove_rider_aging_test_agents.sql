begin;

-- Remove the three visual-QA riders immediately after their review. Stable IDs
-- and identity guards ensure that no legitimate free agent can be deleted.
do $cleanup_test_riders$
declare
  v_expected_ids constant uuid[] := array[
    'f0400000-0000-4000-8000-000000000040'::uuid,
    'f0550000-0000-4000-8000-000000000055'::uuid,
    'f0900000-0000-4000-8000-000000000090'::uuid
  ];
  v_matching_count integer;
  v_deleted_count integer;
begin
  perform rider.id
  from public.riders as rider
  where rider.id = any(v_expected_ids)
  for update;

  select count(*)
  into v_matching_count
  from public.riders as rider
  where (rider.id, rider.first_name, rider.last_name, rider.status) in (
    ('f0400000-0000-4000-8000-000000000040'::uuid, 'Arsène', 'Grison', 'free_agent'),
    ('f0550000-0000-4000-8000-000000000055'::uuid, 'Albin', 'Neige', 'free_agent'),
    ('f0900000-0000-4000-8000-000000000090'::uuid, 'Mortimer', 'Éternel', 'free_agent')
  );

  if v_matching_count <> 3 then
    raise exception
      'Suppression annulée : les trois coureurs tests ne correspondent plus à leur état attendu.';
  end if;

  if exists (
    select 1
    from public.rider_contracts as contract
    where contract.rider_id = any(v_expected_ids)
  ) then
    raise exception
      'Suppression annulée : un coureur test possède désormais un contrat.';
  end if;

  delete from public.rider_season_ratings as rating
  where rating.rider_id = any(v_expected_ids);

  delete from public.riders as rider
  where rider.id = any(v_expected_ids);

  get diagnostics v_deleted_count = row_count;

  if v_deleted_count <> 3 then
    raise exception
      'Suppression incomplète : % coureurs supprimés sur 3.',
      v_deleted_count;
  end if;
end;
$cleanup_test_riders$;

commit;
