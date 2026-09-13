begin;

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

  -- Les graines v1 positives et v2 négatives déjà attribuées restent intactes.
  -- Le nouvel espace, sous -1 000 000 000 000, active uniquement la v3 pour
  -- les coureurs créés après cette migration.
  new.avatar_profile_key := v_avatar_profile_key;
  new.avatar_seed := -(1000000000000::bigint + nextval('public.rider_avatar_seed_seq'));

  return new;
end;
$$;

comment on function public.assign_rider_avatar_identity() is
  'Attribue à chaque nouveau coureur une graine v3 unique sans modifier les portraits v1 et v2 existants.';

comment on column public.riders.avatar_seed is
  'Graine globale permanente : positive en v1, négative supérieure à -10^12 en v2 et inférieure à -10^12 en v3.';

notify pgrst, 'reload schema';

commit;
