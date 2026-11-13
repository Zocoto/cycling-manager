begin;

set local lock_timeout = '3s';
set local statement_timeout = '15s';

-- Extend the existing avatar guard, including the editor path that saves
-- Halloween cosmetics and composes a suffix on the saved portrait.
create or replace function private.validate_career_achievement_avatar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config text;
  v_outfit text;
  v_objective text;
  v_background text;
begin
  if new.avatar_key is null or new.avatar_key not like 'director_custom_v1:%' then
    return new;
  end if;

  v_config := substring(split_part(new.avatar_key, '~halloween~', 1) from length('director_custom_v1:') + 1);
  v_outfit := split_part(v_config, '.', 14);
  v_objective := case v_outfit
    when 'career-shopkeeper' then 'journey_shopkeeper_gold'
    when 'career-mentor' then 'journey_mentor_gold'
    when 'career-homegrown' then 'journey_homegrown_gold'
  end;

  if v_objective is not null and not exists (
    select 1 from public.game_objective_claims
    where sporting_director_id = new.id and objective_key = v_objective
  ) then
    raise exception 'Récupérez d’abord le palier Or du succès correspondant à cette tenue.';
  end if;

  v_background := split_part(v_config, '.', 15);
  if left(v_background, 5) <> 'flag-' then
    return new;
  end if;

  if not exists (
    select 1 from public.game_objective_claims
    where sporting_director_id = new.id and objective_key = 'journey_patriot_gold'
  ) then
    raise exception using errcode = 'PFP01',
      message = 'Récupérez la récompense du succès Le Patriote pour utiliser ce fond.';
  end if;

  if not exists (
    select 1 from public.countries as country
    where country.id = new.country_id
      and v_background = 'flag-' || lower(country.iso_alpha2)
  ) then
    raise exception using errcode = 'PFP02', message = 'Choisissez le drapeau de votre nationalité.';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_career_achievement_avatar() from public, anon, authenticated;

commit;
