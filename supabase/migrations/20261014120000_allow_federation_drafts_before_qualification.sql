begin;
set local lock_timeout='4s';
set local statement_timeout='15s';

-- A published calendar exists before J8. Keep the qualified target resolver
-- authoritative for call-ups/startlists, and use a separate resolver for drafts.
create or replace function public.get_national_federation_selection_calendar_target(p_country_id uuid,p_season_id uuid,p_slot_key text)
returns table(race_edition_id uuid,race_slug text,edition_status text,departure_at timestamptz)
language sql stable security definer set search_path='' as $$
  -- federation_draft_qualification_v1: always prefer the authoritative resolver.
  -- NC/Olympics and future changes to their quotas remain delegated, not copied.
  with qualified as materialized (
    select * from public.get_national_federation_selection_target(p_country_id,p_season_id,p_slot_key)
  )
  select * from qualified
  union all
  (select edition.id,race.slug,edition.status,min(stage.departure_at)
    from public.national_federation_selection_slots slot
    join public.countries country on country.id=p_country_id
    join public.seasons season on season.id=p_season_id
    join public.race_editions edition on edition.season_id=season.id
    join public.races race on race.id=edition.race_id and race.competition_type=slot.competition_code
    join public.stages stage on stage.race_edition_id=edition.id
    where not exists(select 1 from qualified)
      and slot.slot_key=p_slot_key and slot.rider_category='professional'
      and public.federation_selection_slot_is_available(slot.slot_key,season.game_year)
      and slot.competition_code in ('continental_championship','world_championship')
      and edition.status<>'cancelled'
      and (slot.competition_code<>'continental_championship' or race.championship_continent_code=country.continent_code)
      and stage.stage_type=case when slot.profile_label='Chrono' then 'individual_time_trial' else 'road' end
    group by edition.id,race.slug
    order by min(stage.departure_at),edition.id limit 1);
$$;
revoke all on function public.get_national_federation_selection_calendar_target(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.get_national_federation_selection_calendar_target(uuid,uuid,text) to service_role;

do $patch$
declare v_schedule text; v_save text;
  v_save_guard text := 'perform public.assert_federation_selection_open(v_identity.country_id, v_season.id, v_slot.slot_key);';
begin
  v_schedule:=replace(pg_get_functiondef('public.get_national_federation_selection_schedule(uuid,uuid)'::regprocedure),chr(13),'');
  v_save:=replace(pg_get_functiondef('public.save_national_federation_preselection(text,text,uuid[])'::regprocedure),chr(13),'');
  if position('public.get_national_federation_selection_target(' in v_schedule)=0
    or position('and now() < deadline.closes_at, false)' in v_schedule)=0
    or position(v_save_guard in v_save)=0 then
    raise exception 'Federation draft qualification anchors changed; review before applying.';
  end if;
  v_schedule:=replace(v_schedule,'public.get_national_federation_selection_target(','public.get_national_federation_selection_calendar_target(');
  v_schedule:=replace(v_schedule,'and now() < deadline.closes_at, false)', $replacement$and now() < deadline.closes_at
      -- federation_draft_qualification_v1: is_open still means permission to publish.
      and (slot.rider_category <> 'professional'
        or slot.competition_code not in ('continental_championship','world_championship')
        or exists (select 1 from public.international_nation_qualification_snapshots snapshot
          where snapshot.season_id=season.id and snapshot.competition_code=slot.competition_code
            and snapshot.country_id=country.id and snapshot.is_qualified)), false)$replacement$);
  execute v_schedule;
  execute replace(v_save,v_save_guard,
    'perform public.assert_federation_preselection_editable(v_identity.country_id, v_season.id, v_slot.slot_key);');
end;
$patch$;

create or replace function public.get_national_federation_preselection_schedule(p_country_id uuid,p_season_id uuid)
returns table(slot_key text,label text,rider_category text,race_edition_id uuid,race_href text,
  departure_at timestamptz,closes_at timestamptz,is_open boolean,can_prepare boolean,
  qualification_status text,qualification_day_number integer)
