begin;

create or replace function public.replace_official_stage_results(
  p_stage_id uuid,
  p_rows jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_stage_id is null then
    raise exception 'Identifiant d''étape obligatoire.';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Le classement doit être un tableau JSON.';
  end if;

  -- Deux visiteurs peuvent demander l'homologation au même instant. Sans ce
  -- verrou transactionnel, leurs DELETE voient tous deux une table vide puis
  -- leurs INSERT se heurtent à stage_results_rider_unique.
  perform pg_advisory_xact_lock(
    hashtextextended('replace-official-stage-results:' || p_stage_id::text, 0)
  );

  delete from public.stage_results
  where stage_id = p_stage_id;

  insert into public.stage_results (
    stage_id,
    race_roster_id,
    status,
    rank,
    elapsed_time_ms,
    gap_to_winner_ms,
    mountain_points,
    sprint_points,
    time_bonus_seconds,
    time_penalty_seconds,
    abandonment_reason,
    injury_id,
    updated_at
  )
  select
    p_stage_id,
    payload.race_roster_id,
    payload.status,
    payload.rank,
    payload.elapsed_time_ms,
    payload.gap_to_winner_ms,
    coalesce(payload.mountain_points, 0),
    coalesce(payload.sprint_points, 0),
    coalesce(payload.time_bonus_seconds, 0),
    coalesce(payload.time_penalty_seconds, 0),
    payload.abandonment_reason,
    payload.injury_id,
    coalesce(payload.updated_at, now())
  from jsonb_to_recordset(p_rows) as payload (
    race_roster_id uuid,
    status text,
    rank smallint,
    elapsed_time_ms bigint,
    gap_to_winner_ms bigint,
    mountain_points integer,
    sprint_points integer,
    time_bonus_seconds smallint,
    time_penalty_seconds smallint,
    abandonment_reason text,
    injury_id uuid,
    updated_at timestamptz
  );
end;
$$;

revoke all on function public.replace_official_stage_results(uuid, jsonb)
  from public;
grant execute on function public.replace_official_stage_results(uuid, jsonb)
  to service_role;

comment on function public.replace_official_stage_results(uuid, jsonb) is
  'Remplace atomiquement et sérialise le classement d une étape officielle afin que deux homologations concurrentes ne provoquent aucun conflit.';

commit;
