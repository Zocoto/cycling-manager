begin;
set local lock_timeout = '1s';
set local statement_timeout = '5s';
set local application_name = 'close-directory-suggestions-20261027';

create extension if not exists unaccent with schema extensions;
create extension if not exists fuzzystrmatch with schema extensions;

-- Strict spelling gate after the indexed trigram shortlist. Whole words only;
-- never a one-letter overlap or an arbitrary fragment of a much longer name.
create function private.directory_close_name_score(p_query text, p_name text)
returns real language plpgsql stable set search_path = '' as $$
declare
  q text := btrim(regexp_replace(lower(extensions.unaccent(coalesce(p_query,''))), '[^[:alnum:]]+', ' ', 'g'));
  n text := btrim(regexp_replace(lower(extensions.unaccent(coalesce(p_name,''))), '[^[:alnum:]]+', ' ', 'g'));
  words text[]; windows text[]; q_words integer; candidate text;
  budget integer; distance integer; first_difference integer; best real := null;
begin
  if length(q) < 4 or length(q) > 80 or length(n) > 200 or n = '' then return null; end if;
  q_words := cardinality(regexp_split_to_array(q,' +'));
  words := regexp_split_to_array(n,' +');
  q := replace(q,' ','');
  if length(q) < 4 then return null; end if;
  budget := case when length(q) >= 10 then 2 else 1 end;
  windows := array[replace(n,' ','')];
  for i in 1..cardinality(words) loop
    if i + q_words - 1 <= cardinality(words) then
      windows := array_append(windows,array_to_string(words[i:i+q_words-1],''));
    end if;
  end loop;
  foreach candidate in array windows loop
    if abs(length(q)-length(candidate)) > budget then continue; end if;
    distance := extensions.levenshtein_less_equal(q,candidate,budget);
    -- A neighbouring key transposition is one ordinary typing mistake.
    if distance > budget and length(q) = length(candidate) then
      first_difference := null;
      for i in 1..length(q) loop
        if substr(q,i,1) <> substr(candidate,i,1) then first_difference := i; exit; end if;
      end loop;
      if first_difference < length(q) and
        substr(q,1,first_difference-1) || substr(q,first_difference+1,1) ||
        substr(q,first_difference,1) || substr(q,first_difference+2) = candidate then distance := 1; end if;
    end if;
    if distance <= budget then
      best := greatest(best,1.0-distance::real/greatest(length(q),length(candidate)));
    end if;
  end loop;
  return best;
end; $$;
revoke all on function private.directory_close_name_score(text,text) from public, anon, authenticated;