language sql stable security definer set search_path='' as $$
  -- federation_draft_qualification_v1
  with frozen_competitions as materialized (
    select distinct snapshot.competition_code
    from public.international_nation_qualification_snapshots snapshot
    where snapshot.season_id=p_season_id
  ), availability as (
    select schedule.*,season.status as season_status,season.game_year,edition.status as edition_status,
      case when slot.rider_category<>'professional'
          or slot.competition_code not in ('continental_championship','world_championship') then 'not_applicable'
        when snapshot.is_qualified then 'qualified'
        when frozen.competition_code is not null then 'not_qualified'
        else 'pending' end as qualification
    from public.get_national_federation_selection_schedule(p_country_id,p_season_id) schedule
    join public.seasons season on season.id=p_season_id
    join public.national_federation_selection_slots slot on slot.slot_key=schedule.slot_key
    left join public.race_editions edition on edition.id=schedule.race_edition_id and slot.rider_category='professional'
    left join public.international_nation_qualification_snapshots snapshot on snapshot.season_id=p_season_id
      and snapshot.competition_code=slot.competition_code and snapshot.country_id=p_country_id
    left join frozen_competitions frozen on frozen.competition_code=slot.competition_code
  )
  select a.slot_key,a.label,a.rider_category,a.race_edition_id,a.race_href,a.departure_at,a.closes_at,a.is_open,
    a.is_open or coalesce(a.qualification='pending' and a.season_status='active' and a.game_year>=3
      and a.edition_status not in ('completed','cancelled') and now()<a.closes_at,false),
    a.qualification,case when a.qualification<>'not_applicable' then 8 end
  from availability a;
$$;
revoke all on function public.get_national_federation_preselection_schedule(uuid,uuid) from public,anon;
grant execute on function public.get_national_federation_preselection_schedule(uuid,uuid) to authenticated,service_role;

create or replace function public.assert_federation_preselection_editable(p_country_id uuid,p_season_id uuid,p_slot_key text)
returns void language plpgsql security definer set search_path='' as $$
declare v_schedule record;
begin
  select * into v_schedule from public.get_national_federation_preselection_schedule(p_country_id,p_season_id)
    where slot_key=p_slot_key;
  if coalesce(v_schedule.can_prepare,false) then return; end if;
  if v_schedule.qualification_status='not_qualified' then
    raise exception 'Cette fédération n’est pas qualifiée pour cette compétition.';
  end if;
  raise exception 'La date limite de cette sélection est dépassée ou son calendrier est indisponible.';
end;
$$;
revoke all on function public.assert_federation_preselection_editable(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.assert_federation_preselection_editable(uuid,uuid,text) to service_role;

create or replace function public.assert_federation_selection_open(p_country_id uuid,p_season_id uuid,p_slot_key text)
returns void language plpgsql security definer set search_path='' as $$
declare v_schedule record;
begin
  -- federation_draft_qualification_v1: a saved draft never bypasses qualification.
  select * into v_schedule from public.get_national_federation_preselection_schedule(p_country_id,p_season_id)
    where slot_key=p_slot_key;
  if coalesce(v_schedule.is_open,false) then return; end if;
  if v_schedule.qualification_status='pending' and v_schedule.can_prepare then
    raise exception 'Les qualifications nationales sont figées à J8. Votre brouillon est conservé ; l’envoi aux DS sera possible après qualification.';
  end if;
  if v_schedule.qualification_status='not_qualified' then
    raise exception 'Cette fédération n’est pas qualifiée pour cette compétition.';
  end if;
  raise exception 'La date limite de cette sélection est dépassée ou son calendrier est indisponible.';
end;
$$;

-- No qualification, list, confirmation, roster or notification is rewritten.
notify pgrst,'reload schema';
commit;
