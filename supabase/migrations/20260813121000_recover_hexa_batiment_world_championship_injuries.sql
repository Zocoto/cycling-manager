begin;

do $$
declare
  v_team_id uuid;
  v_season_id uuid;
  v_team_match_count integer;
  v_injury_ids uuid[];
  v_injury_count integer;
  v_restored_roster_count integer := 0;
begin
  select count(*)::integer
  into v_team_match_count
  from public.team_seasons as team_season
  join public.seasons as season on season.id = team_season.season_id
  where lower(btrim(team_season.display_name)) in ('hexa batiment', 'hexa bâtiment')
    and season.status = 'active'
    and team_season.status in ('planned', 'active');

  if v_team_match_count <> 1 then
    raise exception
      'Correction Hexa Batiment annulée : une seule équipe active était attendue, % trouvée(s).',
      v_team_match_count;
  end if;

  select team_season.team_id, team_season.season_id
  into v_team_id, v_season_id
  from public.team_seasons as team_season
  join public.seasons as season on season.id = team_season.season_id
  where lower(btrim(team_season.display_name)) in ('hexa batiment', 'hexa bâtiment')
    and season.status = 'active'
    and team_season.status in ('planned', 'active')
  limit 1;

  select
    array_agg(distinct injury.id order by injury.id),
    count(distinct injury.id)::integer
  into v_injury_ids, v_injury_count
  from public.rider_contracts as contract
  join public.rider_injuries as injury
    on injury.rider_id = contract.rider_id
   and injury.status = 'active'
   and injury.expected_recovery_at > now()
  join public.stages as stage on stage.id = injury.source_stage_id
  join public.race_editions as edition
    on edition.id = stage.race_edition_id
   and edition.season_id = v_season_id
  where contract.team_id = v_team_id
    and contract.status = 'active'
    and lower(btrim(edition.display_name)) like 'championnat% du monde%';

  if coalesce(v_injury_count, 0) = 0 then
    raise exception
      'Correction Hexa Batiment annulée : aucune blessure active issue des Championnats du monde.';
  end if;

  update public.rider_injuries
  set status = 'recovered', recovered_at = now(), updated_at = now()
  where id = any(v_injury_ids)
    and status = 'active';

  -- Une blessure retire automatiquement le coureur des futures start-lists.
  -- On le rétablit seulement si la place libérée n'a pas déjà été attribuée.
  with restorable_rosters as (
    select roster.id
    from public.race_rosters as roster
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
     and registration.status = 'accepted'
    join public.race_editions as edition
      on edition.id = registration.race_edition_id
     and edition.status = 'planned'
    join public.races as race on race.id = edition.race_id
    left join public.race_categories as category
      on category.id = edition.race_category_id
    where roster.withdrawn_by_injury_id = any(v_injury_ids)
      and (
        select count(*)
        from public.race_rosters as active_roster
        where active_roster.race_registration_id = registration.id
          and active_roster.status in ('selected', 'confirmed')
      ) < case
        when race.competition_type in ('national_road', 'national_time_trial') then 8
        else coalesce(category.maximum_roster_size, 0)
      end
  ), restored as (
    update public.race_rosters as roster
    set status = 'confirmed', withdrawn_by_injury_id = null
    where roster.id in (select restorable.id from restorable_rosters as restorable)
    returning roster.id
  )
  select count(*)::integer into v_restored_roster_count from restored;

  update public.race_roster_notifications
  set requires_action = false,
      read_at = coalesce(read_at, now()),
      updated_at = now()
  where injury_id = any(v_injury_ids);

  raise notice
    'Correction Hexa Batiment terminée : % blessure(s) CM levée(s), % engagement(s) futur(s) rétabli(s).',
    v_injury_count,
    v_restored_roster_count;
end;
$$;

commit;
