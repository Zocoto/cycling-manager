begin;
set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- Dedicated gala routines only. Existing events, settlements and table ACLs
-- remain unchanged. All writes derive ownership from auth.uid(), never input.
create function private.season_four_gala_is_open()
returns boolean language sql stable set search_path = '' as $$
 select now() < timestamptz '2026-11-05 23:59:00 Europe/Paris'
   and exists(select 1 from public.seasons where game_year=4 and status='active');
$$;

create function private.current_season_four_gala_team()
returns uuid language plpgsql stable set search_path = '' as $$
declare v_team uuid; v_count integer;
begin
 if auth.uid() is null then raise exception using errcode='42501',message='Authentification requise.'; end if;
 select min(a.team_id::text)::uuid,count(distinct a.team_id) into v_team,v_count
 from public.sporting_directors d
 join public.team_manager_assignments a on a.sporting_director_id=d.id and a.role='general_manager' and a.status='active'
 join public.teams t on t.id=a.team_id and t.status='active'
 join public.team_seasons ts on ts.team_id=t.id
 join public.seasons s on s.id=ts.season_id and s.game_year=4
 join public.seasons first_season on first_season.id=a.start_season_id
 left join public.seasons last_season on last_season.id=a.end_season_id
 where d.auth_user_id=auth.uid() and d.status='active' and first_season.game_year<=4
   and (last_season.id is null or last_season.game_year>=4);
 if v_count>1 then raise exception 'Plusieurs équipes actives : contactez l’organisation.'; end if;
 return v_team;
end;$$;

create function private.season_four_gala_roster(p_team uuid)
returns table(rider_id uuid,first_name text,last_name text,mountain numeric,hills numeric,flat numeric,time_trial numeric,cobbles numeric,sprint numeric)
language sql stable set search_path = '' as $$
 select r.id,r.first_name,r.last_name,n.mountain::numeric,n.hills::numeric,n.flat::numeric,n.time_trial::numeric,n.cobbles::numeric,n.sprint::numeric
 from public.riders r
 join public.rider_season_ratings n on n.rider_id=r.id
 join public.seasons s on s.id=n.season_id and s.game_year=4
 join lateral (
   select c.team_id from public.rider_contracts c
   join public.seasons cs on cs.id=c.start_season_id
   join public.seasons ce on ce.id=c.end_season_id
   left join public.seasons cl on cl.id=c.left_season_id
   where c.rider_id=r.id and c.status in ('active','completed')
     and cs.game_year<=4 and ce.game_year>=4 and (c.left_season_id is null or cl.game_year>4)
   order by cs.game_year desc,coalesce(c.joined_day_number,1) desc,c.signed_at desc nulls last,c.id asc limit 1
 ) owner on owner.team_id=p_team
 where r.status='active' and exists(select 1 from public.rider_contracts candidate where candidate.rider_id=r.id and candidate.team_id=p_team and candidate.status in ('active','completed'));
$$;

create function public.get_current_season_four_gala_context()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_team uuid; v_season uuid; v_registration public.season_gala_registrations%rowtype;
begin
 v_team:=private.current_season_four_gala_team();
 select id into v_season from public.seasons where game_year=4;
 select * into v_registration from public.season_gala_registrations where season_id=v_season and team_id=v_team;
 return jsonb_build_object(
  'isOpen',private.season_four_gala_is_open(),
  'team',(select jsonb_build_object('id',team_id,'name',display_name) from public.team_seasons where team_id=v_team and season_id=v_season),
  'program',v_registration.program,
  'selections',coalesce((select jsonb_object_agg(profile,ids) from (
    select profile,jsonb_agg(rider_id order by position) ids from public.season_gala_registration_riders where registration_id=v_registration.id group by profile
  ) groups),'{}'::jsonb),
  'riders',coalesce((select jsonb_agg(to_jsonb(r) order by last_name,first_name,rider_id) from private.season_four_gala_roster(v_team) r),'[]'::jsonb),
  'counts',jsonb_build_object(
    'world-tour',(select count(*) from public.season_gala_registrations where season_id=v_season and program='world-tour'),
    'continental',(select count(*) from public.season_gala_registrations where season_id=v_season and program='continental')));
end;$$;

