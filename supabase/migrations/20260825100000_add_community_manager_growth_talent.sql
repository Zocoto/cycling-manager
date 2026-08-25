begin;

insert into public.staff_talent_catalog (code, role, display_name)
values (
  'community_rider_popularity_and_fans',
  'community_manager',
  'Communauté engagée'
)
on conflict (code) do update
set
  role = excluded.role,
  display_name = excluded.display_name,
  is_active = true;

alter table public.rider_popularity_profiles
  alter column popularity_points type numeric(10, 2)
  using popularity_points::numeric(10, 2);

create or replace function public.publish_current_team_media_article(
  p_title text,
  p_body text,
  p_include_sponsor boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_level integer;
  v_fan_club_level integer;
  v_interval integer;
  v_game_day integer;
  v_last_game_day integer;
  v_rep numeric;
  v_fans integer;
  v_popularity numeric(10, 2);
  v_growth_percentage numeric;
  v_sponsor text;
  v_id uuid;
begin
  select
    director.id as director_id,
    assignment.team_id,
    season.id as season_id,
    season.game_year,
    season.current_day_number,
    team_season.display_name
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active.';
  end if;
  if char_length(btrim(p_title)) not between 5 and 100
    or char_length(btrim(p_body)) not between 40 and 1600 then
    raise exception 'Le titre ou le contenu ne respecte pas la longueur demandée.';
  end if;

  select coalesce(max(infrastructure.level), 0)
  into v_level
  from public.team_infrastructures as infrastructure
  where infrastructure.team_id = v_context.team_id
    and infrastructure.infrastructure_code = 'media_center';
  if v_level < 1 then
    raise exception 'Construisez d’abord le Média Center.';
  end if;

  select coalesce(max(infrastructure.level), 0)
  into v_fan_club_level
  from public.team_infrastructures as infrastructure
  where infrastructure.team_id = v_context.team_id
    and infrastructure.infrastructure_code = 'fan_club_headquarters';

  v_interval := (array[7, 5, 4, 3, 2]::integer[])[v_level];
  v_game_day := v_context.game_year * 28 + v_context.current_day_number - 1;
  select max(season.game_year * 28 + article.day_number - 1)
  into v_last_game_day
  from public.media_center_articles as article
  join public.seasons as season on season.id = article.season_id
  where article.team_id = v_context.team_id;
  if v_last_game_day is not null
    and v_game_day - v_last_game_day < v_interval then
    raise exception
      'Votre rédaction pourra proposer une nouvelle tribune dans % jours.',
      v_interval - (v_game_day - v_last_game_day);
  end if;

  if p_include_sponsor and v_level >= 3 then
    select sponsor.name
    into v_sponsor
    from public.team_sponsor_contracts as contract
    join public.sponsors as sponsor on sponsor.id = contract.sponsor_id
    where contract.team_id = v_context.team_id
      and contract.status = 'active'
    limit 1;
  end if;

  v_growth_percentage := public.get_active_team_staff_talent_strength(
    v_context.team_id,
    'community_rider_popularity_and_fans',
    3
  );
  v_rep := round(
    v_level * 0.5 * (
      1 + coalesce((
        select max(member.level) * v_level * 0.02
        from public.staff_contracts as contract
        join public.staff_members as member
          on member.id = contract.staff_member_id
        where contract.team_id = v_context.team_id
          and contract.status = 'active'
          and member.role = 'community_manager'
      ), 0)
    ),
    2
  );
  v_popularity := round(
    v_level * (1 + v_growth_percentage / 100.0),
    2
  );
  v_fans := case
    when v_fan_club_level >= 1 then round(
      v_level * 25 * (1 + v_growth_percentage / 100.0)
    )::integer
    else 0
  end;

  update public.sporting_directors
  set reputation_points = reputation_points + v_rep
  where id = v_context.director_id;

  if v_fans > 0 then
    insert into public.fan_club_profiles (
      team_id,
      supporter_count,
      fervor,
      popularity_index
    ) values (
      v_context.team_id,
      v_fans,
      v_level,
      least(100, v_level)
    )
    on conflict (team_id) do update
    set
      supporter_count = public.fan_club_profiles.supporter_count + v_fans,
      fervor = least(100, public.fan_club_profiles.fervor + 1),
      popularity_index = least(
        100,
        public.fan_club_profiles.popularity_index + 1
      ),
      updated_at = now();
  end if;

  insert into public.rider_popularity_profiles (
    rider_id,
    popularity_points
  )
  select rider.id, v_popularity
  from public.riders as rider
  join public.rider_contracts as contract on contract.rider_id = rider.id
  where contract.team_id = v_context.team_id
    and contract.status = 'active'
  on conflict (rider_id) do update
  set
    popularity_points =
      public.rider_popularity_profiles.popularity_points + v_popularity,
    updated_at = now();

  insert into public.media_center_articles (
    team_id,
    sporting_director_id,
    season_id,
    day_number,
    title,
    body,
    team_name,
    sponsor_name,
    building_level,
    reputation_awarded,
    supporters_awarded
  ) values (
    v_context.team_id,
    v_context.director_id,
    v_context.season_id,
    v_context.current_day_number,
    btrim(p_title),
    btrim(p_body),
    v_context.display_name,
    v_sponsor,
    v_level,
    v_rep,
    v_fans
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.publish_current_team_media_article(
  text,
  text,
  boolean
) from public, anon;
grant execute on function public.publish_current_team_media_article(
  text,
  text,
  boolean
) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
