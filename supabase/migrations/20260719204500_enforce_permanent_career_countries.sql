begin;

-- ============================================================
-- PAYS DEFINITIFS DU DS ET DE L EQUIPE
--
-- Les controles applicatifs offrent un message utilisateur clair.
-- Ces triggers constituent la garantie metier en base, y compris
-- face a un appel direct a la Data API ou a une future RPC.
-- ============================================================

create or replace function private.prevent_sporting_director_country_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.country_id is not null
    and new.country_id is distinct from old.country_id
  then
    raise exception
      'La nationalité du Directeur Sportif a été validée définitivement.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_sporting_director_country_change
on public.sporting_directors;

create trigger prevent_sporting_director_country_change
before update of country_id on public.sporting_directors
for each row
execute function private.prevent_sporting_director_country_change();

create or replace function private.prevent_team_home_country_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.home_country_id is distinct from old.home_country_id then
    raise exception
      'Le pays d affiliation de l équipe a été validé définitivement.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_team_home_country_change
on public.teams;

create trigger prevent_team_home_country_change
before update of home_country_id on public.teams
for each row
execute function private.prevent_team_home_country_change();

revoke all
on function private.prevent_sporting_director_country_change()
from public, anon, authenticated;

revoke all
on function private.prevent_team_home_country_change()
from public, anon, authenticated;

commit;