create function public.save_current_season_four_gala_registration(p_program text,p_selections jsonb)
returns uuid language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
declare v_team uuid; v_season uuid; v_id uuid; v_profile text; v_profiles text[]; v_ids uuid[]; v_valid integer;
begin
 v_team:=private.current_season_four_gala_team();
 if v_team is null then raise exception 'Aucune équipe de saison 4 à inscrire.'; end if;
 if not private.season_four_gala_is_open() then raise exception 'Les inscriptions du gala sont closes.'; end if;
 if p_program is null or p_program not in ('world-tour','continental') then raise exception 'Programme du gala invalide.'; end if;
 v_profiles:=case when p_program='world-tour' then array['mountain','hills','cobbles'] else array['mountain','hills','sprint'] end;
 if p_selections is null or jsonb_typeof(p_selections)<>'object' or pg_column_size(p_selections)>16384 then raise exception 'Compositions du gala invalides.'; end if;
 if (select count(*) from jsonb_object_keys(p_selections))<>3 or exists(select 1 from jsonb_object_keys(p_selections) k where not k=any(v_profiles)) then
  raise exception 'Trois compositions du même programme sont requises.';
 end if;
 foreach v_profile in array v_profiles loop
  if jsonb_typeof(p_selections->v_profile) is distinct from 'array' then raise exception 'Chaque course exige 7 à 8 coureurs.'; end if;
  if jsonb_array_length(p_selections->v_profile) not between 7 and 8 or exists(select 1 from jsonb_array_elements(p_selections->v_profile) x where jsonb_typeof(x)<>'string') then
   raise exception 'Chaque course exige 7 à 8 coureurs distincts.';
  end if;
  select array_agg(x::uuid) into v_ids from jsonb_array_elements_text(p_selections->v_profile) x;
  if (select count(distinct x) from unnest(v_ids) x)<>cardinality(v_ids) then raise exception 'Un coureur est sélectionné plusieurs fois pour la même course.'; end if;
  select count(*) into v_valid from private.season_four_gala_roster(v_team) r where rider_id=any(v_ids)
   and (p_program='world-tour' or (mountain between 1 and 75 and hills between 1 and 75 and flat between 1 and 75 and time_trial between 1 and 75 and cobbles between 1 and 75 and sprint between 1 and 75));
  if v_valid<>cardinality(v_ids) then raise exception 'Coureur hors effectif ou inéligible : en Continental, chaque note primaire native doit être de 75 maximum, sans équipement.'; end if;
 end loop;
 if not pg_try_advisory_xact_lock(hashtextextended('gala-s4:'||v_team::text,0)) then raise exception using errcode='40001',message='Une inscription est déjà en cours. Réessayez.'; end if;
 select id into v_season from public.seasons where game_year=4;
 if exists(select 1 from public.season_gala_result_imports where season_id=v_season and split_part(event_key,':',1)=p_program) then
  raise exception 'Les inscriptions de ce programme sont figées après import des résultats.';
 end if;
 select id into v_id from public.season_gala_registrations where season_id=v_season and team_id=v_team for update;
 if v_id is null then
  insert into public.season_gala_registrations(season_id,team_id,program) values(v_season,v_team,p_program) returning id into v_id;
 else
  -- The existing exclusive-programme guard requires clearing old rosters first.
  -- A later failure rolls the entire operation back, preserving the old entry.
  delete from public.season_gala_registration_riders where registration_id=v_id;
  update public.season_gala_registrations set program=p_program where id=v_id;
 end if;
 foreach v_profile in array v_profiles loop
  insert into public.season_gala_registration_riders(registration_id,profile,rider_id,position)
   select v_id,v_profile,x::uuid,position::smallint from jsonb_array_elements_text(p_selections->v_profile) with ordinality selected(x,position);
 end loop;
 return v_id;
end;$$;

create function public.withdraw_current_season_four_gala_registration()
returns void language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
declare v_team uuid; v_id uuid;
begin
 v_team:=private.current_season_four_gala_team();
 if v_team is null then raise exception 'Aucune équipe de saison 4 à inscrire.'; end if;
 if not private.season_four_gala_is_open() then raise exception 'Les inscriptions du gala sont closes.'; end if;
 if not pg_try_advisory_xact_lock(hashtextextended('gala-s4:'||v_team::text,0)) then raise exception using errcode='40001',message='Une inscription est déjà en cours. Réessayez.'; end if;
 select r.id into v_id from public.season_gala_registrations r join public.seasons s on s.id=r.season_id and s.game_year=4 where r.team_id=v_team for update of r;
 delete from public.season_gala_registration_riders where registration_id=v_id;
 delete from public.season_gala_registrations where id=v_id;
