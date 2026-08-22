begin;

alter table public.riders
  drop constraint if exists riders_avatar_seed_non_negative;

create or replace function public.assign_rider_avatar_identity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_avatar_profile_key text;
begin
  select profile.avatar_profile_key
  into v_avatar_profile_key
  from public.country_rider_generation_profiles as profile
  where profile.country_id = new.country_id;

  if v_avatar_profile_key is null then
    raise exception
      'Le pays du coureur ne possède aucun profil visuel.';
  end if;

  -- Les graines positives appartiennent à la version historique du portrait.
  -- Toute nouvelle création reçoit une graine négative et profite de la v2,
  -- sans modifier le visage permanent des coureurs déjà présents en base.
  new.avatar_profile_key := v_avatar_profile_key;
  new.avatar_seed := -nextval('public.rider_avatar_seed_seq');

  return new;
end;
$$;

comment on function public.assign_rider_avatar_identity() is
  'Attribue à chaque nouveau coureur une graine v2 négative unique et son profil géographique permanent.';

comment on column public.riders.avatar_seed is
  'Graine globale unique et permanente : positive pour le portrait historique v1, négative pour le portrait enrichi v2.';

notify pgrst, 'reload schema';

commit;
