begin;
set local application_name = 'cyclostratege-gala-s5-public-launch-20261123';
set local lock_timeout = '1s';
set local statement_timeout = '10s';

-- Publish only the reviewed S5 edition. Saved lineups, admissions, S4 archives,
-- result imports and rewards remain untouched. The Steam package is prepared
-- separately after registration closes.
do $$
declare
  v_edition public.season_gala_editions%rowtype;
begin
  select edition.* into v_edition
  from public.season_gala_editions edition
  join public.seasons season on season.id=edition.source_season_id and season.game_year=5
  for update of edition;
  if v_edition.id is null or v_edition.target_game_year<>6 then
    raise exception 'Le gala de saison 5 attendu est introuvable.';
  end if;
  if (select count(*) from public.season_gala_events where edition_id=v_edition.id)<>6
    or (select count(*) from public.season_gala_events where edition_id=v_edition.id
      and (event_key,program,position,pcm_race_id,pcm_stage_id,stage_file,startlist_filename,native_capacity,native_min_riders,native_max_riders) in (
        ('pt-zoncolan','pro-tour',1,135,14135,'top_giro_14_2021.cds','top_giro.xml',23,8,8),
        ('pt-liege','pro-tour',2,87,1087,'topclas_lbl_2019.cds','topclas_lbl.xml',25,7,7),
        ('pt-hamburg','pro-tour',3,26,1026,'topclas_hamburg_2023.cds','topclas_hamburg.xml',24,7,7),
        ('ct-alpe','continental',1,25,12025,'top_tdf_12_2022.cds','top_tdf.xml',23,7,8),
        ('ct-fleche','continental',2,15,1015,'topclas_fleche_2024.cds','topclas_fleche.xml',25,6,8),
        ('ct-flanders','continental',3,11,1011,'topclas_rondevv_2024.cds','topclas_rondevv.xml',25,7,7)
      ) and min_riders=7 and max_riders=8)<>6 then
    raise exception 'Le programme du gala S5 diffère des six parcours vérifiés.';
  end if;
  -- Replaying this migration must never reopen a subsequently closed edition.
  if v_edition.visibility='public'
    and v_edition.registration_closes_at=timestamptz '2026-12-03 18:00:00 Europe/Paris' then
    return;
  end if;
  if v_edition.visibility<>'private' or v_edition.status<>'open'
    or v_edition.registration_closes_at<>timestamptz '2026-12-04 12:00:00 Europe/Paris' then
    raise exception 'L’état du gala S5 a changé : vérifier son ouverture avant publication.';
  end if;
  update public.season_gala_editions
  set visibility='public',status='open',
    registration_closes_at=timestamptz '2026-12-03 18:00:00 Europe/Paris'
  where id=v_edition.id;
end;
$$;

-- A request may wait for the team, entry, rider, contract or rating locks.
-- Recheck the real clock just before changing a saved composition so waiting
-- cannot extend the registration window. Keep existing RPC permissions.
do $migration$
declare
  v_definition text;
  v_marker text;
  v_replacement text;
  v_count integer;
