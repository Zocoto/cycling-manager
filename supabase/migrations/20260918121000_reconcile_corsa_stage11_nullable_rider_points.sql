begin;

-- Deux coureurs n'avaient jamais marqué de points en S3. Leur compteur
-- rider_season_summaries.points était NULL, donc NULL + prime est resté NULL
-- malgré un événement de gain et des points d'équipe corrects.
do $repair$
declare
  v_audit public.official_race_historical_corrections%rowtype;
  v_season uuid := '74a7fd2f-ee7a-4d3f-bfe5-a97d0909d6c6';
  v_rider uuid;
  v_points integer;
  v_source text;
  v_updated integer;
begin
  select * into v_audit
  from public.official_race_historical_corrections
  where correction_key = 'corsa-s3-stage11-observed-finish-times-20260918'
  for update;
  if not found or v_audit.after_summary->>'status' <> 'applied' then
    raise exception 'La correction de l étape 11 doit précéder ce rapprochement.';
  end if;

  for v_rider, v_points, v_source in
    select * from (values
      (
        '4fd2a414-232e-4cc1-8545-4938f53285ad'::uuid,
        10,
        'official-stage-sporting:d62c5b5b-1552-473a-89a5-5747496c9a21:stage:d6d9dfa6-bf76-42b4-93fb-f8c75db070f5:rider:4fd2a414-232e-4cc1-8545-4938f53285ad:rank:10:v1'::text
      ),
      (
        'c71e1d55-a68b-4f52-8732-b69ef373df71'::uuid,
        40,
        'official-race:d62c5b5b-1552-473a-89a5-5747496c9a21:rider:c71e1d55-a68b-4f52-8732-b69ef373df71:v1'::text
      )
    ) as expected(rider_id, points, source_reference)
  loop
    if not exists (
      select 1
      from jsonb_array_elements(v_audit.before_snapshot->'riderSummaries') as original(entry)
      where original.entry->>'rider_id' = v_rider::text
        and original.entry->>'season_id' = v_season::text
        and original.entry->'points' = 'null'::jsonb
    ) or not exists (
      select 1 from public.reward_events as event
      where event.source_reference = v_source
        and event.rider_id = v_rider
        and event.uci_points = v_points
    ) then
      raise exception 'La récompense ou l état source du coureur % a changé.', v_rider;
    end if;

    update public.rider_season_summaries
    set points = v_points, updated_at = now()
    where rider_id = v_rider and season_id = v_season and points is null;
    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception 'Le compteur de points du coureur % n est plus vide.', v_rider;
    end if;
  end loop;

  perform public.refresh_uci_rankings(v_season);
  update public.official_race_historical_corrections
  set after_summary = after_summary || jsonb_build_object(
    'nullableRiderPointsReconciled', 2
  )
  where correction_key = 'corsa-s3-stage11-observed-finish-times-20260918';
end;
$repair$;

-- Le correctif est historique et non réutilisable ; l'audit reste disponible.
drop function public.repair_corsa_stage11_20260918(jsonb);

commit;