create function public.search_game_directory_suggestions(p_query text, p_limit integer default 6)
returns table (
  result_type text, entity_id uuid, public_identifier text, display_name text,
  avatar_key text, reputation_points integer, country_code text, country_name text,
  team_name text, team_id uuid, sponsor_name text, sporting_director_username text,
  sporting_director_name text, sporting_director_count bigint, team_count bigint,
  match_score real
)
language plpgsql stable security definer set search_path = ''
set statement_timeout = '2s'
as $$
declare q text := lower(btrim(coalesce(p_query,''))); previous_threshold text;
begin
  if auth.uid() is null or length(q) < 4 or length(q) > 80 or q !~ '[[:alpha:]]'
    or q ~ '^[0-9a-f]{8}-[0-9a-f-]{27}$' then return; end if;
  -- Register the extension's user-settable settings before touching them;
  -- managed database roles cannot set an unloaded extension's placeholder.
  perform extensions.word_similarity(q,q);
  previous_threshold := current_setting('pg_trgm.word_similarity_threshold');
  perform set_config('pg_trgm.word_similarity_threshold','0.35',true);
  return query
  with active_season as materialized (
    select s.id from public.seasons s where s.status='active' limit 1
  ), directors as materialized (
    select 'sporting_director'::text kind,d.id id,array[d.username,d.display_name] names,
      greatest(extensions.word_similarity(q,d.username),extensions.word_similarity(q,d.display_name)) rough
    from public.sporting_directors d join public.countries co on co.id=d.country_id and co.is_active
    where d.status='active' and (d.username operator(extensions.%>) q or d.display_name operator(extensions.%>) q)
    order by rough desc,d.id limit 80
  ), riders as materialized (
    select 'rider'::text kind,r.id,array[r.first_name||' '||r.last_name] names,
      extensions.word_similarity(q,lower(r.first_name||' '||r.last_name)) rough
    from public.riders r join public.countries co on co.id=r.country_id and co.is_active
    where r.status in ('active','free_agent','retired')
      and lower(r.first_name||' '||r.last_name) operator(extensions.%>) q
    order by rough desc,r.id limit 80
  ), teams as materialized (
    select 'team'::text kind,t.id,array[ts.display_name] names,extensions.word_similarity(q,ts.display_name) rough
    from public.teams t join public.team_seasons ts on ts.team_id=t.id
    where t.status='active' and ts.display_name operator(extensions.%>) q
      and exists(select 1 from public.team_seasons current_team join active_season s on s.id=current_team.season_id
        join public.countries co on co.id=current_team.registration_country_id and co.is_active
        where current_team.team_id=t.id and current_team.status='active')
    order by rough desc,t.id limit 80
  ), countries as materialized (
    select 'country'::text kind,co.id,array[co.name] names,extensions.word_similarity(q,co.name) rough
    from public.countries co where co.is_active and co.name operator(extensions.%>) q
    order by rough desc,co.id limit 80
  ), candidates as materialized (
    select * from directors union all select * from riders union all select * from teams union all select * from countries
  ), scored as materialized (
    select c.kind,c.id,(select max(private.directory_close_name_score(q,n.name)) from unnest(c.names) n(name)) score
    from candidates c
  ), unique_matches as (
    select distinct on(c.kind,c.id) c.kind,c.id,c.score from scored c where c.score is not null
    order by c.kind,c.id,c.score desc
  ), ranked as materialized (
    select * from unique_matches order by score desc,kind,id limit greatest(1,least(coalesce(p_limit,6),6))
  )
  select ranked.kind,ranked.id,
    (case ranked.kind when 'sporting_director' then d.username when 'country' then lower(co.iso_alpha2) else ranked.id::text end)::text,
    (case ranked.kind when 'sporting_director' then d.display_name when 'country' then co.name
      when 'rider' then r.first_name||' '||r.last_name else ts.display_name end)::text,
    (case ranked.kind when 'sporting_director' then d.avatar_key when 'rider' then r.avatar_profile_key else null end)::text,
    (case ranked.kind when 'sporting_director' then d.reputation_points when 'rider' then coalesce(summary.points,0) else null end)::integer,
    co.iso_alpha2::text,co.name::text,
    (case when ranked.kind in('sporting_director','rider') then ts.display_name else null end)::text,
    case when ts.id is not null then t.id else null end,
    sponsor.name::text,manager.username::text,manager.display_name::text,
    case when ranked.kind='country' then (select count(*) from public.sporting_directors cd where cd.country_id=co.id and cd.status='active') else null end,
    case when ranked.kind='country' then (select count(*) from public.team_seasons ct join active_season s on s.id=ct.season_id
      join public.teams at on at.id=ct.team_id and at.status='active' where ct.registration_country_id=co.id and ct.status='active') else null end,
    ranked.score
  from ranked
  left join active_season season on true
  left join public.sporting_directors d on ranked.kind='sporting_director' and d.id=ranked.id
  left join public.riders r on ranked.kind='rider' and r.id=ranked.id
  left join public.team_manager_assignments a on ranked.kind='sporting_director' and a.sporting_director_id=d.id and a.status='active' and a.role='general_manager'
  left join public.rider_contracts contract on ranked.kind='rider' and contract.rider_id=r.id and contract.status='active'
  left join public.teams t on t.id=case when ranked.kind='team' then ranked.id else coalesce(a.team_id,contract.team_id) end and t.status='active'
  left join public.team_seasons ts on ts.team_id=t.id and ts.season_id=season.id and ts.status='active'
  join public.countries co on co.id=case ranked.kind when 'sporting_director' then d.country_id when 'rider' then r.country_id
    when 'country' then ranked.id else ts.registration_country_id end and co.is_active
  left join public.team_manager_assignments ma on ranked.kind='team' and ma.team_id=t.id and ma.status='active' and ma.role='general_manager'
  left join public.sporting_directors manager on manager.id=ma.sporting_director_id and manager.status='active'
  left join public.team_sponsor_contracts sc on ranked.kind='team' and sc.team_id=t.id and sc.status='active' and sc.role='principal'
  left join public.sponsors sponsor on sponsor.id=sc.sponsor_id
  left join public.rider_season_summaries summary on ranked.kind='rider' and summary.rider_id=r.id and summary.season_id=season.id
  order by ranked.score desc,ranked.kind,ranked.id;
  perform set_config('pg_trgm.word_similarity_threshold',previous_threshold,true);
end; $$;
revoke all on function public.search_game_directory_suggestions(text,integer) from public, anon;
grant execute on function public.search_game_directory_suggestions(text,integer) to authenticated;
notify pgrst,'reload schema';
commit;