begin
  select pg_get_functiondef('public.get_current_season_five_gala_context()'::regprocedure)
  into v_definition;
  v_marker := '2026-12-04 12:00:00 Europe/Paris';
  v_count := (length(v_definition)-length(replace(v_definition,v_marker,'')))/length(v_marker);
  if v_count=1 then
    execute replace(v_definition,v_marker,'2026-12-03 18:00:00 Europe/Paris');
  elsif position('2026-12-03 18:00:00 Europe/Paris' in v_definition)=0 then
    raise exception 'La date de clôture de secours du gala S5 est inattendue.';
  end if;

  select pg_get_functiondef('private.season_five_gala_roster(uuid,uuid)'::regprocedure)
  into v_definition;
  if position('-- Keep source-S5 eligibility after rollover.' in v_definition)=0 then
    v_marker := 'join public.riders r on r.id=candidate.rider_id and r.status=''active''';
    v_count := (length(v_definition)-length(replace(v_definition,v_marker,'')))/length(v_marker);
    if v_count<>1 then raise exception 'Le filtre des coureurs du gala S5 est inattendu.'; end if;
    v_definition := replace(v_definition,v_marker,
      E'join public.riders r on r.id=candidate.rider_id\n  -- Keep source-S5 eligibility after rollover.');
    v_marker := 'join public.seasons s on s.id=n.season_id and s.game_year=5';
    v_count := (length(v_definition)-length(replace(v_definition,v_marker,'')))/length(v_marker);
    if v_count<>1 then raise exception 'La saison des coureurs du gala S5 est inattendue.'; end if;
    v_replacement := v_marker || E'\n    and (r.status=''active'' or (s.status=''completed'' and r.status in (''free_agent'',''retired'')))';
    execute replace(v_definition,v_marker,v_replacement);
  end if;

  select pg_get_functiondef('public.save_current_season_five_gala_registration(text,jsonb,text)'::regprocedure)
  into v_definition;
  v_marker := '  if v_entry.id is null then';
  v_replacement := E'  -- Recheck after roster validation and every lock wait.\n'
    || E'  v_now:=clock_timestamp();\n'
    || E'  if v_now>=v_edition.registration_closes_at then\n'
    || E'    raise exception ''Les inscriptions du gala sont closes.'';\n'
    || E'  end if;\n'
    || v_marker;
  if position('-- Recheck after roster validation and every lock wait.' in v_definition)=0 then
    v_count := (length(v_definition)-length(replace(v_definition,v_marker,'')))/length(v_marker);
    if v_count<>1 then raise exception 'La validation d’inscription S5 est inattendue.'; end if;
    execute replace(v_definition,v_marker,v_replacement);
  end if;
  select pg_get_functiondef('public.save_current_season_five_gala_registration(text,jsonb,text)'::regprocedure)
  into v_definition;
  v_marker := '  -- Recheck after roster validation and every lock wait.';
  v_replacement := E'  -- A rider can belong to only one club in the edition export.\n'
    || E'  if exists (select 1 from public.season_gala_entry_riders selected\n'
    || E'    where selected.edition_id=v_edition.id and selected.rider_id=any(v_all)\n'
    || E'      and (v_entry.id is null or selected.entry_id<>v_entry.id)) then\n'
    || E'    raise exception ''Un coureur est déjà inscrit par une autre équipe pour ce gala. Contactez l’organisation.'';\n'
    || E'  end if;\n'
    || v_marker;
  if position('-- A rider can belong to only one club in the edition export.' in v_definition)=0 then
    v_count := (length(v_definition)-length(replace(v_definition,v_marker,'')))/length(v_marker);
    if v_count<>1 then raise exception 'Le contrôle des engagements du gala S5 est inattendu.'; end if;
    execute replace(v_definition,v_marker,v_replacement);
  end if;

  select pg_get_functiondef('public.withdraw_current_season_five_gala_registration()'::regprocedure)
  into v_definition;
  v_marker := '  delete from public.season_gala_entry_riders where entry_id=v_entry;';
  v_replacement := E'  -- Recheck after locking the entry to withdraw.\n'
    || E'  v_now:=clock_timestamp();\n'
    || E'  if v_now>=v_edition.registration_closes_at then\n'
    || E'    raise exception ''Les inscriptions du gala sont closes.'';\n'
    || E'  end if;\n'
    || v_marker;
  if position('-- Recheck after locking the entry to withdraw.' in v_definition)=0 then
    v_count := (length(v_definition)-length(replace(v_definition,v_marker,'')))/length(v_marker);
    if v_count<>1 then raise exception 'La suppression d’inscription S5 est inattendue.'; end if;
    execute replace(v_definition,v_marker,v_replacement);
  end if;
end;
$migration$;

-- Read-only identity projection for the later S5 CDB/startlist package. Scope
-- every request to registered S5 teams and retain that source after rollover.
create or replace function public.get_season_five_gala_export_identities(p_team_ids uuid[])
returns table (
  team_id uuid,identity_season integer,team_name text,team_short_name text,
  team_country_code text,registration_country_id uuid,sponsor_catalog_key text,
  jersey_id text,jersey_style text,identity_ready boolean
)
language plpgsql stable security definer set search_path = '' set statement_timeout = '5s' as $$
begin
  if p_team_ids is null or cardinality(p_team_ids)>100
    or coalesce(array_ndims(p_team_ids),1)<>1 or array_position(p_team_ids,null) is not null then
    raise exception 'L’export des identités du gala exige au maximum 100 équipes valides.';
  end if;
  return query
  select registered.team_id,6,identity.value->>'futureName',
    left(coalesce(nullif(target_team.short_name,''),identity.value->>'futureName'),30),
    coalesce(country.iso_alpha2,'')::text,
    coalesce(target_team.registration_country_id,sponsor.country_id,source_team.registration_country_id),
    identity.value->>'sponsorCatalogKey',identity.value->>'jerseyId',identity.value->>'jerseyStyle',
    coalesce((identity.value->>'identityReady')::boolean,false)
  from public.season_gala_entries registered
  join public.season_gala_editions edition on edition.id=registered.edition_id and edition.target_game_year=6
  join public.seasons source_season on source_season.id=edition.source_season_id and source_season.game_year=5
  join public.team_seasons source_team on source_team.team_id=registered.team_id and source_team.season_id=source_season.id
  left join public.seasons target_season on target_season.game_year=6
  left join public.team_seasons target_team on target_team.team_id=registered.team_id and target_team.season_id=target_season.id
  cross join lateral (select private.season_five_gala_team_identity(registered.team_id) as value) identity
  left join public.sponsors sponsor on sponsor.catalog_key=identity.value->>'sponsorCatalogKey'
  left join public.countries country on country.id=coalesce(target_team.registration_country_id,sponsor.country_id,source_team.registration_country_id)
  where registered.team_id=any(p_team_ids)
  order by registered.team_id;
end;
$$;

revoke all on function public.get_season_five_gala_export_identities(uuid[]) from public,anon,authenticated;
grant execute on function public.get_season_five_gala_export_identities(uuid[]) to service_role;
comment on function public.get_season_five_gala_export_identities(uuid[]) is
  'Service-only bounded S6 identity projection for registered S5 gala teams; no mutation or active-season dependency.';

notify pgrst,'reload schema';
commit;
