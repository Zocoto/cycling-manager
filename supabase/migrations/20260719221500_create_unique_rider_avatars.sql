-- ============================================================
-- CYCLING MANAGER
-- Identité visuelle permanente et unique des coureurs
-- ============================================================

begin;

-- Une graine séquentielle globale permet à tous les futurs canaux
-- de création de produire une identité différente sans coordination
-- applicative : génération initiale, recrutement, marché ou outil admin.
create sequence public.rider_avatar_seed_seq
  as bigint
  minvalue 1
  start with 1
  increment by 1
  no cycle;

revoke all
on sequence public.rider_avatar_seed_seq
from public, anon, authenticated;

-- Les portraits n'étaient pas encore visibles : les graines historiques
-- peuvent donc être normalisées sans changement perceptible pour le joueur.
with ordered_riders as (
  select
    rider.id,
    row_number() over (order by rider.created_at, rider.id)::bigint
      as avatar_seed
  from public.riders as rider
)
update public.riders as rider
set avatar_seed = ordered_riders.avatar_seed
from ordered_riders
where ordered_riders.id = rider.id;

select setval(
  'public.rider_avatar_seed_seq',
  greatest(
    coalesce((select max(rider.avatar_seed) from public.riders as rider), 0),
    1
  ),
  exists(select 1 from public.riders)
);

-- Le profil visuel est toujours dérivé du pays du coureur. Les profils
-- régionaux se recouvrent volontairement pour éviter les caricatures.
update public.riders as rider
set avatar_profile_key = profile.avatar_profile_key
from public.country_rider_generation_profiles as profile
where profile.country_id = rider.country_id
  and rider.avatar_profile_key is distinct from profile.avatar_profile_key;

do $$
begin
  if exists (
    select 1
    from public.riders as rider
    left join public.country_rider_generation_profiles as profile
      on profile.country_id = rider.country_id
    where profile.country_id is null
  ) then
    raise exception
      'Impossible de créer les portraits : certains pays de coureurs ne possèdent aucun profil visuel.';
  end if;
end;
$$;

alter table public.riders
  alter column avatar_profile_key set not null,
  alter column avatar_seed set not null;

alter table public.riders
  add constraint riders_avatar_seed_unique
  unique (avatar_seed);

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

  -- Les valeurs éventuellement transmises par le client sont ignorées :
  -- la base reste l'unique autorité pour l'identité du portrait.
  new.avatar_profile_key := v_avatar_profile_key;
  new.avatar_seed := nextval('public.rider_avatar_seed_seq');

  return new;
end;
$$;

create trigger assign_rider_avatar_identity
before insert on public.riders
for each row
execute function public.assign_rider_avatar_identity();

create or replace function public.prevent_rider_avatar_identity_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.avatar_seed is distinct from old.avatar_seed
    or new.avatar_profile_key is distinct from old.avatar_profile_key
  then
    raise exception
      'L identité visuelle d un coureur est permanente.';
  end if;

  return new;
end;
$$;

create trigger prevent_rider_avatar_identity_change
before update of avatar_seed, avatar_profile_key
on public.riders
for each row
execute function public.prevent_rider_avatar_identity_change();

comment on sequence public.rider_avatar_seed_seq is
  'Distribue une graine globale unique à chaque nouveau portrait de coureur.';

comment on function public.assign_rider_avatar_identity() is
  'Attribue automatiquement une graine unique et le profil géographique du portrait lors de toute création de coureur.';

comment on function public.prevent_rider_avatar_identity_change() is
  'Empêche la modification du visage permanent d un coureur après sa création.';

comment on column public.riders.avatar_profile_key is
  'Profil géographique permanent utilisé par le générateur déterministe de portraits.';

comment on column public.riders.avatar_seed is
  'Graine globale unique et permanente utilisée pour composer le visage du coureur.';

commit;
