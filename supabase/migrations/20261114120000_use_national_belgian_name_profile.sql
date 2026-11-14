begin;
set local application_name = 'cyclostratege-belgian-name-profile-20261114';
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

insert into public.rider_name_profiles (code, label)
values ('belgium_national', 'Belgique')
on conflict (code) do nothing;

do $$
declare
  v_country_id uuid;
  v_old_profile text;
begin
  select country.id, generation_profile.name_profile_code
  into strict v_country_id, v_old_profile
  from public.countries as country
  join public.country_rider_generation_profiles as generation_profile
    on generation_profile.country_id = country.id
  where country.iso_alpha2 = 'BE'
  for update of generation_profile;

  if v_old_profile = 'belgium' then
    update public.country_rider_generation_profiles
    set name_profile_code = 'belgium_national'
    where country_id = v_country_id;
  elsif v_old_profile <> 'belgium_national' then
    raise exception 'Unexpected Belgian name profile: %.', v_old_profile;
  end if;

  if exists (
    select 1 from public.country_rider_generation_profiles
    where name_profile_code = 'belgium_national' and country_id <> v_country_id
  ) then
    raise exception 'The Belgian national name profile must be exclusive to Belgium.';
  end if;
end;
$$;

commit;
