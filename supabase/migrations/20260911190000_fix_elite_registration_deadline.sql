begin;

-- Une course Elite expose deux échéances distinctes :
--   * registration_closes_at pour les équipes Elite ;
--   * wildcard_closes_at pour les équipes non-Elite qui demandent une invitation.
-- Le trigger historique appliquait la seconde aux deux populations, ce qui
-- fermait les inscriptions Elite 24 h trop tôt (notamment sur le Grand Tour
-- italien). La date affichée et le contrôle transactionnel doivent partager
-- exactement cette règle.
create or replace function public.route_elite_race_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category_code text;
  v_division_code text;
  v_registration_closes_at timestamptz;
  v_wildcard_closes_at timestamptz;
  v_deadline timestamptz;
begin
  select
    category.code,
    division.code,
    edition.registration_closes_at,
    edition.wildcard_closes_at
  into
    v_category_code,
    v_division_code,
    v_registration_closes_at,
    v_wildcard_closes_at
  from public.race_editions as edition
  join public.race_categories as category
    on category.id = edition.race_category_id
  join public.team_seasons as team_season
    on team_season.id = new.team_season_id
   and team_season.season_id = edition.season_id
  left join public.divisions as division
    on division.id = team_season.division_id
  where edition.id = new.race_edition_id;

  if v_category_code is distinct from 'elite' then
    return new;
  end if;

  v_deadline := case
    when coalesce(v_division_code, 'amateur') = 'elite'
      then v_registration_closes_at
    else v_wildcard_closes_at
  end;

  if new.entry_method <> 'invited'
    and new.status in ('accepted', 'pending')
    and (
      v_deadline is null
      or now() >= v_deadline
    )
  then
    if coalesce(v_division_code, 'amateur') = 'elite' then
      raise exception using
        errcode = 'P0001',
        message = 'La limite d inscription avant le départ est dépassée.';
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'Les inscriptions et demandes de Wild Card sont closes 24 heures avant le départ.';
  end if;

  if coalesce(v_division_code, 'amateur') <> 'elite'
    and new.entry_method <> 'invited'
    and new.status = 'accepted'
  then
    new.status := 'pending';
    new.entry_method := 'requested';
    new.decided_at := null;
  end if;

  return new;
end;
$$;

commit;