end;$$;

create function public.get_season_four_gala_entries(p_program text,p_profile text,p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_season uuid; v_total integer; v_teams jsonb; v_favorites jsonb := '[]'::jsonb;
begin
 if auth.uid() is null then raise exception using errcode='42501',message='Authentification requise.'; end if;
 if p_program is null or p_program not in ('world-tour','continental') or p_profile is null
  or p_profile not in ('mountain','hills',case when p_program='world-tour' then 'cobbles' else 'sprint' end)
  or p_page is null or p_page not between 0 and 1000 then raise exception 'Course du gala invalide.'; end if;
 select id into v_season from public.seasons where game_year=4;
 select count(*) into v_total from public.season_gala_registrations where season_id=v_season and program=p_program;
 select coalesce(jsonb_agg(entry order by team_name,team_id),'[]'::jsonb) into v_teams from (
  select r.team_id,ts.display_name team_name,jsonb_build_object(
   'teamId',r.team_id,'name',ts.display_name,'jerseyId',jersey.selected_jersey_id,
   'riders',coalesce((select jsonb_agg(jsonb_build_object('id',rr.rider_id,'name',rider.first_name||' '||rider.last_name) order by rr.position)
      from public.season_gala_registration_riders rr join public.riders rider on rider.id=rr.rider_id where rr.registration_id=r.id and rr.profile=p_profile),'[]'::jsonb)) entry
  from public.season_gala_registrations r
  join public.team_seasons ts on ts.team_id=r.team_id and ts.season_id=v_season
  left join lateral (
   select c.selected_jersey_id from public.team_sponsor_contracts c
   join public.seasons cs on cs.id=c.start_season_id join public.seasons ce on ce.id=c.end_season_id
   where c.team_id=r.team_id and c.status in ('active','completed') and cs.game_year<=4 and ce.game_year>=4
   order by cs.game_year desc,c.signed_at desc nulls last,c.id limit 1
  ) jersey on true
  where r.season_id=v_season and r.program=p_program
  order by ts.display_name,r.team_id limit 20 offset p_page*20
 ) page;
 if not private.season_four_gala_is_open() then
  select coalesce(jsonb_agg(jsonb_build_object('name',name,'team',team_name) order by score desc,name),'[]'::jsonb) into v_favorites from (
   select rider.first_name||' '||rider.last_name name,ts.display_name team_name,
    case p_profile when 'mountain' then n.mountain when 'hills' then n.hills when 'cobbles' then n.cobbles else n.sprint end score
   from public.season_gala_registrations registration
   join public.season_gala_registration_riders rr on rr.registration_id=registration.id and rr.profile=p_profile
   join public.riders rider on rider.id=rr.rider_id
   join public.team_seasons ts on ts.team_id=registration.team_id and ts.season_id=v_season
   join public.rider_season_ratings n on n.rider_id=rider.id and n.season_id=v_season
   where registration.season_id=v_season and registration.program=p_program
   order by score desc nulls last,name,rider.id limit 3
  ) favorites;
 end if;
 return jsonb_build_object('teams',v_teams,'total',v_total,'hasMore',v_total>(p_page+1)*20,'favorites',v_favorites);
end;$$;

revoke all on function private.season_four_gala_is_open(),private.current_season_four_gala_team(),private.season_four_gala_roster(uuid) from public,anon,authenticated;
revoke all on function public.get_current_season_four_gala_context(),public.save_current_season_four_gala_registration(text,jsonb),public.withdraw_current_season_four_gala_registration(),public.get_season_four_gala_entries(text,text,integer) from public,anon;
grant execute on function public.get_current_season_four_gala_context(),public.save_current_season_four_gala_registration(text,jsonb),public.withdraw_current_season_four_gala_registration(),public.get_season_four_gala_entries(text,text,integer) to authenticated;
comment on table public.season_gala_registrations is 'One S4 gala programme per team. Authenticated ownership-checked RPCs; closes 5 November 2026 at 23:59 Europe/Paris. No sporting or financial side effects.';
notify pgrst,'reload schema';
commit;
