begin;

update public.countries
set is_active = true
where iso_alpha2 = 'WS';

insert into public.country_rider_generation_profiles (
  country_id,
  name_profile_code,
  avatar_profile_key
)
select
  country.id,
  'oceania',
  'oceania'
from public.countries as country
where country.iso_alpha2 = 'WS'
on conflict (country_id)
do update set
  name_profile_code = excluded.name_profile_code,
  avatar_profile_key = excluded.avatar_profile_key;

do $$
declare
  samoa_ready boolean;
begin
  select
    country.is_active
    and generation_profile.country_id is not null
  into samoa_ready
  from public.countries as country
  left join public.country_rider_generation_profiles as generation_profile
    on generation_profile.country_id = country.id
  where country.iso_alpha2 = 'WS';

  if coalesce(samoa_ready, false) is not true then
    raise exception using
      errcode = '23514',
      message = 'Samoa n’a pas pu être activée avec son profil de génération.';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
