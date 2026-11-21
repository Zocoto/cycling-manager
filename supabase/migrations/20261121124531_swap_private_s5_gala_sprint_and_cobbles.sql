begin;
set local application_name = 'cyclostratege-gala-s5-profile-swap-20261121';
set local lock_timeout = '1s';
set local statement_timeout = '10s';

-- Private S5 preparation only. The six native PCM races remain distinct;
-- Hamburg becomes the Pro Tour sprint and Flanders the Continental cobbles.
-- Never reinterpret a saved lineup as a different terrain automatically.
do $$
declare
  v_edition public.season_gala_editions%rowtype;
  v_flanders public.season_gala_events%rowtype;
  v_hamburg public.season_gala_events%rowtype;
  v_old integer;
  v_new integer;
begin
  -- Save/withdraw RPCs take a shared edition lock, so a selection cannot appear
  -- between this safety check and replacing the two manifest rows.
  select e.* into v_edition from public.season_gala_editions e
  join public.seasons s on s.id=e.source_season_id and s.game_year=5
  for update of e;
  if v_edition.id is null or v_edition.visibility<>'private'
    or v_edition.status<>'open' or v_edition.target_game_year<>6
    or v_edition.registration_closes_at<>timestamptz '2026-12-04 12:00 Europe/Paris' then
    raise exception 'Le changement de profils exige le gala S5 privé encore en préparation.';
  end if;
  if (select count(*) from public.season_gala_events where edition_id=v_edition.id)<>6
    or (select count(*) from public.season_gala_events where edition_id=v_edition.id
      and (event_key,program,position,pcm_race_id,pcm_stage_id,stage_file,startlist_filename) in (
        ('pt-zoncolan','pro-tour',1,135,14135,'top_giro_14_2021.cds','top_giro.xml'),
        ('pt-liege','pro-tour',2,87,1087,'topclas_lbl_2019.cds','topclas_lbl.xml'),
        ('ct-alpe','continental',1,25,12025,'top_tdf_12_2022.cds','top_tdf.xml'),
        ('ct-fleche','continental',2,15,1015,'topclas_fleche_2024.cds','topclas_fleche.xml')
      ))<>4 then
    raise exception 'Le manifeste S5 a changé : vérifier les parcours avant toute modification.';
  end if;
  select count(*) into v_old from public.season_gala_events where edition_id=v_edition.id
    and event_key in ('pt-flanders','ct-hamburg');
  select count(*) into v_new from public.season_gala_events where edition_id=v_edition.id
    and (event_key,program,position,pcm_race_id,pcm_stage_id,stage_file,startlist_filename) in (
      ('ct-flanders','continental',3,11,1011,'topclas_rondevv_2024.cds','topclas_rondevv.xml'),
      ('pt-hamburg','pro-tour',3,26,1026,'topclas_hamburg_2023.cds','topclas_hamburg.xml')
    );
  -- Idempotent metadata verification; legitimate later lineups stay untouched.
  if v_old=0 and v_new=2 then return; end if;
  if v_old<>2 or v_new<>0 then
    raise exception 'État de parcours S5 incohérent : aucune composition ne sera déplacée.';
  end if;
  select * into v_flanders from public.season_gala_events where edition_id=v_edition.id and event_key='pt-flanders';
  select * into v_hamburg from public.season_gala_events where edition_id=v_edition.id and event_key='ct-hamburg';
  if (v_flanders.program,v_flanders.position,v_flanders.pcm_race_id,v_flanders.pcm_stage_id,v_flanders.stage_file,v_flanders.startlist_filename)
      is distinct from ('pro-tour'::text,3::smallint,11,1011,'topclas_rondevv_2024.cds'::text,'topclas_rondevv.xml'::text)
    or (v_hamburg.program,v_hamburg.position,v_hamburg.pcm_race_id,v_hamburg.pcm_stage_id,v_hamburg.stage_file,v_hamburg.startlist_filename)
      is distinct from ('continental'::text,3::smallint,26,1026,'topclas_hamburg_2023.cds'::text,'topclas_hamburg.xml'::text) then
    raise exception 'Les anciennes variantes PCM diffèrent du programme vérifié.';
  end if;
  if exists(select 1 from public.season_gala_entry_riders where edition_id=v_edition.id
    and event_key in ('pt-flanders','ct-hamburg')) then
    raise exception 'Des compositions existent sur les parcours déplacés : un audit explicite est nécessaire.';
  end if;

  delete from public.season_gala_events where edition_id=v_edition.id and event_key in ('pt-flanders','ct-hamburg');
  insert into public.season_gala_events(edition_id,event_key,program,position,pcm_race_id,pcm_stage_id,
    stage_file,startlist_filename,native_capacity,native_min_riders,native_max_riders,min_riders,max_riders)
  values
    (v_edition.id,'ct-flanders','continental',3,v_flanders.pcm_race_id,v_flanders.pcm_stage_id,
      v_flanders.stage_file,v_flanders.startlist_filename,v_flanders.native_capacity,v_flanders.native_min_riders,v_flanders.native_max_riders,
      v_flanders.min_riders,v_flanders.max_riders),
    (v_edition.id,'pt-hamburg','pro-tour',3,v_hamburg.pcm_race_id,v_hamburg.pcm_stage_id,
      v_hamburg.stage_file,v_hamburg.startlist_filename,v_hamburg.native_capacity,v_hamburg.native_min_riders,v_hamburg.native_max_riders,
      v_hamburg.min_riders,v_hamburg.max_riders);
end;
$$;

notify pgrst,'reload schema';
commit;
